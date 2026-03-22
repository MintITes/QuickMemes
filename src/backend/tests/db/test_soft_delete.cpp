/**
 * @file test_soft_delete.cpp
 * @brief Database 软删除、回收站、清理机制测试
 */

#include "../mocks.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <chrono>
#include <sqlite3.h>

extern "C" int sqlite3_simple_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi);

namespace quickmemes { namespace testing {

TEST_F(MemeDbTest, SoftDelete_ValidMeme_HidesFromSearch) {
	MemeEntry meme;
	meme.fileHash = "sd_hash_1";
	meme.filePath = "sd_path_1";
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	EXPECT_TRUE(db->softDeleteMeme(id));

	SearchQuery q;
	auto        res = db->searchMemes(q);
	EXPECT_TRUE(res.items.empty());
}

TEST_F(MemeDbTest, RestoreMeme_SoftDeletedMeme_ReturnsToSearch) {
	MemeEntry meme;
	meme.fileHash = "sd_hash_2";
	meme.filePath = "sd_path_2";
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	db->softDeleteMeme(id);
	EXPECT_TRUE(db->restoreMeme(id));

	SearchQuery q;
	auto        res = db->searchMemes(q);
	EXPECT_EQ(res.items.size(), 1);
}

TEST_F(MemeDbTest, PurgeDeletedMemes_OlderThan30Days_RemovesPermanently) {
	MemeEntry meme;
	meme.fileHash = "sd_hash_3";
	meme.filePath = "sd_path_3";
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	db->softDeleteMeme(id);

	db->softDeleteMeme(id);

	db->shutdown();
	std::string dbPath = getSubPath("test_purge.db");
	std::filesystem::remove(dbPath);
	ASSERT_TRUE(db->initialize(dbPath));
	int64_t id2 = db->insertMeme(meme);
	db->softDeleteMeme(id2);

	{
		SQLite::Database rawDb(dbPath, SQLite::OPEN_READWRITE);
		char            *errMsg = nullptr;
		ASSERT_EQ(sqlite3_simple_init(rawDb.getHandle(), &errMsg, nullptr), SQLITE_OK)
		    << (errMsg ? errMsg : "sqlite3_simple_init failed");
		if (errMsg) sqlite3_free(errMsg);

		auto now     = std::chrono::system_clock::now();
		auto older   = now - std::chrono::hours(24 * 31);
		auto olderMs = std::chrono::duration_cast<std::chrono::milliseconds>(older.time_since_epoch()).count();
		SQLite::Statement stmt(rawDb, "UPDATE memes SET deleted_at = ? WHERE id = ?");
		stmt.bind(1, static_cast<int64_t>(olderMs));
		stmt.bind(2, id2);
		stmt.exec();
	}

	int removed = db->purgeDeletedMemes(30);
	EXPECT_EQ(removed, 1);
	EXPECT_EQ(db->getDeletedMemesCount(), 0);
}

}} // namespace quickmemes::testing
