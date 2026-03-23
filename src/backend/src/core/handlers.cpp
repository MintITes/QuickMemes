#include "core/handlers.hpp"

#include "core/router.hpp"
#include "core/server.hpp"
#include "core/task_queue.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"
#include "embedding/embedding.hpp"
#include "utils/file_utils.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <algorithm>
#include <chrono>
#include <filesystem>
#include <iostream>
#include <map>
#include <nlohmann/json.hpp>
#include <regex>
#include <string>
#include <vector>

extern std::unique_ptr<quickmemes::Server> g_server; // declared in main.cpp

namespace quickmemes {

namespace {
template <typename T> std::string makeSuccessResponse(const T &data) {
	ApiResponse<T> resp;
	resp.success     = true;
	resp.data        = data;
	resp.error       = "";
	resp.code        = 0;
	nlohmann::json j = resp;
	return j.dump();
}

std::string makeErrorResponse(int code, const std::string &error) {
	ApiResponse<std::nullptr_t> resp;
	resp.success     = false;
	resp.data        = nullptr;
	resp.error       = error;
	resp.code        = code;
	nlohmann::json j = resp;
	return j.dump();
}
} // namespace

void handleGetHealth(const HttpRequestProxy &req, HttpResponseProxy &res) {
	(void)req;

	HealthStatus data;
	data.status         = "ok";
	data.modules.db     = Database::get().checkIntegrity();
	data.modules.vision = VisionModule::get().isAvailable();

	if (!data.modules.db || !data.modules.vision) { data.status = "degraded"; }

	res.status = 200;
	res.body   = makeSuccessResponse(data);
}

void handlePostImport(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto importReq = nlohmann::json::parse(req.body).get<ImportRequest>();

		std::string taskId = TaskQueue::get().submitImportTask(importReq);
		auto        now    = std::chrono::system_clock::now();
		auto        task   = ImportTask{};
		task.taskId        = taskId;
		task.source        = importReq.source;
		task.inputs        = importReq.inputs;
		task.status        = TaskStatus::PENDING;
		task.total         = static_cast<int32_t>(importReq.inputs.size());
		task.processed     = 0;
		task.succeeded     = 0;
		task.failed        = 0;
		task.createdAt     = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

		res.status = 200; // Standardized to 200 OK
		res.body   = makeSuccessResponse(task);

	} catch (const ApiException &e) {
		LOG_WARN("handlers", "Import error: " + std::string(e.what()));
		res.status = (e.code() == ERR_QUOTA_EXCEEDED) ? 429 : 400;
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Bad JSON");
	}
}

void handlePostImportCancel(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto        j      = nlohmann::json::parse(req.body);
		std::string taskId = j.value("taskId", "");

		bool success = TaskQueue::get().cancelTask(taskId);
		if (success) {
			nlohmann::json data = {
			    {"success", true}
            };
			res.status = 200;
			res.body   = makeSuccessResponse(data);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Task not found or already completed");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Bad JSON");
	}
}

void handlePostMemesSearch(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto query = nlohmann::json::parse(req.body).get<SearchQuery>();
		// TODO: 搜索算法重构时，用 description / OCR 双向量检索重新接入 embedding 搜索。

		auto    dbResults      = Database::get().searchMemes(query);
		auto   &keywordResults = dbResults.items;
		int32_t total          = dbResults.totalCount;

		SearchResult data;
		for (const auto &meme : keywordResults) {
			SearchResultItem item;
			item.meme = meme; // Use full meme and let json handle it (it won't include tags unless specified)
			item.similarityScore = -1.0f;
			data.items.push_back(item);
		}
		data.total = total;
		res.status = 200;
		res.body   = makeSuccessResponse(data);

	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Bad JSON or Search Error");
	}
}

void handleGetMeme(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto pos = req.path.find_last_of('/');
		if (pos == std::string::npos || pos == req.path.size() - 1) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(req.path.substr(pos + 1));

		auto meme  = Database::get().getMeme(id);
		res.status = 200;
		res.body   = makeSuccessResponse(meme);
	} catch (const ApiException &e) {
		res.status = (e.code() == ERR_NOT_FOUND) ? 404 : 500;
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid ID");
	}
}

void handlePutMeme(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto    pos = req.path.find_last_of('/');
		int64_t id  = std::stoll(req.path.substr(pos + 1));

		auto patch = nlohmann::json::parse(req.body).get<MemePatch>();

		bool success = Database::get().updateMeme(id, patch);
		if (success) {
			if (patch.description && EmbeddingModule::get().isAvailable()) {
				try {
					auto description = *patch.description;
					if (description.empty()) {
						Database::get().deleteDescriptionEmbedding(id);
					} else {
						auto embedding = EmbeddingModule::get().generateEmbedding(description);
						if (!embedding.empty()) {
							Database::get().upsertDescriptionEmbedding(id, embedding);
						} else {
							Database::get().deleteDescriptionEmbedding(id);
						}
					}
				} catch (const std::exception &e) {
					Database::get().deleteDescriptionEmbedding(id);
					LOG_WARN("handlers",
					         "Failed to refresh description embedding for meme " + std::to_string(id) +
					             ", deleted stale vector: " + e.what());
				}
			}
			auto meme = Database::get().getMeme(id);
			WsPusher::get().broadcast({"meme:updated", meme});
			res.status = 200;
			res.body   = makeSuccessResponse(meme);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Update failed or Not Found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePostMemeUse(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(^/api/memes?/(\d+)/use/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(match[1].str());

		bool ok = Database::get().updateMemeLastUsed(id);
		if (ok) {
			auto now   = std::chrono::system_clock::now();
			auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

			// Broadcast event
			WsPusher::get().broadcast({
			    "meme:used",
			    {{"id", id}, {"lastUsedAt", static_cast<int64_t>(nowMs)}}
            });

			res.status = 200;
			res.body   = makeSuccessResponse(nlohmann::json{
			    {   "success",                        true},
			    {"lastUsedAt", static_cast<int64_t>(nowMs)}
            });
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Meme not found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePostMemeOcr(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(^/api/memes?/(\d+)/ocr/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(match[1].str());

		if (!VisionModule::get().isOcrAvailable()) {
			res.status = 503;
			res.body   = makeErrorResponse(ERR_OCR_NOT_READY, "OCR unavailable");
			return;
		}

		std::string    taskId = TaskQueue::get().submitMemeOcrTask(id);
		nlohmann::json data   = {
		    {"taskId", taskId}
        };
		res.status = 200;
		res.body   = makeSuccessResponse(data);
	} catch (const ApiException &e) {
		res.status = (e.code() == ERR_NOT_FOUND) ? 404 : (e.code() == ERR_OCR_NOT_READY ? 503 : 400);
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleGetMemeFile(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(^/api/memes?/(\d+)/file/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(match[1].str());

		auto meme = Database::get().getMeme(id);
		if (meme.filePath.find("..") != std::string::npos) {
			throw ApiException(ERR_INVALID_PARAMS, "Invalid file path in database");
		}

		std::string storageRoot = TaskQueue::get().getStoragePath();
		if (storageRoot.empty()) storageRoot = "storage";

		std::filesystem::path rootPath = std::filesystem::absolute(storageRoot);
		std::filesystem::path filePath = rootPath / meme.filePath;

		try {
			filePath = std::filesystem::weakly_canonical(filePath);
		} catch (...) { throw ApiException(ERR_IO, "Invalid path resolution"); }

		// Ensure the file is inside the storage root
		// 修复路径穿越：确保 rootStr 尾部带 /，防止 /storage_evil/ 等同级目录前缀匹配绕过
		auto rootStr = rootPath.string();
		if (!rootStr.empty() && rootStr.back() != '/') rootStr += '/';
		auto fileStr = filePath.string();
		if (fileStr.length() < rootStr.length() || fileStr.substr(0, rootStr.length()) != rootStr) {
			LOG_ERROR("security", "Path traversal attempt detected: " + fileStr);
			throw ApiException(ERR_INVALID_PARAMS, "Invalid file access");
		}

		std::string fullPath = fileStr;

		// 异步生成缩略图（若缺失且启用）
		if (g_server && g_server->getConfig().thumbnailEnabled) {
			auto        posSlash = meme.filePath.find('/');
			std::string relDir   = "";
			if (posSlash != std::string::npos) { relDir = meme.filePath.substr(0, posSlash + 1); }
			std::string thumbPath = storageRoot + "thumbs/" + relDir + meme.fileHash + ".jpg";
			if (!std::filesystem::exists(thumbPath)) { TaskQueue::get().submitThumbnailTask(id); }
		}

		res.filePath    = fullPath;
		res.contentType = meme.mimeType;
		res.status      = 200;
	} catch (const ApiException &e) {
		res.status = (e.code() == ERR_NOT_FOUND) ? 404 : 500;
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleGetMemeThumbnail(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(^/api/memes?/(\d+)/thumbnail/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(match[1].str());

		auto meme = Database::get().getMeme(id);
		if (meme.filePath.find("..") != std::string::npos) {
			throw ApiException(ERR_INVALID_PARAMS, "Invalid file path in database");
		}

		std::string storageRoot = TaskQueue::get().getStoragePath();
		if (storageRoot.empty()) storageRoot = "storage";

		std::filesystem::path rootPath = std::filesystem::absolute(storageRoot);

		auto        posSlash = meme.filePath.find('/');
		std::string relDir   = "";
		if (posSlash != std::string::npos) { relDir = meme.filePath.substr(0, posSlash + 1); }

		std::filesystem::path thumbPath = rootPath / "thumbs" / relDir / (meme.fileHash + ".jpg");
		try {
			thumbPath = std::filesystem::weakly_canonical(thumbPath);
		} catch (...) { throw ApiException(ERR_IO, "Invalid thumb resolution"); }

		// Security Check
		// 修复路径穿越：确保 rootStr 尾部带 /，防止同级目录名前缀匹配绕过
		auto rootStr = rootPath.string();
		if (!rootStr.empty() && rootStr.back() != '/') rootStr += '/';
		auto thumbStr = thumbPath.string();
		if (thumbStr.length() < rootStr.length() || thumbStr.substr(0, rootStr.length()) != rootStr) {
			LOG_ERROR("security", "Thumb path traversal attempt: " + thumbStr);
			throw ApiException(ERR_INVALID_PARAMS, "Invalid thumb access");
		}

		if (!std::filesystem::exists(thumbPath)) {
			// 如果缩略图不存在，且启用了生成功能，则提交异步任务
			if (g_server && g_server->getConfig().thumbnailEnabled) { TaskQueue::get().submitThumbnailTask(id); }
			// 策略优化：缺失缩略图时立即返回原图作为替代，不阻塞 HTTP 线程
			std::filesystem::path originalPath = rootPath / meme.filePath;
			if (std::filesystem::exists(originalPath)) {
				res.filePath    = originalPath.string();
				res.contentType = meme.mimeType;
			} else {
				throw ApiException(ERR_NOT_FOUND, "Original meme file missing");
			}
		} else {
			res.filePath    = thumbStr;
			res.contentType = "image/jpeg";
		}
		res.status = 200;
	} catch (const ApiException &e) {
		res.status = (e.code() == ERR_NOT_FOUND) ? 404 : 500;
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePostTags(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto tag = nlohmann::json::parse(req.body).get<Tag>();
		if (tag.color.empty()) tag.color = "#000000";
		if (tag.name.empty()) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Tag name required");
			return;
		}

		tag.id = Database::get().insertTag(tag);

		// Broadcast event
		WsPusher::get().broadcast({"tag:created", tag});

		res.status = 201;
		res.body   = makeSuccessResponse(tag);
	} catch (const ApiException &e) {
		res.status = 409;
		res.body   = makeErrorResponse(e.code(), e.what());
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Bad JSON");
	}
}

void handleGetTags(const HttpRequestProxy &req, HttpResponseProxy &res) {
	(void)req;
	try {
		auto tags  = Database::get().getTags();
		res.status = 200;
		res.body   = makeSuccessResponse(tags);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 500;
		res.body   = makeErrorResponse(ERR_INTERNAL, "DB Error");
	}
}

void handleDeleteTag(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto pos = req.path.find_last_of('/');
		if (pos == std::string::npos || pos == req.path.size() - 1) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(req.path.substr(pos + 1));

		bool ok = Database::get().deleteTag(id);
		if (ok) {
			WsPusher::get().broadcast({"tag:deleted", {{"id", id}}});
			res.status = 200;
			res.body   = makeSuccessResponse(nullptr);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Tag not found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid ID");
	}
}

void handlePostMemeTags(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(/(\d+)/tags/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("Invalid path format for importing tags");
		}
		int64_t id = std::stoll(match[1].str());

		auto    j     = nlohmann::json::parse(req.body);
		int64_t tagId = j.value("tagId", 0LL);

		bool ok = Database::get().addMemeTag(id, tagId);
		if (ok) {
			res.status = 200;
			res.body   = makeSuccessResponse(nullptr);
		} else {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Failed to add tag");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleDeleteMemeTags(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(/(\d+)/tags/(\d+)/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 3) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid path format for tag deletion");
			return;
		}

		int64_t id    = std::stoll(match[1].str());
		int64_t tagId = std::stoll(match[2].str());

		bool ok = Database::get().removeMemeTag(id, tagId);
		if (ok) {
			res.status = 200;
			res.body   = makeSuccessResponse(nullptr);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Not found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid params");
	}
}

void handlePostExport(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto exportReq = nlohmann::json::parse(req.body).get<ExportRequest>();
		if (exportReq.memeIds.empty()) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "memeIds required");
			return;
		}

		std::string           destDir = exportReq.destDir;
		const char           *homeEnv = std::getenv("HOME");
		std::filesystem::path homeDir = homeEnv ? std::filesystem::path(homeEnv) : std::filesystem::current_path();

		// 如果未指定路径，强制使用默认路径
		if (destDir.empty()) { destDir = (homeDir / "Downloads" / "QuickMemes").string(); }

		// 处理 ~ 符号
		if (destDir.starts_with("~/")) {
			destDir = (homeDir / destDir.substr(2)).string();
		} else if (destDir == "~") {
			destDir = homeDir.string();
		}

		// 路径规范化
		std::filesystem::path p(destDir);
		try {
			if (std::filesystem::exists(p)) {
				destDir = std::filesystem::canonical(p).string();
			} else {
				destDir = std::filesystem::weakly_canonical(p).string();
			}
		} catch (...) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid export path");
			return;
		}

		if (!std::filesystem::path(destDir).is_absolute()) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Export path must be absolute");
			return;
		}

		// 白名单校验：必须在用户主目录下
		// 修复路径穿越：确保 homeStr 尾部带 /，防止 /home/user_evil/ 等路径绕过
		std::string homeStr = homeDir.string();
		if (!homeStr.empty() && homeStr.back() != '/') homeStr += '/';
		if (!destDir.starts_with(homeStr)) {
			LOG_ERROR("security", "Export path outside home directory blocked: " + destDir);
			res.status = 403;
			res.body   = makeErrorResponse(ERR_INTERNAL, "Export only allowed within home directory for security");
			return;
		}

		if (destDir.back() != '/' && destDir.back() != '\\') destDir += "/";

		std::filesystem::create_directories(destDir);

		ExportResult data;

		std::string storageRoot = TaskQueue::get().getStoragePath();
		if (storageRoot.empty()) storageRoot = "storage";

		std::filesystem::path rootPath = std::filesystem::absolute(storageRoot);

		for (int64_t id : exportReq.memeIds) {
			try {
				auto meme = Database::get().getMeme(id);
				if (meme.deletedAt > 0) {
					data.failed++;
					data.errors.push_back("Cannot export softly deleted meme " + std::to_string(id));
					continue;
				}

				std::string srcPath = (rootPath / meme.filePath).string();

				std::string destFileName;
				if (exportReq.keepNames && !meme.name.empty()) {
					destFileName = meme.name;
					// Sanitize name: remove any path separators or ".."
					destFileName.erase(std::remove(destFileName.begin(), destFileName.end(), '/'), destFileName.end());
					destFileName.erase(std::remove(destFileName.begin(), destFileName.end(), '\\'), destFileName.end());
					if (destFileName == ".." || destFileName == ".") destFileName = "meme_" + std::to_string(id);

					auto posExt = srcPath.find_last_of('.');
					if (posExt != std::string::npos && destFileName.find('.') == std::string::npos) {
						destFileName += srcPath.substr(posExt);
					}
				} else {
					auto        posExt = srcPath.find_last_of('.');
					std::string ext    = "";
					if (posExt != std::string::npos) ext = srcPath.substr(posExt);
					destFileName = std::to_string(id) + ext;
				}

				std::filesystem::path fullDestPath = std::filesystem::path(destDir) / destFileName;
				if (copyFile(srcPath, fullDestPath.string())) {
					data.succeeded++;
				} else {
					data.failed++;
					data.errors.push_back("Copy failed for " + std::to_string(id));
				}
			} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
				data.failed++;
				data.errors.push_back("Not found id " + std::to_string(id));
			}
		}

		res.status = 200;
		res.body   = makeSuccessResponse(data);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePostMemeRestore(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		std::regex  re(R"(^/api/memes?/(\d+)/restore/?$)");
		std::smatch match;
		if (!std::regex_search(req.path, match, re) || match.size() < 2) {
			throw std::invalid_argument("ID not found in path");
		}
		int64_t id = std::stoll(match[1].str());

		bool ok = Database::get().restoreMeme(id);
		if (ok) {
			auto meme  = Database::get().getMeme(id);
			res.status = 200;
			res.body   = makeSuccessResponse(meme);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Meme not found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleDeleteTrashPurge(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		int retentionDays = 30;
		if (g_server) { retentionDays = g_server->getConfig().recycleBinRetentionDays; }

		// Allow manual override via query param: ?olderThanDays=0
		if (!req.query.empty()) {
			auto pos = req.query.find("olderThanDays=");
			if (pos != std::string::npos) {
				try {
					retentionDays = std::stoi(req.query.substr(pos + 14));
				} catch (...) {}
			}
		}

		int            deleted = Database::get().purgeDeletedMemes(retentionDays);
		nlohmann::json data    = {
		    {"purged", deleted}
        };
		res.status = 200;
		res.body   = makeSuccessResponse(data);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 500;
		res.body   = makeErrorResponse(ERR_INTERNAL, "Purge Failed");
	}
}

void handleDeleteMeme(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto    pos = req.path.find_last_of('/');
		int64_t id  = std::stoll(req.path.substr(pos + 1));

		bool ok = Database::get().softDeleteMeme(id);
		if (ok) {
			WsPusher::get().broadcast({"meme:deleted", {{"id", id}}});
			res.status = 200;
			res.body   = makeSuccessResponse(nullptr);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Not found");
		}
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePatchConfig(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto patch = nlohmann::json::parse(req.body).get<RuntimeConfigPatch>();
		if (g_server) {
			ServerConfig config  = g_server->getConfig();
			bool         changed = false;
			bool         embeddingChanged = false;
			bool         embeddingDimensionsChanged = false;

			if (patch.logMinLevel) { Logger::get().setMinLevel(logLevelFromString(*patch.logMinLevel)); }
			if (patch.aiApiKey) {
				config.visionConfig.apiKey = *patch.aiApiKey;
				changed                    = true;
				LOG_INFO("handlers", "Patching config: aiApiKey changed to " + *patch.aiApiKey);
			}
			if (patch.aiApiBaseUrl) {
				config.visionConfig.apiBaseUrl = *patch.aiApiBaseUrl;
				changed                        = true;
			}
			if (patch.aiVisionModel) {
				config.visionConfig.visionModel = *patch.aiVisionModel;
				changed                         = true;
			}
			if (patch.aiTimeoutSeconds) {
				config.visionConfig.timeoutSeconds = *patch.aiTimeoutSeconds;
				changed                            = true;
			}
			if (patch.aiMaxRetries) {
				config.visionConfig.maxRetries = *patch.aiMaxRetries;
				changed                        = true;
			}
			if (patch.ocrApiKey) {
				config.visionConfig.ocrApiKey = *patch.ocrApiKey;
				changed                       = true;
			}
			if (patch.ocrApiUrl) {
				config.visionConfig.ocrApiUrl = *patch.ocrApiUrl;
				changed                       = true;
			}
			if (patch.ocrProvider) {
				config.visionConfig.ocrProvider = *patch.ocrProvider;
				changed                         = true;
			}
			if (patch.embeddingProvider) {
				config.embeddingConfig.provider = *patch.embeddingProvider;
				changed                         = true;
				embeddingChanged                = true;
			}
			if (patch.embeddingModel) {
				config.embeddingConfig.model = *patch.embeddingModel;
				changed                      = true;
				embeddingChanged             = true;
			}
			if (patch.embeddingApiUrl) {
				config.embeddingConfig.apiUrl = *patch.embeddingApiUrl;
				changed                       = true;
				embeddingChanged              = true;
			}
			if (patch.embeddingApiKey) {
				config.embeddingConfig.apiKey = *patch.embeddingApiKey;
				changed                       = true;
				embeddingChanged              = true;
			}
			if (patch.embeddingDimensions) {
				config.embeddingConfig.dimensions = *patch.embeddingDimensions;
				changed                           = true;
				embeddingChanged                  = true;
				embeddingDimensionsChanged        = true;
			}
			if (patch.embeddingTimeoutSeconds) {
				config.embeddingConfig.timeoutSeconds = *patch.embeddingTimeoutSeconds;
				changed                               = true;
				embeddingChanged                      = true;
			}
			if (patch.embeddingMaxRetries) {
				config.embeddingConfig.maxRetries = *patch.embeddingMaxRetries;
				changed                           = true;
				embeddingChanged                  = true;
			}

			if (changed) {
				VisionModule::get().reconfigure(config.visionConfig);
				if (embeddingChanged) {
					EmbeddingModule::get().reconfigure(config.embeddingConfig);
					config.embeddingConfig = EmbeddingModule::get().getConfig();
					if (embeddingDimensionsChanged) {
						Database::get().rebuildEmbeddingTables(EmbeddingModule::get().getDimensions());
					}
				}
				g_server->updateConfig(config);
			}
		}
		res.status = 200;
		res.body   = makeSuccessResponse(nullptr);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid JSON");
	}
}

void handleDeleteMemesBatch(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto j = nlohmann::json::parse(req.body);
		if (!j.contains("ids") || !j["ids"].is_array()) { throw std::invalid_argument("ids array missing"); }
		BatchResult data;
		for (const auto &id_json : j["ids"]) {
			int64_t id = id_json.get<int64_t>();
			if (Database::get().softDeleteMeme(id)) {
				data.succeeded++;
			} else {
				data.failed++;
			}
		}
		res.status = 200;
		res.body   = makeSuccessResponse(data);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handlePostMemesBatchTags(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto j = nlohmann::json::parse(req.body);
		if (!j.contains("memeIds") || !j["memeIds"].is_array()) {
			throw std::invalid_argument("memeIds array missing");
		}
		int64_t tagId = j.value("tagId", 0LL);

		BatchResult data;
		Database   &db    = Database::get();
		auto        rawDb = db.getRawDatabase();
		if (!rawDb) throw std::runtime_error("DB not available");
		SQLite::Transaction txn(*rawDb);

		for (const auto &id_json : j["memeIds"]) {
			int64_t memeId = id_json.get<int64_t>();
			if (db.addMemeTag(memeId, tagId)) {
				data.succeeded++;
			} else {
				data.failed++;
			}
		}
		txn.commit();

		res.status = 200;
		res.body   = makeSuccessResponse(data);

	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleGetMemesTrash(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto parseQuery = [](const std::string &q) {
			std::map<std::string, std::string> params;
			std::regex                         re("([^?=&]+)=([^&]*)");
			std::smatch                        m;
			auto                               it = q.cbegin();
			while (std::regex_search(it, q.cend(), m, re)) {
				params[m[1].str()] = m[2].str();
				it                 = m[0].second;
			}
			return params;
		};

		// Better parsing using string splitting if regex is overkill or buggy
		auto getParam = [](const std::string &q, const std::string &key, int defaultVal) {
			std::string search = key + "=";
			size_t      pos    = q.find(search);
			if (pos == std::string::npos) return defaultVal;
			size_t start = pos + search.length();
			size_t end   = q.find('&', start);
			try {
				return std::stoi(q.substr(start, end - start));
			} catch (...) { return defaultVal; }
		};

		int limit  = getParam(req.query, "limit", 50);
		int offset = getParam(req.query, "offset", 0);

		auto memes = Database::get().getDeletedMemes(limit, offset);

		SearchResult data;
		data.total = Database::get().getDeletedMemesCount();
		for (const auto &meme : memes) {
			SearchResultItem item;
			item.meme            = meme; // Use the full MemeEntry
			item.similarityScore = -1.0f;
			data.items.push_back(item);
		}
		res.status = 200;
		res.body   = makeSuccessResponse(data);
	} catch (const std::bad_alloc &) { throw; } catch (const std::exception &e) {
		res.status = 500;
		res.body   = makeErrorResponse(ERR_INTERNAL, "DB Error");
	}
}

void handleGetCategories(const HttpRequestProxy &req, HttpResponseProxy &res) {
	(void)req;
	try {
		auto categories = Database::get().getCategories();
		res.status      = 200;
		res.body        = makeSuccessResponse(categories);
	} catch (const std::exception &e) {
		res.status = 500;
		res.body   = makeErrorResponse(ERR_INTERNAL, "DB Error");
	}
}

void handlePostCategory(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto category = nlohmann::json::parse(req.body).get<Category>();
		if (category.name.empty()) {
			res.status = 400;
			res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Category name required");
			return;
		}

		category.id = Database::get().insertCategory(category);

		auto categories = Database::get().getCategories();
		auto it =
		    std::find_if(categories.begin(), categories.end(), [&](const Category &c) { return c.id == category.id; });
		if (it != categories.end()) category = *it;

		WsPusher::get().broadcast({"category:created", category});

		res.status = 201;
		res.body   = makeSuccessResponse(category);
	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Bad JSON or DB Error");
	}
}

void handlePutCategory(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto    pos = req.path.find_last_of('/');
		int64_t id  = std::stoll(req.path.substr(pos + 1));

		auto patch = nlohmann::json::parse(req.body).get<CategoryPatch>();
		bool ok    = Database::get().updateCategory(id, patch);

		if (ok) {
			auto categories = Database::get().getCategories();
			auto it = std::find_if(categories.begin(), categories.end(), [&](const Category &c) { return c.id == id; });
			if (it != categories.end()) {
				WsPusher::get().broadcast({"category:updated", *it});
				res.status = 200;
				res.body   = makeSuccessResponse(*it);
			} else {
				res.status = 404;
				res.body   = makeErrorResponse(ERR_NOT_FOUND, "Not Found after update");
			}
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Category not found");
		}
	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid request");
	}
}

void handleDeleteCategory(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto    pos = req.path.find_last_of('/');
		int64_t id  = std::stoll(req.path.substr(pos + 1));

		bool ok = Database::get().deleteCategory(id);
		if (ok) {
			WsPusher::get().broadcast({"category:deleted", {{"id", id}}});
			res.status = 200;
			res.body   = makeSuccessResponse(nullptr);
		} else {
			res.status = 404;
			res.body   = makeErrorResponse(ERR_NOT_FOUND, "Category not found");
		}
	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid ID");
	}
}

void handlePostMemesBatchCategory(const HttpRequestProxy &req, HttpResponseProxy &res) {
	try {
		auto        batchReq = nlohmann::json::parse(req.body).get<BatchCategoryRequest>();
		BatchResult result;

		for (int64_t memeId : batchReq.memeIds) {
			if (Database::get().updateMemeCategory(memeId, batchReq.categoryId)) {
				result.succeeded++;
				auto meme = Database::get().getMeme(memeId);
				WsPusher::get().broadcast({"meme:updated", meme});
			} else {
				result.failed++;
				result.errors.push_back("Failed to update meme " + std::to_string(memeId));
			}
		}

		res.status = 200;
		res.body   = makeSuccessResponse(result);
	} catch (const std::exception &e) {
		res.status = 400;
		res.body   = makeErrorResponse(ERR_INVALID_PARAMS, "Invalid batch request");
	}
}

void handlePostAdminRebuildEmbeddings(const HttpRequestProxy &req, HttpResponseProxy &res) {
	(void)req;
	if (!EmbeddingModule::get().isAvailable()) {
		res.status = 503;
		res.body   = makeErrorResponse(ERR_EMBEDDING_NOT_READY, "Embedding unavailable");
		return;
	}
	std::string    taskId = TaskQueue::get().submitRebuildTask();
	nlohmann::json data   = {
	    {"taskId", taskId}
    };
	res.status = 200; // Standardized to 200 OK
	res.body   = makeSuccessResponse(data);
}

} // namespace quickmemes
