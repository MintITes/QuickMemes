#include "core/task_queue.hpp"

#include "core/server.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"
#include "embedding/embedding.hpp"
#include "error_codes.hpp"
#include "utils/file_utils.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <atomic>
#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/asio/thread_pool.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/uuid/random_generator.hpp>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_io.hpp>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <mutex>
#include <random>
#include <thread>
#include <unordered_map>
#include <boost/url.hpp>
#include <expected>
#include <boost/beast/http/file_body.hpp>

extern std::unique_ptr<quickmemes::Server> g_server;

namespace quickmemes {

namespace {
std::string generateUUIDv4();

std::expected<std::string, std::string> downloadImageToTemp(const std::string &url) {
	auto r = boost::urls::parse_uri(url);
	if (!r) return std::unexpected("Failed to parse URL");
	auto const &uv = *r;

	std::string protocol(uv.scheme());
	std::string host(uv.host());
	std::string port   = uv.has_port() ? std::string(uv.port()) : (protocol == "https" ? "443" : "80");
	std::string target = std::string(uv.encoded_target());
	if (target.empty()) target = "/";

	std::vector<std::string> userAgents = {
	    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 "
	    "Safari/537.36",
	    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 "
	    "Safari/605.1.15",
	    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 "
	    "Mobile/15E148 Safari/604.1"};

	thread_local std::mt19937             generator(std::random_device{}());
	std::uniform_int_distribution<size_t> distribution(0, userAgents.size() - 1);
	std::string                           randomUA = userAgents[distribution(generator)];

	int maxRetries = 3;
	for (int attempt = 0; attempt < maxRetries; attempt++) {
		try {
			boost::asio::io_context        ioc;
			boost::asio::ip::tcp::resolver resolver(ioc);
			auto const                     results = resolver.resolve(host, port);

			for (auto &result : results) {
				auto addr = result.endpoint().address();
				if (addr.is_v4()) {
					auto bytes = addr.to_v4().to_bytes();
					if (bytes[0] == 127 || bytes[0] == 10 || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
					    (bytes[0] == 192 && bytes[1] == 168) || (bytes[0] == 169 && bytes[1] == 254) || bytes[0] == 0) {
						return std::unexpected("SSRF Protection"); // SSRF Protection
					}
				} else if (addr.is_v6()) {
					if (addr.to_v6().is_loopback() || addr.to_v6().is_link_local() || addr.to_v6().is_site_local() ||
					    addr.to_v6().is_multicast() || addr.to_v6().is_unspecified()) {
						return std::unexpected("SSRF Protection");
					}
				}
			}

			boost::beast::http::request<boost::beast::http::empty_body> req{boost::beast::http::verb::get, target, 11};
			req.set(boost::beast::http::field::host, host);
			req.set(boost::beast::http::field::user_agent, randomUA);

			// 彻底消除内存爆炸风险：直接落盘
			std::string tempPath = (std::filesystem::temp_directory_path() / ("qmdl_" + generateUUIDv4())).string();

			boost::beast::http::response_parser<boost::beast::http::file_body> parser;
			parser.body_limit(10 * 1024 * 1024); // 10 MB limit

			boost::beast::error_code file_ec;
			parser.get().body().open(tempPath.c_str(), boost::beast::file_mode::write, file_ec);
			if (file_ec) return std::unexpected("Failed to open temp file: " + file_ec.message());

			if (protocol == "https") {
				boost::asio::ssl::context ctx(boost::asio::ssl::context::tlsv12_client);
				ctx.set_default_verify_paths();
				ctx.set_verify_mode(boost::asio::ssl::verify_peer);
				boost::beast::ssl_stream<boost::beast::tcp_stream> stream(ioc, ctx);
				if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str()))
					return std::unexpected("SSL SNI failed");

				boost::beast::get_lowest_layer(stream).connect(results);
				boost::beast::get_lowest_layer(stream).expires_after(std::chrono::seconds(30));
				stream.handshake(boost::asio::ssl::stream_base::client);
				boost::beast::http::write(stream, req);
				boost::beast::flat_buffer buffer;
				boost::beast::http::read(stream, buffer, parser);
				boost::beast::error_code ec;
				stream.shutdown(ec);
			} else {
				boost::beast::tcp_stream stream(ioc);
				stream.connect(results);
				stream.expires_after(std::chrono::seconds(30));
				boost::beast::http::write(stream, req);
				boost::beast::flat_buffer buffer;
				boost::beast::http::read(stream, buffer, parser);
				boost::beast::error_code ec;
				stream.socket().shutdown(boost::asio::ip::tcp::socket::shutdown_both, ec);
			}

			auto &res = parser.get();

			if (res.result() != boost::beast::http::status::ok) {
				std::filesystem::remove(tempPath);
				if (attempt < maxRetries - 1) {
					std::this_thread::sleep_for(std::chrono::seconds(1));
					continue;
				}
				return std::unexpected("HTTP status " + std::to_string(static_cast<int>(res.result())));
			}

			return tempPath;
		} catch (const std::exception &e) {
			if (attempt < maxRetries - 1) {
				std::this_thread::sleep_for(std::chrono::seconds(1));
				continue;
			}
			return std::unexpected(e.what());
		} catch (...) {
			if (attempt < maxRetries - 1) {
				std::this_thread::sleep_for(std::chrono::seconds(1));
				continue;
			}
			return std::unexpected("Unknown error");
		}
	}
	return std::unexpected("Max retries reached");
}

std::string generateUUIDv4() {
	thread_local boost::uuids::random_generator generator;
	return boost::uuids::to_string(generator());
}

std::string buildStoredFilePath(const std::string &storageRoot, const std::string &filePath) {
	const auto root = storageRoot.empty() ? std::filesystem::path("storage") : std::filesystem::path(storageRoot);
	return (root / std::filesystem::path(filePath)).string();
}

void stopAndJoinPool(std::unique_ptr<boost::asio::thread_pool> &pool) {
	if (!pool) return;
	pool->stop();
	pool->join();
	pool.reset();
}
} // namespace

struct TaskState {
	int                      totalItems = 0;
	std::atomic<int>         finishedItems{0};
	std::atomic<int>         succeededItems{0};
	std::atomic<int>         failedItems{0};
	std::mutex               errorsMutex;
	std::vector<std::string> errors;
	bool                     cancelled = false;
};

class TaskQueueImpl {
public:
	std::unique_ptr<boost::asio::thread_pool> ioPool;
	std::unique_ptr<boost::asio::thread_pool> aiPool;
	std::unique_ptr<boost::asio::thread_pool> thumbPool;
	int                                       maxQueueSize = 500;
	std::atomic<int>                          currentPending{0};
	std::string                               storagePath;

	std::mutex                                                  tasksMutex;
	std::unordered_map<std::string, std::shared_ptr<TaskState>> activeTasks;
	std::unordered_map<int64_t, std::string>                    inflightThumbnailTasks;
	std::unordered_map<std::string, int64_t>                    inflightThumbnailByTask;
};

TaskQueue::TaskQueue()
    : impl_(std::make_unique<TaskQueueImpl>()) {}
TaskQueue::~TaskQueue() {
	shutdown();
}

TaskQueue &TaskQueue::get() {
	static TaskQueue instance;
	return instance;
}

void TaskQueue::initialize(int workerCount, int maxQueueSize, const std::string &storagePath) {
	if (impl_->ioPool) return;
	impl_->maxQueueSize = maxQueueSize;
	impl_->storagePath  = storagePath;
	impl_->ioPool       = std::make_unique<boost::asio::thread_pool>(workerCount);
	impl_->aiPool       = std::make_unique<boost::asio::thread_pool>(std::max(1, workerCount / 2));
	impl_->thumbPool    = std::make_unique<boost::asio::thread_pool>(std::max(1, workerCount / 2));
	LOG_INFO("queue",
	         "TaskQueue initialized (IO workers: " + std::to_string(workerCount) +
	             ", AI: " + std::to_string(std::max(1, workerCount / 2)) +
	             ", Thumb: " + std::to_string(std::max(1, workerCount / 2)) + ", storage: " + storagePath + ")");
}

void TaskQueue::shutdown() {
	if (impl_->ioPool || impl_->aiPool || impl_->thumbPool) {
		LOG_INFO("queue", "Shutting down TaskQueue...");

		stopAndJoinPool(impl_->ioPool);
		stopAndJoinPool(impl_->thumbPool);
		stopAndJoinPool(impl_->aiPool);

		{
			std::lock_guard<std::mutex> lock(impl_->tasksMutex);
			for (auto &[taskId, state] : impl_->activeTasks) {
				(void)taskId;
				state->cancelled = true;
			}
			impl_->activeTasks.clear();
			impl_->inflightThumbnailTasks.clear();
			impl_->inflightThumbnailByTask.clear();
		}
		impl_->currentPending.store(0);

		LOG_INFO("queue", "TaskQueue shutdown completed.");
	}
}

const std::string &TaskQueue::getStoragePath() const {
	return impl_->storagePath;
}

std::string TaskQueue::submitImportTask(const ImportRequest &request) {
	if (!impl_->ioPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }
	if (request.inputs.empty()) { throw ApiException(ERR_INVALID_PARAMS, "Import inputs cannot be empty"); }

	const int batchSize = static_cast<int>(request.inputs.size());

	std::string taskId = generateUUIDv4();

	const char *queueError =
	    (batchSize > impl_->maxQueueSize) ? "Task queue is full (batch too large)" : "Task queue is full";
	int reservedPending = impl_->currentPending.load();
	while (true) {
		if (reservedPending + batchSize > impl_->maxQueueSize) {
			WsEvent errEvent;
			errEvent.event   = "task:error";
			errEvent.payload = {
			    {"taskId", taskId},
			    {"error",  queueError}
            };
			WsPusher::get().broadcast(errEvent);
			throw ApiException(ERR_QUOTA_EXCEEDED, queueError);
		}
		if (impl_->currentPending.compare_exchange_weak(reservedPending, reservedPending + batchSize)) { break; }
	}

	auto state        = std::make_shared<TaskState>();
	state->totalItems = batchSize;

	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks[taskId] = state;
	}

	int postedCount = 0;
	try {
		for (const auto &inputStr : request.inputs) {
			ImportPipeline pipeline;
			pipeline.taskId               = taskId;
			pipeline.inputPath            = inputStr;
			pipeline.memeEntry.sourceName = request.options.sourceName;
			pipeline.memeEntry.sourceUrl  = request.options.sourceUrl;

			boost::asio::post(*impl_->ioPool, [this, p = std::move(pipeline), state]() mutable {
				if (state->cancelled) {
					markItemDone(state, p.taskId, false, "Cancelled");
					return;
				}

				try {
					runProcessingPipeline(std::move(p), state);
				} catch (const std::exception &e) {
					LOG_ERROR("queue", "Pipeline IO error: " + std::string(e.what()));
					markItemDone(state, p.taskId, false, "Pipeline IO error: " + std::string(e.what()));
				} catch (...) { markItemDone(state, p.taskId, false, "Unknown pipeline error"); }
			});
			++postedCount;
		}
	} catch (...) {
		for (int i = postedCount; i < batchSize; ++i) {
			markItemDone(state, taskId, false, "Failed to enqueue import task");
		}
		throw;
	}

	return taskId;
}

std::string TaskQueue::submitMemeOcrTask(int64_t memeId) {
	if (!impl_->aiPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }

	if (impl_->currentPending >= impl_->maxQueueSize) { throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full"); }

	std::string taskId = "ocr-" + std::to_string(memeId) + "-" + generateUUIDv4();
	auto        state  = std::make_shared<TaskState>();
	state->totalItems  = 1;

	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks[taskId] = state;
	}

	impl_->currentPending++;
	boost::asio::post(*impl_->aiPool, [this, memeId, taskId, state]() {
		if (state->cancelled) {
			markItemDone(state, taskId, false, "Cancelled");
			return;
		}

		try {
			LOG_INFO("queue", "Manual OCR task started for meme: " + std::to_string(memeId));
			WsEvent progEvent;
			progEvent.event   = "task:progress";
			progEvent.payload = {
			    {"taskId",       taskId},
			    {"status", "processing"},
			    {"memeId",       memeId}
            };
			WsPusher::get().broadcast(progEvent);

			auto meme = Database::get().getMeme(memeId);
			if (meme.deletedAt > 0) { throw ApiException(ERR_INVALID_PARAMS, "Cannot OCR a deleted meme"); }

			std::string actualPath = buildStoredFilePath(impl_->storagePath, meme.filePath);
			if (!std::filesystem::exists(actualPath)) {
				throw ApiException(ERR_NOT_FOUND, "Source file not found for meme " + std::to_string(memeId));
			}

			VisionModule &vision = VisionModule::get();
			if (!vision.isOcrAvailable()) { throw ApiException(ERR_OCR_NOT_READY, "OCR service unavailable"); }

			auto             res       = vision.recognize(actualPath);
			ProcessingStatus ocrStatus = res.success ? ProcessingStatus::DONE : ProcessingStatus::FAILED;
			std::string      ocrText   = res.success ? res.fullText : "";

			Database::get().updateMemeProcessing(memeId, ocrStatus, meme.aiStatus, ocrText, meme.description);
			if (res.success && EmbeddingModule::get().isAvailable()) {
				try {
					if (ocrText.empty()) {
						Database::get().deleteOcrEmbedding(memeId);
					} else {
						auto ocrEmbedding = EmbeddingModule::get().generateEmbedding(ocrText);
						if (!ocrEmbedding.empty()) {
							Database::get().upsertOcrEmbedding(memeId, ocrEmbedding);
						} else {
							Database::get().deleteOcrEmbedding(memeId);
						}
					}
				} catch (const std::exception &e) {
					Database::get().deleteOcrEmbedding(memeId);
					LOG_WARN("queue",
					         "Manual OCR embedding refresh failed for meme " + std::to_string(memeId) +
					             ", deleted stale vector: " + e.what());
				}
			}

			auto updatedMeme = Database::get().getMeme(memeId);
			WsPusher::get().broadcast({"meme:updated", updatedMeme});

			if (!res.success) { throw ApiException(ERR_OCR_FAILED, res.error.empty() ? "OCR failed" : res.error); }

			markItemDone(state, taskId, true, "");
		} catch (const ApiException &e) {
			LOG_ERROR("queue", "Manual OCR task failed: " + std::string(e.what()));
			try {
				auto meme = Database::get().getMeme(memeId);
				Database::get().updateMemeProcessing(memeId,
				                                     ProcessingStatus::FAILED,
				                                     meme.aiStatus,
				                                     "",
				                                     meme.description);
			} catch (...) {}
			markItemDone(state, taskId, false, e.what());
		} catch (const std::exception &e) {
			LOG_ERROR("queue", "Manual OCR task failed: " + std::string(e.what()));
			try {
				auto meme = Database::get().getMeme(memeId);
				Database::get().updateMemeProcessing(memeId,
				                                     ProcessingStatus::FAILED,
				                                     meme.aiStatus,
				                                     "",
				                                     meme.description);
			} catch (...) {}
			markItemDone(state, taskId, false, "OCR task error: " + std::string(e.what()));
		} catch (...) {
			LOG_ERROR("queue", "Manual OCR task failed: unknown error");
			markItemDone(state, taskId, false, "Unknown OCR task error");
		}
	});

	return taskId;
}

std::string TaskQueue::submitRebuildTask() {
	if (!impl_->aiPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }
	if (!EmbeddingModule::get().isAvailable()) { throw ApiException(ERR_EMBEDDING_NOT_READY, "Embedding unavailable"); }

	if (impl_->currentPending >= impl_->maxQueueSize) { throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full"); }

	std::string taskId = "rebuild-" + generateUUIDv4();
	auto        state  = std::make_shared<TaskState>();

	struct RebuildItem {
		int64_t     memeId;
		std::string ocrText;
		std::string desc;
	};

	std::vector<RebuildItem> rebuildItems;
	rebuildItems.reserve(128);

	int  batchSize = 100;
	int  offset    = 0;
	bool more      = true;
	while (more) {
		SearchQuery batchQuery;
		batchQuery.limit  = batchSize;
		batchQuery.offset = offset;
		auto  batchResults = Database::get().searchMemes(batchQuery);
		auto &batchMemes   = batchResults.items;

		if (batchMemes.empty()) {
			more = false;
			break;
		}

		for (const auto &meme : batchMemes) {
			rebuildItems.push_back({meme.id, meme.ocrText, meme.description});
			if (static_cast<int>(rebuildItems.size()) > impl_->maxQueueSize - impl_->currentPending.load()) {
				throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full");
			}
		}
		offset += batchSize;
	}

	state->totalItems = static_cast<int>(rebuildItems.size());
	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks[taskId] = state;
	}

	if (rebuildItems.empty()) {
		WsEvent doneEvent;
		doneEvent.event   = "task:complete";
		doneEvent.payload = {
		    {"taskId",    taskId},
		    {"status",    "done"},
		    {"total",     0},
		    {"succeeded", 0},
		    {"failed",    0},
		    {"errors",    std::vector<std::string>{}}
        };
		WsPusher::get().broadcast(doneEvent);
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks.erase(taskId);
		return taskId;
	}

	impl_->currentPending.fetch_add(state->totalItems);
	Database::get().rebuildEmbeddingTables(EmbeddingModule::get().getDimensions());

	int postedCount = 0;
	try {
		for (const auto &item : rebuildItems) {
			boost::asio::post(*impl_->aiPool, [this, it = std::move(item), taskId, state]() mutable {
				if (state->cancelled) {
					markItemDone(state, taskId, false, "Cancelled");
					return;
				}

				try {
					WsEvent progEvent;
					progEvent.event   = "task:progress";
					progEvent.payload = {
					    {"taskId", taskId},
					    {"status", "processing"},
					    {"memeId", it.memeId}
                    };
					WsPusher::get().broadcast(progEvent);

					if (!it.desc.empty()) {
						auto descEmbedding = EmbeddingModule::get().generateEmbedding(it.desc);
						if (!descEmbedding.empty()) {
							Database::get().upsertDescriptionEmbedding(it.memeId, descEmbedding);
						} else {
							Database::get().deleteDescriptionEmbedding(it.memeId);
						}
					} else {
						Database::get().deleteDescriptionEmbedding(it.memeId);
					}

					if (!it.ocrText.empty()) {
						auto ocrEmbedding = EmbeddingModule::get().generateEmbedding(it.ocrText);
						if (!ocrEmbedding.empty()) {
							Database::get().upsertOcrEmbedding(it.memeId, ocrEmbedding);
						} else {
							Database::get().deleteOcrEmbedding(it.memeId);
						}
					} else {
						Database::get().deleteOcrEmbedding(it.memeId);
					}

					markItemDone(state, taskId, true, "");
				} catch (const std::exception &e) {
					if (!it.desc.empty()) { Database::get().deleteDescriptionEmbedding(it.memeId); }
					if (!it.ocrText.empty()) { Database::get().deleteOcrEmbedding(it.memeId); }
					markItemDone(state, taskId, false, "Rebuild error: " + std::string(e.what()));
				} catch (...) { markItemDone(state, taskId, false, "Unknown rebuild error"); }
			});
			++postedCount;
		}
	} catch (...) {
		for (int i = postedCount; i < state->totalItems; ++i) {
			markItemDone(state, taskId, false, "Failed to enqueue rebuild task");
		}
		throw;
	}

	return taskId;
}

std::string TaskQueue::submitThumbnailTask(int64_t memeId) {
	if (!impl_->thumbPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }
	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		auto                        it = impl_->inflightThumbnailTasks.find(memeId);
		if (it != impl_->inflightThumbnailTasks.end()) { return it->second; }
	}

	std::string taskId = "thumb-" + std::to_string(memeId) + "-" + generateUUIDv4();
	auto        state  = std::make_shared<TaskState>();
	state->totalItems  = 1;

	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		auto                        it = impl_->inflightThumbnailTasks.find(memeId);
		if (it != impl_->inflightThumbnailTasks.end()) { return it->second; }
		impl_->activeTasks[taskId] = state;
		impl_->inflightThumbnailTasks[memeId] = taskId;
		impl_->inflightThumbnailByTask[taskId] = memeId;
	}

	impl_->currentPending++;
	boost::asio::post(*impl_->thumbPool, [this, memeId, taskId, state]() {
		if (state->cancelled) {
			markItemDone(state, taskId, false, "Cancelled");
			return;
		}

		try {
			auto                  meme        = Database::get().getMeme(memeId);
			std::filesystem::path storageRoot = impl_->storagePath.empty() ? std::filesystem::path("storage")
			                                                               : std::filesystem::path(impl_->storagePath);
			std::filesystem::path sourcePath  = storageRoot / std::filesystem::path(meme.filePath);
			std::filesystem::path thumbPath =
			    storageRoot / "thumbs" / std::filesystem::path(meme.filePath).parent_path() / (meme.fileHash + ".jpg");

			if (!std::filesystem::exists(thumbPath)) {
				int maxSize = 300;
				if (g_server) { maxSize = g_server->getConfig().thumbnailMaxSize; }
				if (!generateThumbnail(sourcePath.string(), thumbPath.string(), maxSize)) {
					throw ApiException(ERR_IO, "Failed to generate thumbnail");
				}
			}
			markItemDone(state, taskId, true, "");
		} catch (const std::exception &e) {
			markItemDone(state, taskId, false, "Thumbnail task error: " + std::string(e.what()));
		} catch (...) { markItemDone(state, taskId, false, "Unknown thumbnail task error"); }
	});

	return taskId;
}

bool TaskQueue::cancelTask(const std::string &taskId) {
	std::lock_guard<std::mutex> lock(impl_->tasksMutex);
	auto                        it = impl_->activeTasks.find(taskId);
	if (it != impl_->activeTasks.end() && !it->second->cancelled) {
		it->second->cancelled = true;
		LOG_INFO("queue", "Task " + taskId + " marked as cancelled");
		return true;
	}
	return false;
}

ImportTask TaskQueue::getTask(const std::string &taskId) {
	std::lock_guard<std::mutex> lock(impl_->tasksMutex);
	auto                        it = impl_->activeTasks.find(taskId);
	if (it == impl_->activeTasks.end()) {
		// In a real app, we might check a completed tasks history.
		// For now, return a generic failed/not found task or empty.
		ImportTask t;
		t.taskId = taskId;
		t.status = TaskStatus::FAILED;
		return t;
	}

	auto       state = it->second;
	ImportTask t;
	t.taskId    = taskId;
	t.total     = state->totalItems;
	t.processed = state->finishedItems.load();
	t.succeeded = state->succeededItems.load();
	t.failed    = state->failedItems.load();
	t.status    = state->cancelled ? TaskStatus::CANCELLED : TaskStatus::PROCESSING;
	if (t.processed >= t.total && t.total > 0) { t.status = TaskStatus::DONE; }

	std::lock_guard<std::mutex> errLock(state->errorsMutex);
	t.errors = state->errors;

	return t;
}

void TaskQueue::markItemDone(std::shared_ptr<TaskState> state,
                             const std::string         &taskId,
                             bool                       success,
                             const std::string         &errorMsg,
                             int                        errorCode) {
	if (success) {
		state->succeededItems++;
	} else {
		state->failedItems++;
		if (!errorMsg.empty()) {
			std::lock_guard<std::mutex> lock(state->errorsMutex);
			state->errors.push_back(errorMsg);
			WsEvent errEvent;
			errEvent.event   = "task:error";
			errEvent.payload = {
			    {"taskId",   taskId},
			    { "error", errorMsg}
            };
			if (errorCode != 0) {
				errEvent.payload["code"] = errorCode;
			}
			WsPusher::get().broadcast(errEvent);
		}
	}

	int finished = ++state->finishedItems;
	if (finished >= state->totalItems) {
		std::vector<std::string> errList;
		{
			std::lock_guard<std::mutex> lock(state->errorsMutex);
			errList = state->errors;
		}
		WsEvent doneEvent;
		doneEvent.event   = "task:complete";
		doneEvent.payload = {
		    {   "taskId",		               taskId},
		    {   "status",		               "done"},
		    {    "total",            state->totalItems},
		    {"succeeded", state->succeededItems.load()},
		    {   "failed",    state->failedItems.load()},
		    {   "errors",                      errList}
        };
		WsPusher::get().broadcast(doneEvent);

		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks.erase(taskId);
		auto thumbIt = impl_->inflightThumbnailByTask.find(taskId);
		if (thumbIt != impl_->inflightThumbnailByTask.end()) {
			impl_->inflightThumbnailTasks.erase(thumbIt->second);
			impl_->inflightThumbnailByTask.erase(thumbIt);
		}
	}
	impl_->currentPending--;
}

void TaskQueue::runProcessingPipeline(ImportPipeline pipeline, std::shared_ptr<TaskState> state) {
	LOG_INFO("queue", "1-Stage IO Pipeline started for: " + pipeline.inputPath);

	std::string actualPath       = pipeline.inputPath;
	bool        isTempDownloaded = false;

	// Check if it's a URL
	if (pipeline.inputPath.find("http://") == 0 || pipeline.inputPath.find("https://") == 0) {
		LOG_INFO("queue", "Downloading image from URL: " + pipeline.inputPath);
		auto downloadRes = downloadImageToTemp(pipeline.inputPath);
		if (downloadRes) {
			actualPath       = *downloadRes;
			isTempDownloaded = true;
		} else {
			LOG_ERROR("queue", "Failed to download image from URL: " + downloadRes.error());
			markItemDone(state, pipeline.taskId, false, "Failed to download image from URL: " + downloadRes.error());
			return;
		}
	}

	std::string hash;
	try {
		hash = computeHash(actualPath);
	} catch (const std::exception &e) {
		LOG_ERROR("queue", "Hash computation failed: " + std::string(e.what()));
		if (isTempDownloaded) std::filesystem::remove(actualPath);
		markItemDone(state, pipeline.taskId, false, "Hash computation failed: " + std::string(e.what()));
		return;
	}

	MemeEntry meme;
	meme.fileHash   = hash;
	meme.sourceName = pipeline.memeEntry.sourceName;
	meme.sourceUrl  = pipeline.memeEntry.sourceUrl;
	meme.mimeType   = detectMimeType(actualPath);
	if (std::filesystem::exists(actualPath)) {
		meme.fileSize = std::filesystem::file_size(actualPath);
	} else {
		if (isTempDownloaded) std::filesystem::remove(actualPath);
		markItemDone(state, pipeline.taskId, false, "File does not exist: " + actualPath);
		return;
	}

	auto size = readImageSize(actualPath);
	if (!size) {
		LOG_ERROR("queue", "Failed to read image size: " + actualPath);
		if (isTempDownloaded) std::filesystem::remove(actualPath);
		markItemDone(state, pipeline.taskId, false, "Failed to read image size: " + actualPath);
		return;
	}
	meme.width  = size->width;
	meme.height = size->height;

	auto     now   = std::chrono::system_clock::now();
	uint64_t nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
	meme.createdAt = nowMs;
	meme.updatedAt = nowMs;
	meme.deletedAt = 0;
	meme.ocrStatus = ProcessingStatus::PENDING;
	meme.aiStatus  = ProcessingStatus::PENDING;

	std::filesystem::path storageRoot = impl_->storagePath.empty() ? std::filesystem::path("storage")
	                                                               : std::filesystem::path(impl_->storagePath);

	auto    nowT = std::time(nullptr);
	std::tm tm{};
#ifdef _WIN32
	localtime_s(&tm, &nowT);
#else
	localtime_r(&nowT, &tm);
#endif

	char dirStr[16];
	std::strftime(dirStr, sizeof(dirStr), "%Y-%m", &tm);
	const std::filesystem::path relDir(dirStr);
	const std::filesystem::path fullDir = storageRoot / relDir;
	std::filesystem::create_directories(fullDir);

	std::string ext;
	if (meme.mimeType == "image/png")
		ext = ".png";
	else if (meme.mimeType == "image/gif")
		ext = ".gif";
	else if (meme.mimeType == "image/webp")
		ext = ".webp";
	else if (meme.mimeType == "image/avif")
		ext = ".avif";
	else
		ext = ".jpg";
	const std::string           pureHashName = hash + ext;
	const std::filesystem::path finalPath    = fullDir / pureHashName;
	meme.filePath                           = (relDir / pureHashName).generic_string();

	Database &db = Database::get();

	// 1. 先进行文件复制 (或移动以提升性能)
	const bool copied = copyFile(actualPath, finalPath.string());
	if (isTempDownloaded) std::filesystem::remove(actualPath);

	if (!copied) {
		LOG_ERROR("queue", "Failed to copy image to storage");
		markItemDone(state, pipeline.taskId, false, "Failed to copy image to storage");
		return;
	}

	// 2. 文件就绪后，再写入 DB
	try {
		meme.id = db.insertMeme(meme);
	} catch (const ApiException &e) {
		if (e.code() == ERR_DUPLICATE) {
			LOG_INFO("queue", "Meme already exists: " + hash);
			markItemDone(state, pipeline.taskId, false, "Meme already exists: " + hash, ERR_DUPLICATE);
			return;
		}
		// DB 写入失败，回滚物理文件
		std::error_code ec;
		std::filesystem::remove(finalPath, ec);
		LOG_ERROR("queue", "Failed to initially save DB record: " + std::string(e.what()));
		markItemDone(state, pipeline.taskId, false, "Failed to base DB record: " + std::string(e.what()));
		return;
	}

	// 异步生成缩略图，避免阻塞 IO 线程
	try {
		submitThumbnailTask(meme.id);
	} catch (const std::exception &e) {
		LOG_WARN("queue",
		         "Thumbnail scheduling skipped for meme " + std::to_string(meme.id) + ": " + std::string(e.what()));
	}

	WsEvent addedEvent;
	addedEvent.event   = "meme:added";
	addedEvent.payload = meme;
	WsPusher::get().broadcast(addedEvent);

	try {
		boost::asio::post(*impl_->aiPool, [this, memeId = meme.id, finalPath = finalPath.string(), taskId = pipeline.taskId, state]() {
			if (state->cancelled) {
				markItemDone(state, taskId, false, "Cancelled");
				return;
			}

			try {
				LOG_INFO("queue", "2-Stage AI Pipeline started for meme: " + std::to_string(memeId));

				WsEvent progEvent;
				progEvent.event   = "task:progress";
				progEvent.payload = {
				    {"taskId", taskId},
				    {"status", "processing"},
				    {"memeId", memeId}
                };
				WsPusher::get().broadcast(progEvent);

				VisionModule    &vision    = VisionModule::get();
				std::string      finalOcr  = "";
				ProcessingStatus ocrStatus = ProcessingStatus::SKIPPED;
				if (vision.isOcrAvailable()) {
					auto res = vision.recognize(finalPath);
					if (res.success) {
						finalOcr  = res.fullText;
						ocrStatus = ProcessingStatus::DONE;
					} else {
						ocrStatus = ProcessingStatus::FAILED;
					}
				}

				std::string      finalDesc = "";
				ProcessingStatus aiStatus  = ProcessingStatus::SKIPPED;
				if (vision.isAvailable()) {
					auto res = vision.analyzeImage(finalPath, finalOcr);
					if (res.success) {
						finalDesc = res.description;
						aiStatus  = ProcessingStatus::DONE;
					} else {
						aiStatus = ProcessingStatus::FAILED;
					}
				}

				Database &db = Database::get();
				db.updateMemeProcessing(memeId, ocrStatus, aiStatus, finalOcr, finalDesc);

				if (EmbeddingModule::get().isAvailable()) {
					try {
						if (!finalDesc.empty()) {
							auto descEmbedding = EmbeddingModule::get().generateEmbedding(finalDesc);
							if (!descEmbedding.empty()) {
								db.upsertDescriptionEmbedding(memeId, descEmbedding);
							} else {
								db.deleteDescriptionEmbedding(memeId);
							}
						} else {
							db.deleteDescriptionEmbedding(memeId);
						}

						if (!finalOcr.empty()) {
							auto ocrEmbedding = EmbeddingModule::get().generateEmbedding(finalOcr);
							if (!ocrEmbedding.empty()) {
								db.upsertOcrEmbedding(memeId, ocrEmbedding);
							} else {
								db.deleteOcrEmbedding(memeId);
							}
						} else {
							db.deleteOcrEmbedding(memeId);
						}
					} catch (const std::exception &e) {
						if (!finalDesc.empty()) { db.deleteDescriptionEmbedding(memeId); }
						if (!finalOcr.empty()) { db.deleteOcrEmbedding(memeId); }
						LOG_WARN("queue",
						         "Embedding refresh failed for meme " + std::to_string(memeId) +
						             ", deleted stale vectors: " + e.what());
					}
				}

				LOG_INFO("queue", "2-Stage Pipeline completed for meme: " + std::to_string(memeId));

				markItemDone(state, taskId, true, "");
			} catch (const std::exception &e) {
				LOG_ERROR("queue", "AI Pipeline error: " + std::string(e.what()));
				Database::get().updateMemeProcessing(memeId, ProcessingStatus::FAILED, ProcessingStatus::FAILED, "", "");
				markItemDone(state, taskId, false, "AI Pipeline error: " + std::string(e.what()));
			} catch (...) {
				LOG_ERROR("queue", "Unknown AI Pipeline error");
				Database::get().updateMemeProcessing(memeId, ProcessingStatus::FAILED, ProcessingStatus::FAILED, "", "");
				markItemDone(state, taskId, false, "Unknown AI Pipeline error");
			}
		});
	} catch (const std::exception &e) {
		db.deleteMeme(meme.id);
		std::error_code ec;
		std::filesystem::remove(finalPath, ec);
		LOG_ERROR("queue", "Failed to enqueue AI pipeline: " + std::string(e.what()));
		markItemDone(state, pipeline.taskId, false, "Failed to enqueue AI pipeline");
	}
}

} // namespace quickmemes
