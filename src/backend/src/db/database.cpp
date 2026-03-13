/**
 * @file database.cpp
 * @brief 持久化模块占位实现
 */

#include "db/database.hpp"

#include "error_codes.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <regex>
#include <set>
#include <sqlite3.h>
#include <sstream>
#include <vector>

extern "C" int sqlite3_vec_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi);

#include <unordered_map>

namespace {
static void regexp_func(sqlite3_context *context, int argc, sqlite3_value **argv) {
	if (argc != 2) return;
	const char *re   = reinterpret_cast<const char *>(sqlite3_value_text(argv[0]));
	const char *text = reinterpret_cast<const char *>(sqlite3_value_text(argv[1]));
	if (!re || !text) {
		sqlite3_result_int(context, 0);
		return;
	}

	// Regex cache using thread_local to avoid redundant construction
	thread_local std::unordered_map<std::string, std::regex> regexCache;
	std::string                                              reStr(re);

	try {
		auto it = regexCache.find(reStr);
		if (it == regexCache.end()) {
			// Limit cache size to prevent potential memory growth
			if (regexCache.size() > 100) regexCache.clear();
			it = regexCache.emplace(reStr, std::regex(re, std::regex::extended)).first;
		}

		if (std::regex_search(text, it->second)) {
			sqlite3_result_int(context, 1);
		} else {
			sqlite3_result_int(context, 0);
		}
	} catch (...) { sqlite3_result_error(context, "Invalid regex", -1); }
}
} // namespace

namespace quickmemes {

Database::Database()  = default;
Database::~Database() = default;

bool Database::initialize(const std::string &dbPath) {
	dbPath_ = dbPath;
	try {
		int flags = SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE;

		// 允许指定 :memory: 的内存模式进行测试
		if (dbPath == ":memory:") { flags = SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE | SQLite::OPEN_URI; }

		db_ = std::make_unique<SQLite::Database>(dbPath, flags);

		// 性能调优 PRAGMAs
		db_->exec("PRAGMA journal_mode = WAL;");

		// 注册 regexp 函数
		sqlite3_create_function(db_->getHandle(),
		                        "regexp",
		                        2,
		                        SQLITE_UTF8 | SQLITE_DETERMINISTIC,
		                        nullptr,
		                        regexp_func,
		                        nullptr,
		                        nullptr);
		db_->exec("PRAGMA synchronous = NORMAL;");
		db_->exec("PRAGMA foreign_keys = ON;");
		db_->exec("PRAGMA cache_size = -2000;");
		db_->exec("PRAGMA mmap_size = 268435456;");

		// 注册 sqlite-vec 支持
		char    *errMsg = nullptr;
		// 如果我们开启了 sqlite_vec_init 的声明或引用
		// sqlite3_auto_extension() 在 SQLiteCpp 中不直接暴露，可通过底层句柄
		sqlite3 *rawDb  = db_->getHandle();

		// 调用外部 sqlite3_vec_init，这是 sqlite-vec 扩展的头文件约定
		int rc = sqlite3_vec_init(rawDb, &errMsg, nullptr);

		if (rc != SQLITE_OK) {
			LOG_ERROR("persist", std::string("Failed to initialize sqlite-vec: ") + (errMsg ? errMsg : "Unknown"));
			if (errMsg) sqlite3_free(errMsg);
			return false;
		}

		runMigrations();

		LOG_INFO("persist", "Database initialized successfully.");
		return true;

	} catch (const std::exception &e) {
		LOG_ERROR("persist", std::string("Database initialization failed: ") + e.what());
		return false;
	}
}

void Database::shutdown() {
	if (db_) {
		try {
			db_->exec("PRAGMA optimize;");
		} catch (...) {
			// 忽略关闭时的异常
		}
		db_.reset();
		LOG_INFO("persist", "Database connection closed.");
	}
}

int64_t Database::insertMeme(const MemeEntry &meme) {
#if defined(__MINGW32__) || defined(__MINGW64__)
	std::unique_lock lock(dbMutex_);
#else
	std::shared_lock lock(dbMutex_);
#endif
	try {
		SQLite::Transaction txn(*db_);

		SQLite::Statement stmt(*db_, R"(
            INSERT INTO memes (
                file_hash, file_path, mime_type, file_size, width, height,
                source_name, source_url, name, description, ocr_text,
                ocr_status, ai_status, created_at, updated_at, last_used_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        )");

		stmt.bind(1, meme.fileHash);
		stmt.bind(2, meme.filePath);
		stmt.bind(3, meme.mimeType);
		stmt.bind(4, static_cast<int64_t>(meme.fileSize));
		stmt.bind(5, meme.width);
		stmt.bind(6, meme.height);
		stmt.bind(7, meme.sourceName);
		stmt.bind(8, meme.sourceUrl);
		stmt.bind(9, meme.name);
		stmt.bind(10, meme.description);
		stmt.bind(11, meme.ocrText);
		stmt.bind(12, static_cast<int>(meme.ocrStatus));
		stmt.bind(13, static_cast<int>(meme.aiStatus));
		stmt.bind(14, static_cast<int64_t>(meme.createdAt));
		stmt.bind(15, static_cast<int64_t>(meme.updatedAt));
		stmt.bind(16, static_cast<int64_t>(meme.lastUsedAt));
		stmt.bind(17, static_cast<int64_t>(meme.deletedAt));

		stmt.exec();

		int64_t lastInsertId = db_->getLastInsertRowid();

		// FTS 虚拟表插入（在同一事务中确保原子性）
		// FTS 虚拟表插入（在同一事务中确保原子性）
		// Already handled automatically by SQLite Triggers.

		txn.commit();
		return lastInsertId;

	} catch (const SQLite::Exception &e) {
		if (e.getErrorCode() == SQLITE_CONSTRAINT_UNIQUE) {
			throw ApiException(ERR_DUPLICATE, "Meme with hash " + meme.fileHash + " already exists.");
		}
		LOG_ERROR("persist", std::string("insertMeme failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database insert failure");
	}
}

MemeEntry Database::getMeme(int64_t id) {
	try {
		SQLite::Statement stmt(*db_, R"(
            SELECT id, file_hash, file_path, mime_type, file_size, width, height,
                   source_name, source_url, name, description, ocr_text,
                   ocr_status, ai_status, created_at, updated_at, last_used_at, deleted_at,
                   category_id
            FROM memes
            WHERE id = ?
        )");
		stmt.bind(1, id);

		if (!stmt.executeStep()) { throw ApiException(ERR_NOT_FOUND, "Meme ID " + std::to_string(id) + " not found."); }

		MemeEntry meme;
		meme.id       = stmt.getColumn(0).getInt64();
		meme.fileHash = stmt.getColumn(1).getString();
		meme.filePath = stmt.getColumn(2).getString();
		meme.mimeType = stmt.getColumn(3).getString();
		meme.fileSize = stmt.getColumn(4).getInt64();
		meme.width    = stmt.getColumn(5).getInt();
		meme.height   = stmt.getColumn(6).getInt();

		if (!stmt.getColumn(7).isNull()) meme.sourceName = stmt.getColumn(7).getString();
		if (!stmt.getColumn(8).isNull()) meme.sourceUrl = stmt.getColumn(8).getString();
		if (!stmt.getColumn(9).isNull()) meme.name = stmt.getColumn(9).getString();
		if (!stmt.getColumn(10).isNull()) meme.description = stmt.getColumn(10).getString();
		if (!stmt.getColumn(11).isNull()) meme.ocrText = stmt.getColumn(11).getString();

		meme.ocrStatus  = static_cast<ProcessingStatus>(stmt.getColumn(12).getInt());
		meme.aiStatus   = static_cast<ProcessingStatus>(stmt.getColumn(13).getInt());
		meme.createdAt  = stmt.getColumn(14).getInt64();
		meme.updatedAt  = stmt.getColumn(15).getInt64();
		meme.lastUsedAt = stmt.getColumn(16).getInt64();
		meme.deletedAt  = stmt.getColumn(17).getInt64();
		meme.categoryId = stmt.getColumn(18).getInt64();

		// 级联查出 tags
		SQLite::Statement tagStmt(*db_, "SELECT tag_id FROM meme_tags WHERE meme_id = ?");
		tagStmt.bind(1, id);
		while (tagStmt.executeStep()) {
			meme.tagIds.push_back(tagStmt.getColumn(0).getInt64());
		}

		return meme;

	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("getMeme failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database query failure");
	}
}

PagedMemeResults Database::searchMemes(const SearchQuery &query) {
#if defined(__MINGW32__) || defined(__MINGW64__)
	std::unique_lock lock(dbMutex_);
#else
	std::shared_lock lock(dbMutex_);
#endif
	try {
		SearchSql searchSql = buildSearchSql(query);

		std::string sql = R"(
            SELECT m.id, m.file_hash, m.file_path, m.mime_type, m.file_size, m.width, m.height,
                   m.source_name, m.source_url, m.name, m.description, m.ocr_text,
                   m.ocr_status, m.ai_status, m.created_at, m.updated_at, m.last_used_at, m.deleted_at,
                   m.category_id,
                   (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color, 'createdAt', t.created_at))
                    FROM tags t JOIN meme_tags mt ON t.id = mt.tag_id WHERE mt.meme_id = m.id) as tags_json,
                   COUNT(*) OVER() as total_count
            FROM memes m
        )";

		if (!query.keyword.empty()) { sql += " JOIN memes_fts mf ON m.id = mf.rowid "; }

		if (!query.tagIds.empty()) {
			sql += " JOIN (SELECT meme_id FROM meme_tags WHERE tag_id IN (";
			for (size_t i = 0; i < query.tagIds.size(); ++i) {
				sql += (i == 0) ? "?" : ", ?";
			}
			sql += ") GROUP BY meme_id) mt ON m.id = mt.meme_id ";
		}

		if (!searchSql.whereClauses.empty()) {
			sql += " WHERE " + searchSql.whereClauses[0];
			for (size_t i = 1; i < searchSql.whereClauses.size(); ++i) {
				sql += " AND " + searchSql.whereClauses[i];
			}
		}

		sql += " " + searchSql.orderBy;
		sql += " " + searchSql.limitOffset;

		SQLite::Statement stmt(*db_, sql);

		int bindIdx = 1;
		if (!query.tagIds.empty()) {
			for (int64_t tagId : query.tagIds) {
				stmt.bind(bindIdx++, tagId);
			}
		}

		for (const auto &param : searchSql.params) {
			stmt.bind(bindIdx++, param);
		}

		PagedMemeResults results;
		bool             countSet = false;

		while (stmt.executeStep()) {
			MemeEntry meme;
			meme.id       = stmt.getColumn(0).getInt64();
			meme.fileHash = stmt.getColumn(1).getString();
			meme.filePath = stmt.getColumn(2).getString();
			meme.mimeType = stmt.getColumn(3).getString();
			meme.fileSize = stmt.getColumn(4).getInt64();
			meme.width    = stmt.getColumn(5).getInt();
			meme.height   = stmt.getColumn(6).getInt();

			if (!stmt.getColumn(7).isNull()) meme.sourceName = stmt.getColumn(7).getString();
			if (!stmt.getColumn(8).isNull()) meme.sourceUrl = stmt.getColumn(8).getString();
			if (!stmt.getColumn(9).isNull()) meme.name = stmt.getColumn(9).getString();
			if (!stmt.getColumn(10).isNull()) meme.description = stmt.getColumn(10).getString();
			if (!stmt.getColumn(11).isNull()) meme.ocrText = stmt.getColumn(11).getString();

			meme.ocrStatus  = static_cast<ProcessingStatus>(stmt.getColumn(12).getInt());
			meme.aiStatus   = static_cast<ProcessingStatus>(stmt.getColumn(13).getInt());
			meme.createdAt  = stmt.getColumn(14).getInt64();
			meme.updatedAt  = stmt.getColumn(15).getInt64();
			meme.lastUsedAt = stmt.getColumn(16).getInt64();
			meme.deletedAt  = stmt.getColumn(17).getInt64();
			meme.categoryId = stmt.getColumn(18).getInt64();

			if (!stmt.getColumn(19).isNull()) {
				std::string tagsJson = stmt.getColumn(19).getString();
				auto        jTags    = nlohmann::json::parse(tagsJson);
				for (const auto &jt : jTags) {
					Tag t;
					t.id        = jt["id"];
					t.name      = jt["name"];
					t.color     = jt["color"];
					t.createdAt = jt["createdAt"];
					meme.tags.push_back(t);
					meme.tagIds.push_back(t.id);
				}
			}

			if (!countSet) {
				results.totalCount = stmt.getColumn(20).getInt();
				countSet           = true;
			}

			results.items.push_back(meme);
		}

		return results;

	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("searchMemes failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database search failure");
	}
}

int32_t Database::countMemes(const SearchQuery &query) {
	// 保持兼容性，但内部调用 searchMemes 处理
	SearchQuery q = query;
	q.limit       = 1;
	auto res      = searchMemes(q);
	return res.totalCount;
}

std::vector<MemeEntry> Database::vectorSearch(const std::vector<float> &embedding, int limit) {
	std::unique_lock lock(dbMutex_);
	if (embedding.empty()) { throw ApiException(ERR_INVALID_PARAMS, "Empty embedding provided for vector search"); }

	try {
		std::vector<MemeEntry> results;
		int                    searchLimit = limit * 3;

		std::string sql = R"(
            SELECT m.id, m.file_hash, m.file_path, m.mime_type, m.file_size, m.width, m.height,
                   m.source_name, m.source_url, m.name, m.description, m.ocr_text,
                   m.ocr_status, m.ai_status, m.created_at, m.updated_at, m.last_used_at, m.deleted_at,
                   m.category_id,
                   (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color, 'createdAt', t.created_at))
                    FROM tags t JOIN meme_tags mt ON t.id = mt.tag_id WHERE mt.meme_id = m.id) as tags_json
            FROM vec_memes v
            JOIN memes m ON v.meme_id = m.id
            WHERE v.embedding MATCH ?
              AND v.k = ?
              AND m.deleted_at = 0
            ORDER BY v.distance
        )";

		SQLite::Statement stmt(*db_, sql);

		// 绑定 Float 数组 -> Blob
		stmt.bind(1, embedding.data(), embedding.size() * sizeof(float));
		stmt.bind(2, searchLimit);

		while (stmt.executeStep()) {
			if (results.size() >= static_cast<size_t>(limit)) { break; }

			MemeEntry meme;
			meme.id       = stmt.getColumn(0).getInt64();
			meme.fileHash = stmt.getColumn(1).getString();
			meme.filePath = stmt.getColumn(2).getString();
			meme.mimeType = stmt.getColumn(3).getString();
			meme.fileSize = stmt.getColumn(4).getInt64();
			meme.width    = stmt.getColumn(5).getInt();
			meme.height   = stmt.getColumn(6).getInt();

			if (!stmt.getColumn(7).isNull()) meme.sourceName = stmt.getColumn(7).getString();
			if (!stmt.getColumn(8).isNull()) meme.sourceUrl = stmt.getColumn(8).getString();
			if (!stmt.getColumn(9).isNull()) meme.name = stmt.getColumn(9).getString();
			if (!stmt.getColumn(10).isNull()) meme.description = stmt.getColumn(10).getString();
			if (!stmt.getColumn(11).isNull()) meme.ocrText = stmt.getColumn(11).getString();

			meme.ocrStatus  = static_cast<ProcessingStatus>(stmt.getColumn(12).getInt());
			meme.aiStatus   = static_cast<ProcessingStatus>(stmt.getColumn(13).getInt());
			meme.createdAt  = stmt.getColumn(14).getInt64();
			meme.updatedAt  = stmt.getColumn(15).getInt64();
			meme.lastUsedAt = stmt.getColumn(16).getInt64();
			meme.deletedAt  = stmt.getColumn(17).getInt64();
			meme.categoryId = stmt.getColumn(18).getInt64();

			if (!stmt.getColumn(19).isNull()) {
				std::string tagsJson = stmt.getColumn(19).getString();
				auto        jTags    = nlohmann::json::parse(tagsJson);
				for (const auto &jt : jTags) {
					Tag t;
					t.id        = jt["id"];
					t.name      = jt["name"];
					t.color     = jt["color"];
					t.createdAt = jt["createdAt"];
					meme.tags.push_back(t);
					meme.tagIds.push_back(t.id);
				}
			}

			results.push_back(meme);
		}

		return results;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("vectorSearch failed: ") + e.what());
		// Handle dimensionality mismatch or other sqlite-vec errors
		if (std::string(e.what()).find("dimensionality") != std::string::npos) {
			throw ApiException(ERR_INVALID_PARAMS, "Vector dimensionality mismatch");
		}
		throw ApiException(ERR_INTERNAL, "Vector search failed: " + std::string(e.what()));
	}
}

bool Database::updateMeme(int64_t id, const MemePatch &patch) {
	std::unique_lock lock(dbMutex_);
	try {
		std::string              sql = "UPDATE memes SET updated_at = ?";
		std::vector<std::string> bindStrings;
		std::vector<int>         bindInts;

		if (patch.name) {
			sql += ", name = ?";
			bindStrings.push_back(*patch.name);
		}
		if (patch.description) {
			sql += ", description = ?";
			bindStrings.push_back(*patch.description);
		}
		if (patch.sourceName) {
			sql += ", source_name = ?";
			bindStrings.push_back(*patch.sourceName);
		}
		if (patch.sourceUrl) {
			sql += ", source_url = ?";
			bindStrings.push_back(*patch.sourceUrl);
		}
		if (patch.categoryId) {
			sql += ", category_id = ?";
			bindInts.push_back(static_cast<int>(*patch.categoryId));
		}

		sql += " WHERE id = ?";

		SQLite::Statement stmt(*db_, sql);
		int               bindIdx = 1;

		auto now   = std::chrono::system_clock::now();
		auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
		stmt.bind(bindIdx++, static_cast<int64_t>(nowMs));

		for (const auto &str : bindStrings)
			stmt.bind(bindIdx++, str);
		for (const auto &i : bindInts)
			stmt.bind(bindIdx++, i);
		stmt.bind(bindIdx, id);

		int rows = stmt.exec();

		// 如果更新了任何 FTS 涉及的字段，顺便覆盖 FTS 虚拟表
		// Already handled automatically by SQLite Triggers.

		return rows > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("updateMeme failed: ") + e.what());
		return false;
	}
}

bool Database::updateMemeLastUsed(int64_t id) {
	std::unique_lock lock(dbMutex_);
	try {
		auto              now   = std::chrono::system_clock::now();
		auto              nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
		SQLite::Statement stmt(*db_, "UPDATE memes SET last_used_at = ? WHERE id = ?");
		stmt.bind(1, static_cast<int64_t>(nowMs));
		stmt.bind(2, id);
		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("updateMemeLastUsed failed: ") + e.what());
		return false;
	}
}

bool Database::softDeleteMeme(int64_t id) {
	std::unique_lock lock(dbMutex_);
	try {
		auto              now   = std::chrono::system_clock::now();
		auto              nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
		SQLite::Statement stmt(*db_, "UPDATE memes SET deleted_at = ? WHERE id = ? AND deleted_at = 0");
		stmt.bind(1, static_cast<int64_t>(nowMs));
		stmt.bind(2, id);
		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("softDeleteMeme failed: ") + e.what());
		return false;
	}
}

std::vector<MemeEntry> Database::getDeletedMemes(int limit, int offset) {
	try {
		std::string       sql = R"(
            SELECT id, file_hash, file_path, mime_type, file_size, width, height,
                   source_name, source_url, name, description, ocr_text,
                   ocr_status, ai_status, created_at, updated_at, last_used_at, deleted_at
            FROM memes
            WHERE deleted_at > 0
            ORDER BY deleted_at DESC
            LIMIT ? OFFSET ?
        )";
		SQLite::Statement stmt(*db_, sql);
		stmt.bind(1, limit);
		stmt.bind(2, offset);

		std::vector<MemeEntry> results;
		while (stmt.executeStep()) {
			MemeEntry meme;
			meme.id       = stmt.getColumn(0).getInt64();
			meme.fileHash = stmt.getColumn(1).getString();
			meme.filePath = stmt.getColumn(2).getString();
			meme.mimeType = stmt.getColumn(3).getString();
			meme.fileSize = stmt.getColumn(4).getInt64();
			meme.width    = stmt.getColumn(5).getInt();
			meme.height   = stmt.getColumn(6).getInt();
			if (!stmt.getColumn(7).isNull()) meme.sourceName = stmt.getColumn(7).getString();
			if (!stmt.getColumn(8).isNull()) meme.sourceUrl = stmt.getColumn(8).getString();
			if (!stmt.getColumn(9).isNull()) meme.name = stmt.getColumn(9).getString();
			if (!stmt.getColumn(10).isNull()) meme.description = stmt.getColumn(10).getString();
			if (!stmt.getColumn(11).isNull()) meme.ocrText = stmt.getColumn(11).getString();
			meme.ocrStatus  = static_cast<ProcessingStatus>(stmt.getColumn(12).getInt());
			meme.aiStatus   = static_cast<ProcessingStatus>(stmt.getColumn(13).getInt());
			meme.createdAt  = stmt.getColumn(14).getInt64();
			meme.updatedAt  = stmt.getColumn(15).getInt64();
			meme.lastUsedAt = stmt.getColumn(16).getInt64();
			meme.deletedAt  = stmt.getColumn(17).getInt64();
			results.push_back(meme);
		}
		return results;
	} catch (...) { return {}; }
}

int Database::getDeletedMemesCount() {
	try {
		SQLite::Statement stmt(*db_, "SELECT COUNT(*) FROM memes WHERE deleted_at > 0");
		if (stmt.executeStep()) { return stmt.getColumn(0).getInt(); }
	} catch (...) {}
	return 0;
}

bool Database::restoreMeme(int64_t id) {
	try {
		SQLite::Statement stmt(*db_, "UPDATE memes SET deleted_at = 0 WHERE id = ?");
		stmt.bind(1, id);
		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("restoreMeme failed: ") + e.what());
		return false;
	}
}

int Database::purgeDeletedMemes(int olderThanDays) {
	try {
		auto    now       = std::chrono::system_clock::now();
		auto    threshold = now - std::chrono::hours(24 * olderThanDays);
		// 如果 olderThanDays 为 0，我们将阈值设为 infinity (未来)，以清理所有已删除
		int64_t thresholdMs;
		if (olderThanDays <= 0) {
			thresholdMs =
			    std::chrono::duration_cast<std::chrono::milliseconds>((now + std::chrono::hours(1)).time_since_epoch())
			        .count();
		} else {
			thresholdMs = std::chrono::duration_cast<std::chrono::milliseconds>(threshold.time_since_epoch()).count();
		}

		SQLite::Statement selStmt(*db_, "SELECT id FROM memes WHERE deleted_at > 0 AND deleted_at < ?");
		selStmt.bind(1, thresholdMs);

		int count = 0;
		while (selStmt.executeStep()) {
			int64_t idToDelete = selStmt.getColumn(0).getInt64();
			if (deleteMeme(idToDelete)) { count++; }
		}
		return count;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("purgeDeletedMemes failed: ") + e.what());
		return 0;
	}
}

bool Database::updateMemeProcessing(int64_t            id,
                                    ProcessingStatus   ocrStatus,
                                    ProcessingStatus   aiStatus,
                                    const std::string &ocrText,
                                    const std::string &description) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_,
		                       "UPDATE memes SET updated_at = ?, ocr_status = ?, ai_status = ?, ocr_text = ?, "
		                       "description = ? WHERE id = ?");
		auto              nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();
		stmt.bind(1, static_cast<int64_t>(nowMs));
		stmt.bind(2, static_cast<int>(ocrStatus));
		stmt.bind(3, static_cast<int>(aiStatus));
		stmt.bind(4, ocrText);
		stmt.bind(5, description);
		stmt.bind(6, id);
		int rows = stmt.exec();
		// Already handled by trigger
		return rows > 0;
	} catch (const std::exception &e) {
		LOG_ERROR("persist", std::string("updateMemeProcessing failed: ") + e.what());
		return false;
	}
}

bool Database::deleteMeme(int64_t id) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Transaction txn(*db_);
		// delete from main (foreign keys to meme_tags cascading)
		SQLite::Statement   delMeme(*db_, "DELETE FROM memes WHERE id = ?");
		delMeme.bind(1, id);
		int rows = delMeme.exec();

		if (rows > 0) {
			// FTS delete is handled by triggers
			// Delete from vector tables specifically
			SQLite::Statement delVec(*db_, "DELETE FROM vec_memes WHERE meme_id = ?");
			delVec.bind(1, id);
			delVec.exec();
		}

		txn.commit();
		return rows > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("deleteMeme failed: ") + e.what());
		return false;
	}
}

int64_t Database::insertTag(const Tag &tag) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_, "INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)");
		stmt.bind(1, tag.name);
		stmt.bind(2, tag.color);

		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();
		stmt.bind(3, static_cast<int64_t>(nowMs));

		stmt.exec();
		return db_->getLastInsertRowid();
	} catch (const SQLite::Exception &e) {
		if (e.getErrorCode() == SQLITE_CONSTRAINT_UNIQUE) {
			throw ApiException(ERR_DUPLICATE, "Tag name '" + tag.name + "' already exists");
		}
		LOG_ERROR("persist", std::string("insertTag failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database tag insert failure");
	}
}

std::vector<Tag> Database::getTags() {
	try {
		SQLite::Statement stmt(*db_, "SELECT id, name, color, created_at FROM tags ORDER BY name ASC");
		std::vector<Tag>  tags;
		while (stmt.executeStep()) {
			tags.push_back({stmt.getColumn(0).getInt64(),
			                stmt.getColumn(1).getString(),
			                stmt.getColumn(2).getString(),
			                stmt.getColumn(3).getInt64()});
		}
		return tags;
	} catch (...) { return {}; }
}

bool Database::deleteTag(int64_t tagId) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_, "DELETE FROM tags WHERE id = ?");
		stmt.bind(1, tagId);
		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("deleteTag failed: ") + e.what());
		return false;
	}
}

std::vector<Tag> Database::getMemeTags(int64_t memeId) {
	try {
		SQLite::Statement stmt(*db_, R"(
            SELECT t.id, t.name, t.color, t.created_at
            FROM tags t
            JOIN meme_tags mt ON t.id = mt.tag_id
            WHERE mt.meme_id = ?
        )");
		stmt.bind(1, memeId);
		std::vector<Tag> tags;
		while (stmt.executeStep()) {
			tags.push_back({stmt.getColumn(0).getInt64(),
			                stmt.getColumn(1).getString(),
			                stmt.getColumn(2).getString(),
			                stmt.getColumn(3).getInt64()});
		}
		return tags;
	} catch (...) { return {}; }
}

bool Database::addMemeTag(int64_t memeId, int64_t tagId) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_, "INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)");
		stmt.bind(1, memeId);
		stmt.bind(2, tagId);
		return stmt.exec() >= 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("addMemeTag failed: ") + e.what());
		return false;
	}
}

bool Database::removeMemeTag(int64_t memeId, int64_t tagId) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_, "DELETE FROM meme_tags WHERE meme_id = ? AND tag_id = ?");
		stmt.bind(1, memeId);
		stmt.bind(2, tagId);
		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("removeMemeTag failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database tag removal failure");
	}
}

int64_t Database::insertCategory(const Category &category) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(
		    *db_,
		    "INSERT INTO categories (uuid, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");

		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();

		std::string uuid =
		    category.uuid.empty() ? "uuid_placeholder" : category.uuid; // Ideally use a real UUID generator

		stmt.bind(1, uuid);
		stmt.bind(2, category.name);
		stmt.bind(3, category.color);
		stmt.bind(4, static_cast<int64_t>(nowMs));
		stmt.bind(5, static_cast<int64_t>(nowMs));

		stmt.exec();
		return db_->getLastInsertRowid();
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("insertCategory failed: ") + e.what());
		throw ApiException(ERR_INTERNAL, "Database category insert failure");
	}
}

bool Database::updateCategory(int64_t id, const CategoryPatch &patch) {
	std::unique_lock lock(dbMutex_);
	try {
		std::string              sql = "UPDATE categories SET updated_at = ?";
		std::vector<std::string> params;

		if (patch.name) {
			sql += ", name = ?";
			params.push_back(*patch.name);
		}
		if (patch.color) {
			sql += ", color = ?";
			params.push_back(*patch.color);
		}
		sql += " WHERE id = ?";

		SQLite::Statement stmt(*db_, sql);

		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();

		int bindIdx = 1;
		stmt.bind(bindIdx++, static_cast<int64_t>(nowMs));
		for (const auto &p : params) {
			stmt.bind(bindIdx++, p);
		}
		stmt.bind(bindIdx, id);

		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("updateCategory failed: ") + e.what());
		return false;
	}
}

bool Database::deleteCategory(int64_t id) {
	try {
		SQLite::Transaction txn(*db_);

		// 1. Reset category_id in memes table
		SQLite::Statement resetStmt(*db_, "UPDATE memes SET category_id = 0 WHERE category_id = ?");
		resetStmt.bind(1, id);
		resetStmt.exec();

		// 2. Delete the category
		SQLite::Statement delStmt(*db_, "DELETE FROM categories WHERE id = ?");
		delStmt.bind(1, id);
		int rows = delStmt.exec();

		txn.commit();
		return rows > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("deleteCategory failed: ") + e.what());
		return false;
	}
}

std::vector<Category> Database::getCategories() {
	try {
		SQLite::Statement stmt(
		    *db_,
		    "SELECT id, uuid, name, color, created_at, updated_at FROM categories ORDER BY name ASC");
		std::vector<Category> results;
		while (stmt.executeStep()) {
			Category c;
			c.id        = stmt.getColumn(0).getInt64();
			c.uuid      = stmt.getColumn(1).getString();
			c.name      = stmt.getColumn(2).getString();
			c.color     = stmt.getColumn(3).getString();
			c.createdAt = stmt.getColumn(4).getInt64();
			c.updatedAt = stmt.getColumn(5).getInt64();
			results.push_back(c);
		}
		return results;
	} catch (...) { return {}; }
}

bool Database::updateMemeCategory(int64_t memeId, int64_t categoryId) {
	try {
		SQLite::Statement stmt(*db_, "UPDATE memes SET category_id = ?, updated_at = ? WHERE id = ?");

		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();

		stmt.bind(1, categoryId);
		stmt.bind(2, static_cast<int64_t>(nowMs));
		stmt.bind(3, memeId);

		return stmt.exec() > 0;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("updateMemeCategory failed: ") + e.what());
		return false;
	}
}

void Database::upsertEmbedding(int64_t memeId, const std::vector<float> &embedding) {
	std::unique_lock lock(dbMutex_);
	try {
		SQLite::Statement stmt(*db_, "INSERT OR REPLACE INTO vec_memes (meme_id, embedding) VALUES (?, ?)");
		stmt.bind(1, memeId);
		stmt.bind(2, embedding.data(), embedding.size() * sizeof(float));
		stmt.exec();
	} catch (const SQLite::Exception &e) { LOG_ERROR("persist", std::string("upsertEmbedding failed: ") + e.what()); }
}

void Database::rebuildVecTable(int newDimension) {
	std::unique_lock lock(dbMutex_);
	if (newDimension <= 0) { newDimension = VisionModule::get().getEmbeddingDimension(); }
	if (newDimension <= 0) newDimension = 1536; // Fallback

	try {
		SQLite::Transaction txn(*db_);
		db_->exec("DROP TABLE IF EXISTS vec_memes;");
		std::string ddl = "CREATE VIRTUAL TABLE vec_memes USING vec0(meme_id INTEGER PRIMARY KEY, embedding float[" +
		                  std::to_string(newDimension) + "]);";
		db_->exec(ddl);
		txn.commit();
		LOG_INFO("persist", "Vec table rebuilt with dimension " + std::to_string(newDimension));
	} catch (const SQLite::Exception &e) { LOG_ERROR("persist", std::string("rebuildVecTable failed: ") + e.what()); }
}

std::string Database::backupDatabase() {
	try {
		auto    now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
		std::tm tm{};
#ifdef _WIN32
		localtime_s(&tm, &now);
#else
		localtime_r(&now, &tm);
#endif

		char buf[32];
		std::strftime(buf, sizeof(buf), "%Y%m%d_%H%M%S", &tm);

		std::string backupPath = dbPath_ + ".bak." + std::string(buf);
		db_->exec("VACUUM INTO '" + backupPath + "'");
		return backupPath;
	} catch (const SQLite::Exception &e) {
		LOG_ERROR("persist", std::string("Backup failed: ") + e.what());
		return "";
	}
}

bool Database::restoreDatabase(const std::string &backupPath) {
	try {
		// 检查备份文件是否存在
		std::ifstream checkFile(backupPath);
		if (!checkFile.good()) {
			LOG_ERROR("persist", "Backup file not found: " + backupPath);
			return false;
		}
		checkFile.close();

		// 保存当前路径
		std::string currentPath = dbPath_;

		// 关闭当前连接
		shutdown();

		// 采用写临时文件+原子重命名策略
		std::string tempPath = currentPath + ".tmp";
		{
			std::ifstream src(backupPath, std::ios::binary);
			std::ofstream dst(tempPath, std::ios::binary | std::ios::trunc);
			if (!src || !dst) {
				LOG_ERROR("persist", "Failed to open files for restore copy");
				if (!dbPath_.empty()) initialize(currentPath);
				return false;
			}
			dst << src.rdbuf();
		}

		// 原子替换
		try {
			std::filesystem::rename(tempPath, currentPath);
		} catch (const std::exception &e) {
			LOG_ERROR("persist", std::string("Rename failed during restore: ") + e.what());
			std::filesystem::remove(tempPath);
			if (!dbPath_.empty()) initialize(currentPath);
			return false;
		}

		// 重新初始化
		bool ok = initialize(currentPath);
		if (ok) {
			LOG_INFO("persist", "Database restored from: " + backupPath);
		} else {
			LOG_ERROR("persist", "Failed to reinitialize after restore");
		}
		return ok;
	} catch (const std::exception &e) {
		LOG_ERROR("persist", std::string("restoreDatabase failed: ") + e.what());
		// 尝试重新打开原数据库
		if (!dbPath_.empty()) initialize(dbPath_);
		return false;
	}
}

bool Database::checkIntegrity() {
	try {
		SQLite::Statement stmt(*db_, "PRAGMA integrity_check");
		if (stmt.executeStep()) {
			std::string result = stmt.getColumn(0).getString();
			return result == "ok";
		}
		return false;
	} catch (...) { return false; }
}

void Database::recoverFromCrash() {
	try {
		SQLite::Statement stmt(*db_,
		                       "UPDATE memes SET ocr_status = ?, ai_status = ? WHERE ocr_status = ? OR ai_status = ?");
		stmt.bind(1, static_cast<int>(ProcessingStatus::FAILED));
		stmt.bind(2, static_cast<int>(ProcessingStatus::FAILED));
		stmt.bind(3, static_cast<int>(ProcessingStatus::PROCESSING));
		stmt.bind(4, static_cast<int>(ProcessingStatus::PROCESSING));
		int rows = stmt.exec();
		if (rows > 0) {
			LOG_INFO("persist", "Database recovered from crash (reset " + std::to_string(rows) + " PROCESSING states)");
		}
	} catch (...) {}
}

void Database::runMigrations() {
	// 确保 schema_version 表及其初始结构存在
	db_->exec("CREATE TABLE IF NOT EXISTS schema_version ("
	          "version INTEGER PRIMARY KEY, "
	          "applied_at INTEGER NOT NULL"
	          ");");

	int currentVersion = 0;
	try {
		currentVersion = db_->execAndGet("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").getInt();
	} catch (...) {
		// 如果没有任何版本记录，视为版本 0
		currentVersion = 0;
	}

	if (currentVersion < 1) {
		LOG_INFO("persist", "Running database migration to v1 (Initial Schema)...");
		if (dbPath_ != ":memory:") { backupDatabase(); }

		SQLite::Transaction transaction(*db_);

		// 1. Memes 主表
		db_->exec(R"(
            CREATE TABLE IF NOT EXISTS memes (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path    TEXT    NOT NULL UNIQUE,
                file_hash    TEXT    NOT NULL UNIQUE,
                mime_type    TEXT    NOT NULL,
                file_size    INTEGER NOT NULL,
                width        INTEGER NOT NULL DEFAULT 0,
                height       INTEGER NOT NULL DEFAULT 0,
                source_name  TEXT    NOT NULL DEFAULT '',
                source_url   TEXT    NOT NULL DEFAULT '',
                name         TEXT    NOT NULL DEFAULT '',
                description  TEXT    NOT NULL DEFAULT '',
                ocr_text     TEXT    NOT NULL DEFAULT '',
                ocr_status   INTEGER NOT NULL DEFAULT 0,
                ai_status    INTEGER NOT NULL DEFAULT 0,
                created_at   INTEGER NOT NULL,
                updated_at   INTEGER NOT NULL,
                last_used_at INTEGER NOT NULL DEFAULT 0,
                deleted_at   INTEGER NOT NULL DEFAULT 0
            );
        )");

		db_->exec("CREATE INDEX IF NOT EXISTS idx_memes_file_hash ON memes(file_hash);");
		db_->exec("CREATE INDEX IF NOT EXISTS idx_memes_created_at ON memes(created_at);");
		db_->exec("CREATE INDEX IF NOT EXISTS idx_memes_deleted_at ON memes(deleted_at);");

		// 2. FTS 全文搜索虚拟表
		db_->exec(R"(
            CREATE VIRTUAL TABLE IF NOT EXISTS memes_fts USING fts5(
                name,
                description,
                ocr_text,
                content='memes',
                content_rowid='id'
            );
        )");

		// 3. FTS 同步触发器
		db_->exec(R"(
            CREATE TRIGGER IF NOT EXISTS memes_ai AFTER INSERT ON memes BEGIN
                INSERT INTO memes_fts(rowid, name, description, ocr_text) 
                VALUES (new.id, new.name, new.description, new.ocr_text);
            END;
        )");
		db_->exec(R"(
            CREATE TRIGGER IF NOT EXISTS memes_au AFTER UPDATE ON memes BEGIN
                INSERT INTO memes_fts(memes_fts, rowid, name, description, ocr_text) 
                VALUES ('delete', old.id, old.name, old.description, old.ocr_text);
                INSERT INTO memes_fts(rowid, name, description, ocr_text) 
                VALUES (new.id, new.name, new.description, new.ocr_text);
            END;
        )");
		db_->exec(R"(
            CREATE TRIGGER IF NOT EXISTS memes_ad AFTER DELETE ON memes BEGIN
                INSERT INTO memes_fts(memes_fts, rowid, name, description, ocr_text) 
                VALUES ('delete', old.id, old.name, old.description, old.ocr_text);
            END;
        )");

		// 4. Vector 向量搜索虚拟表
		int dim = VisionModule::get().getEmbeddingDimension();
		if (dim <= 0) dim = 1536;
		db_->exec(
		    "CREATE VIRTUAL TABLE IF NOT EXISTS vec_memes USING vec0(meme_id INTEGER PRIMARY KEY, embedding float[" +
		    std::to_string(dim) + "]);");

		// 5. 标签表
		db_->exec(R"(
            CREATE TABLE IF NOT EXISTS tags (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL UNIQUE,
                color      TEXT    NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );
        )");

		// 6. Meme-Tag 关联表
		db_->exec(R"(
            CREATE TABLE IF NOT EXISTS meme_tags (
                meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
                tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
                PRIMARY KEY (meme_id, tag_id)
            );
        )");

		// 更新版本号
		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();

		SQLite::Statement stmt(*db_, "INSERT INTO schema_version (version, applied_at) VALUES (1, ?)");
		stmt.bind(1, static_cast<int64_t>(nowMs));
		stmt.exec();

		transaction.commit();
		LOG_INFO("persist", "Initial database schema v1 applied successfully.");
	}

	// 迁移到 v2：分类功能
	if (currentVersion < 2) {
		SQLite::Transaction transaction(*db_);
		LOG_INFO("persist", "Migrating database to schema v2 (Categories)...");

		// 1. 创建 categories 表
		db_->exec(R"(
            CREATE TABLE IF NOT EXISTS categories (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid       TEXT    NOT NULL UNIQUE,
                name       TEXT    NOT NULL,
                color      TEXT    NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        )");

		// 2. 为 memes 表增加 category_id 列
		db_->exec("ALTER TABLE memes ADD COLUMN category_id INTEGER DEFAULT 0;");
		db_->exec("CREATE INDEX idx_memes_category ON memes(category_id);");

		// 更新版本号
		auto nowMs =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();
		db_->exec("INSERT INTO schema_version (version, applied_at) VALUES (2, " + std::to_string(nowMs) + ");");

		transaction.commit();
		LOG_INFO("persist", "Database migrated to schema v2 successfully.");
	}
}

SearchSql Database::buildSearchSql(const SearchQuery &query) {
	SearchSql res;

	if (query.tagIds.size() > 900) { throw ApiException(ERR_INVALID_PARAMS, "Too many tags in query (limit 900)"); }

	// 未删除的文件默认会被搜索，如果没有指定特殊的标志
	// 因为最初的结构体中没有 includeDeleted 字段，使用基本的策略：
	res.whereClauses.push_back("m.deleted_at = 0");

	if (!query.keyword.empty()) {
		res.whereClauses.push_back("memes_fts MATCH ?");
		res.params.push_back(query.keyword);
	}

	if (!query.source.empty()) {
		// Assume mapping of enum to string happens in handler, or we use source matching natively
		res.whereClauses.push_back("m.source_name = ?");
		res.params.push_back(query.source);
	}

	if (query.categoryId != 0) {
		if (query.categoryId == -1) {
			res.whereClauses.push_back("m.category_id = 0");
		} else {
			res.whereClauses.push_back("m.category_id = ?");
			res.params.push_back(std::to_string(query.categoryId));
		}
	}

	// No processingStatus filter in standard query currently.

	if (!query.formats.empty()) {
		std::string formatClause = "m.mime_type IN (";
		for (size_t i = 0; i < query.formats.size(); ++i) {
			formatClause += (i == 0) ? "?" : ", ?";
			res.params.push_back(query.formats[i]);
		}
		formatClause += ")";
		res.whereClauses.push_back(formatClause);
	}

	if (query.sizeMin > 0) {
		res.whereClauses.push_back("m.file_size >= ?");
		res.params.push_back(std::to_string(query.sizeMin));
	}

	if (query.sizeMax > 0) {
		res.whereClauses.push_back("m.file_size <= ?");
		res.params.push_back(std::to_string(query.sizeMax));
	}

	if (query.timeFrom > 0) {
		res.whereClauses.push_back("m.created_at >= ?");
		res.params.push_back(std::to_string(query.timeFrom));
	}

	if (query.timeTo > 0) {
		res.whereClauses.push_back("m.created_at <= ?");
		res.params.push_back(std::to_string(query.timeTo));
	}

	if (!query.regex.empty()) {
		res.whereClauses.push_back("(regexp(?, m.name) OR regexp(?, m.description) OR regexp(?, m.ocr_text))");
		res.params.push_back(query.regex);
		res.params.push_back(query.regex);
		res.params.push_back(query.regex);
	}

	// ORDER BY
	std::string orderField = "m.created_at"; // default
	if (!query.sortBy.empty()) {
		if (query.sortBy == "relevance" && !query.keyword.empty()) {
			orderField = "-bm25(memes_fts)";
		} else if (query.sortBy == "size" || query.sortBy == "fileSize") {
			orderField = "m.file_size";
		} else if (query.sortBy == "name") {
			orderField = "m.name";
		} else if (query.sortBy == "updatedAt") {
			orderField = "m.updated_at";
		} else if (query.sortBy == "lastUsedAt") {
			orderField = "m.last_used_at";
		}
	}
	std::string orderDir = (query.sortOrder == "ASC" || query.sortOrder == "asc") ? "ASC" : "DESC"; // 默认 desc

	res.orderBy = "ORDER BY " + orderField + " " + orderDir;

	int limit       = std::max(1, std::min(200, query.limit > 0 ? query.limit : 50));
	int offset      = std::max(0, query.offset);
	res.limitOffset = "LIMIT " + std::to_string(limit) + " OFFSET " + std::to_string(offset);

	return res;
}

} // namespace quickmemes
