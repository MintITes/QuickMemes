#include "core/task_queue.hpp"

#include "core/server.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"
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
#include <regex>
#include <sstream>
#include <thread>
#include <unordered_map>

extern std::unique_ptr<quickmemes::Server> g_server;

namespace quickmemes {

namespace {
bool downloadImageToTemp(const std::string &url, std::string &outPath) {
	std::regex  urlRegex(R"(^(https?)://([^/:]+)(?::(\d+))?(/.*)?$)");
	std::smatch match;
	if (!std::regex_match(url, match, urlRegex)) return false;

	std::string protocol = match[1];
	std::string host     = match[2];
	std::string port     = match[3].str().empty() ? (protocol == "https" ? "443" : "80") : match[3].str();
	std::string target   = match[4].str().empty() ? "/" : match[4].str();

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
						return false; // SSRF Protection
					}
				} else if (addr.is_v6()) {
					if (addr.to_v6().is_loopback() || addr.to_v6().is_link_local() || addr.to_v6().is_site_local() ||
					    addr.to_v6().is_multicast() || addr.to_v6().is_unspecified()) {
						return false;
					}
				}
			}

			boost::beast::http::request<boost::beast::http::empty_body> req{boost::beast::http::verb::get, target, 11};
			req.set(boost::beast::http::field::host, host);
			req.set(boost::beast::http::field::user_agent, randomUA);

			// 修复内存耗尽风险：为 string_body 添加响应体大小限制（10MB）
			constexpr size_t                                                     kMaxBody = 10 * 1024 * 1024; // 10 MB
			boost::beast::http::response_parser<boost::beast::http::string_body> parser;
			parser.body_limit(kMaxBody);

			if (protocol == "https") {
				boost::asio::ssl::context ctx(boost::asio::ssl::context::tlsv12_client);
				ctx.set_default_verify_paths();
				ctx.set_verify_mode(boost::asio::ssl::verify_peer);
				boost::beast::ssl_stream<boost::beast::tcp_stream> stream(ioc, ctx);
				if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str())) return false;

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
				if (attempt < maxRetries - 1) {
					std::this_thread::sleep_for(std::chrono::seconds(1));
					continue;
				}
				return false;
			}

			std::string       tempTemplate = (std::filesystem::temp_directory_path() / "qmdl_XXXXXX").string();
			std::vector<char> tempTpl(tempTemplate.begin(), tempTemplate.end());
			tempTpl.push_back('\0');

			int fd = mkstemp(tempTpl.data());
			if (fd == -1) return false;
			close(fd);

			std::ofstream ofs(tempTpl.data(), std::ios::binary);
			ofs << res.body();
			ofs.close();

			outPath = tempTpl.data();
			return true;
		} catch (...) {
			if (attempt < maxRetries - 1) {
				std::this_thread::sleep_for(std::chrono::seconds(1));
				continue;
			}
		}
	}
	return false;
}

std::string generateUUIDv4() {
	thread_local boost::uuids::random_generator generator;
	return boost::uuids::to_string(generator());
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
	if (impl_->ioPool) {
		LOG_INFO("queue", "Shutting down TaskQueue with timeout...");

		// 改进后的安全退出逻辑：
		// 1. 发起等待线程，负责在后台调用各池的 join()
		// 2. detach 等待线程，不阻塞主关机流程
		// 3. 给出宽限期，随后强制 stop() 以防任务挂起

		std::thread waiter([this]() {
			if (impl_->ioPool) impl_->ioPool->join();
			if (impl_->aiPool) impl_->aiPool->join();
			if (impl_->thumbPool) impl_->thumbPool->join();
		});

		waiter.detach();

		// 真正解决 Hanging 的办法是：直接调用 stop() 强制取消积压任务，
		// 然后通过 reset() 释放资源。

		// 我们给任务一小段宽限期（例如 3s）来尝试自然完成
		std::this_thread::sleep_for(std::chrono::seconds(3));

		LOG_INFO("queue", "Forcing TaskQueue pools to stop to prevent hanging.");
		if (impl_->ioPool) impl_->ioPool->stop();
		if (impl_->aiPool) impl_->aiPool->stop();
		if (impl_->thumbPool) impl_->thumbPool->stop();

		impl_->ioPool.reset();
		impl_->aiPool.reset();
		impl_->thumbPool.reset();

		LOG_INFO("queue", "TaskQueue shutdown completed.");
	}
}

const std::string &TaskQueue::getStoragePath() const {
	return impl_->storagePath;
}

std::string TaskQueue::submitImportTask(const ImportRequest &request) {
	if (!impl_->ioPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }

	std::string taskId = generateUUIDv4();

	if (impl_->currentPending >= impl_->maxQueueSize) {
		// 发送符合规范的 task:error 推送
		WsEvent errEvent;
		errEvent.event   = "task:error";
		errEvent.payload = {
		    {"taskId",               taskId},
		    { "error", "Task queue is full"}
        };
		WsPusher::get().broadcast(errEvent);

		throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full");
	}

	auto state        = std::make_shared<TaskState>();
	state->totalItems = request.inputs.size();

	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks[taskId] = state;
	}

	// 修复任务队列容量穿透：先计算批量大小，确保总数不超限
	if (impl_->currentPending + static_cast<int>(request.inputs.size()) > impl_->maxQueueSize) {
		WsEvent errEvent;
		errEvent.event   = "task:error";
		errEvent.payload = {
		    {"taskId",		                         taskId},
		    { "error", "Task queue is full (batch too large)"}
        };
		WsPusher::get().broadcast(errEvent);
		throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full (batch too large)");
	}

	for (const auto &inputStr : request.inputs) {
		impl_->currentPending++;

		ImportPipeline pipeline;
		pipeline.taskId               = taskId;
		pipeline.inputPath            = inputStr;
		pipeline.memeEntry.sourceName = request.options.sourceName;
		pipeline.memeEntry.sourceUrl  = request.options.sourceUrl;

		boost::asio::post(*impl_->ioPool, [this, pipeline, state]() {
			if (state->cancelled) {
				markItemDone(state, pipeline.taskId, false, "Cancelled");
				return;
			}

			try {
				runProcessingPipeline(pipeline, state);
			} catch (const std::exception &e) {
				LOG_ERROR("queue", "Pipeline IO error: " + std::string(e.what()));
				markItemDone(state, pipeline.taskId, false, "Pipeline IO error: " + std::string(e.what()));
			} catch (...) { markItemDone(state, pipeline.taskId, false, "Unknown pipeline error"); }
		});
	}

	return taskId;
}

std::string TaskQueue::submitRebuildTask() {
	if (!impl_->aiPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }

	if (impl_->currentPending >= impl_->maxQueueSize) { throw ApiException(ERR_QUOTA_EXCEEDED, "Task queue is full"); }

	std::string taskId = "rebuild-" + generateUUIDv4();

	auto state = std::make_shared<TaskState>();

	// Use batching to avoid OOM for large datasets
	int  batchSize     = 100;
	int  offset        = 0;
	bool more          = true;
	int  totalEnqueued = 0;

	while (more) {
		SearchQuery batchQuery;
		batchQuery.limit   = batchSize;
		batchQuery.offset  = offset;
		auto  batchResults = Database::get().searchMemes(batchQuery);
		auto &batchMemes   = batchResults.items;

		if (batchMemes.empty()) {
			more = false;
			break;
		}

		for (const auto &meme : batchMemes) {
			impl_->currentPending++;
			totalEnqueued++;

			boost::asio::post(
			    *impl_->aiPool,
			    [this, memeId = meme.id, ocrText = meme.ocrText, desc = meme.description, taskId, state]() {
				    if (state->cancelled) {
					    markItemDone(state, taskId, false, "Cancelled");
					    return;
				    }

				    try {
					    WsEvent progEvent;
					    progEvent.event   = "task:progress";
					    progEvent.payload = {
					        {"taskId",       taskId},
					        {"status", "processing"},
					        {"memeId",       memeId}
                        };
					    WsPusher::get().broadcast(progEvent);

					    if (VisionModule::get().isAvailable()) {
						    auto embedVector = VisionModule::get().generateEmbedding(ocrText + " " + desc);
						    if (!embedVector.empty()) { Database::get().upsertEmbedding(memeId, embedVector); }
					    }

					    markItemDone(state, taskId, true, "");
				    } catch (const std::exception &e) {
					    markItemDone(state, taskId, false, "Rebuild error: " + std::string(e.what()));
				    } catch (...) { markItemDone(state, taskId, false, "Unknown rebuild error"); }
			    });
		}
		offset += batchSize;
	}
	state->totalItems = totalEnqueued;

	if (totalEnqueued == 0) { markItemDone(state, taskId, true, ""); }

	return taskId;
}

std::string TaskQueue::submitThumbnailTask(int64_t memeId) {
	if (!impl_->ioPool) { throw ApiException(ERR_INTERNAL, "TaskQueue not initialized"); }

	std::string taskId = "thumb-" + std::to_string(memeId) + "-" + generateUUIDv4();
	auto        state  = std::make_shared<TaskState>();
	state->totalItems  = 1;

	{
		std::lock_guard<std::mutex> lock(impl_->tasksMutex);
		impl_->activeTasks[taskId] = state;
	}

	impl_->currentPending++;
	boost::asio::post(*impl_->thumbPool, [this, memeId, taskId, state]() {
		if (state->cancelled) {
			markItemDone(state, taskId, false, "Cancelled");
			return;
		}

		try {
			auto        meme        = Database::get().getMeme(memeId);
			std::string storageRoot = impl_->storagePath;
			if (storageRoot.empty()) storageRoot = "storage";
			if (storageRoot.back() != '/') storageRoot += '/';

			auto        posSlash = meme.filePath.find('/');
			std::string relDir   = "";
			if (posSlash != std::string::npos) { relDir = meme.filePath.substr(0, posSlash + 1); }

			std::string thumbDir = storageRoot + "thumbs/" + relDir;
			std::filesystem::create_directories(thumbDir);
			std::string thumbPath = thumbDir + meme.fileHash + ".jpg";

			if (!std::filesystem::exists(thumbPath)) {
				int maxSize = 300;
				if (g_server) { maxSize = g_server->getConfig().thumbnailMaxSize; }
				generateThumbnail(storageRoot + meme.filePath, thumbPath, maxSize);
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
                             const std::string         &errorMsg) {
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
		std::string tempPath;
		if (downloadImageToTemp(pipeline.inputPath, tempPath)) {
			actualPath       = tempPath;
			isTempDownloaded = true;
		} else {
			LOG_ERROR("queue", "Failed to download image from URL");
			markItemDone(state, pipeline.taskId, false, "Failed to download image from URL");
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

	auto s      = readImageSize(actualPath);
	meme.width  = s.width;
	meme.height = s.height;

	auto     now   = std::chrono::system_clock::now();
	uint64_t nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
	meme.createdAt = nowMs;
	meme.updatedAt = nowMs;
	meme.deletedAt = 0;
	meme.ocrStatus = ProcessingStatus::PENDING;
	meme.aiStatus  = ProcessingStatus::PENDING;

	std::string storageRoot = impl_->storagePath;
	if (storageRoot.empty()) storageRoot = "storage";
	if (storageRoot.back() != '/') storageRoot += '/';

	auto    nowT = std::time(nullptr);
	std::tm tm{};
#ifdef _WIN32
	localtime_s(&tm, &nowT);
#else
	localtime_r(&nowT, &tm);
#endif

	char dirStr[16];
	std::strftime(dirStr, sizeof(dirStr), "%Y-%m", &tm);
	std::string relDir  = std::string(dirStr) + "/";
	std::string fullDir = storageRoot + relDir;
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
	std::string pureHashName = hash + ext;
	std::string finalPath    = fullDir + pureHashName;
	meme.filePath            = relDir + pureHashName;

	Database &db = Database::get();
	try {
		meme.id = db.insertMeme(meme);
	} catch (const ApiException &e) {
		if (e.code() == ERR_DUPLICATE) {
			LOG_INFO("queue", "Meme already exists: " + hash);
			if (isTempDownloaded) std::filesystem::remove(actualPath);
			markItemDone(state, pipeline.taskId, false, "Meme already exists: " + hash);
			return;
		}
		LOG_ERROR("queue", "Failed to initially save DB record: " + std::string(e.what()));
		if (isTempDownloaded) std::filesystem::remove(actualPath);
		markItemDone(state, pipeline.taskId, false, "Failed to base DB record: " + std::string(e.what()));
		return;
	}

	try {
		copyFile(actualPath, finalPath);
		if (isTempDownloaded) std::filesystem::remove(actualPath);
	} catch (...) {
		LOG_WARN("queue", "Failed to copy image to final storage");
		if (isTempDownloaded) std::filesystem::remove(actualPath);
	}

	// 异步生成缩略图，避免阻塞 IO 线程
	submitThumbnailTask(meme.id);

	WsEvent addedEvent;
	addedEvent.event   = "meme:added";
	addedEvent.payload = meme;
	WsPusher::get().broadcast(addedEvent);

	boost::asio::post(*impl_->aiPool, [this, memeId = meme.id, finalPath, taskId = pipeline.taskId, state]() {
		if (state->cancelled) {
			markItemDone(state, taskId, false, "Cancelled");
			return;
		}

		try {
			LOG_INFO("queue", "2-Stage AI Pipeline started for meme: " + std::to_string(memeId));

			WsEvent progEvent;
			progEvent.event   = "task:progress";
			progEvent.payload = {
			    {"taskId",       taskId},
			    {"status", "processing"},
			    {"memeId",       memeId}
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

			if (vision.isAvailable() && !finalDesc.empty()) {
				auto embedVector = vision.generateEmbedding(finalOcr + " " + finalDesc);
				if (!embedVector.empty()) { db.upsertEmbedding(memeId, embedVector); }
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
}

} // namespace quickmemes
