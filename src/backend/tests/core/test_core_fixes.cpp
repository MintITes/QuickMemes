#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "core/server.hpp"
#include "db/database.hpp"
#include "vision/vision.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iostream>

namespace quickmemes::testing {

class CoreFixesTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		// Embedding defaults are injected via Database::initialize default arguments.
	}
};

TEST_F(CoreFixesTest, Database_RecoverFromCrash) {
	// Insert memes with PROCESSING status
	MemeEntry meme;
	meme.fileHash  = "crash_recovery_test";
	meme.filePath  = "crash.jpg";
	meme.mimeType  = "image/jpeg";
	meme.ocrStatus = ProcessingStatus::PROCESSING;
	meme.aiStatus  = ProcessingStatus::PROCESSING;
	meme.createdAt = 1000;
	meme.updatedAt = 1000;

	int64_t id = db->insertMeme(meme);

	// Call recoverFromCrash
	db->recoverFromCrash();

	// Verify status is now FAILED
	auto recovered = db->getMeme(id);
	EXPECT_EQ(recovered.ocrStatus, ProcessingStatus::FAILED);
	EXPECT_EQ(recovered.aiStatus, ProcessingStatus::FAILED);
}

TEST_F(CoreFixesTest, Database_RunMigrations_SchemaVerification) {
	// Verify schema_version table has applied_at
	EXPECT_NO_THROW({ db->getRawDatabase()->exec("SELECT applied_at FROM schema_version LIMIT 1"); });

	SQLite::Statement versionStmt(*db->getRawDatabase(), "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1");
	ASSERT_TRUE(versionStmt.executeStep());
	EXPECT_EQ(versionStmt.getColumn(0).getInt(), 5);

	SQLite::Statement descStmt(*db->getRawDatabase(), "SELECT sql FROM sqlite_master WHERE name = 'vec_meme_desc'");
	ASSERT_TRUE(descStmt.executeStep());
	EXPECT_TRUE(descStmt.getColumn(0).getString().find("embedding float[512]") != std::string::npos);

	SQLite::Statement ocrStmt(*db->getRawDatabase(), "SELECT sql FROM sqlite_master WHERE name = 'vec_meme_ocr'");
	ASSERT_TRUE(ocrStmt.executeStep());
	EXPECT_TRUE(ocrStmt.getColumn(0).getString().find("embedding float[512]") != std::string::npos);

	SQLite::Statement ftsStmt(*db->getRawDatabase(), "SELECT sql FROM sqlite_master WHERE name = 'memes_fts'");
	ASSERT_TRUE(ftsStmt.executeStep());
	EXPECT_TRUE(ftsStmt.getColumn(0).getString().find("tokenize='simple'") != std::string::npos);
}

TEST_F(CoreFixesTest, Database_MigrateLegacyFtsToSimpleAndRebuildIndex) {
	std::string dbFile = tempDir_->getSubPath("legacy_fts_v4.db");
	{
		SQLite::Database rawDb(dbFile, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);
		rawDb.exec(R"(
            CREATE TABLE schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );
        )");
		rawDb.exec("INSERT INTO schema_version (version, applied_at) VALUES (4, 1);");
		rawDb.exec(R"(
            CREATE TABLE memes (
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
                deleted_at   INTEGER NOT NULL DEFAULT 0,
                category_id  INTEGER NOT NULL DEFAULT 0
            );
        )");
		rawDb.exec(R"(
            CREATE TABLE tags (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL UNIQUE,
                color      TEXT    NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );
        )");
		rawDb.exec(R"(
            CREATE TABLE meme_tags (
                meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
                tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
                PRIMARY KEY (meme_id, tag_id)
            );
        )");
		rawDb.exec(R"(
            CREATE TABLE categories (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid       TEXT    NOT NULL UNIQUE,
                name       TEXT    NOT NULL,
                color      TEXT    NOT NULL,
                position   INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        )");
		rawDb.exec(R"(
            CREATE VIRTUAL TABLE memes_fts USING fts5(
                name,
                description,
                ocr_text,
                content='memes',
                content_rowid='id'
            );
        )");
		rawDb.exec(R"(
            INSERT INTO memes (
                file_path, file_hash, mime_type, file_size, width, height,
                source_name, source_url, name, description, ocr_text,
                ocr_status, ai_status, created_at, updated_at, last_used_at, deleted_at, category_id
            ) VALUES (
                'legacy.png', 'legacy-hash', 'image/png', 1, 0, 0,
                '', '', '测试语句', '', '',
                0, 0, 1, 1, 0, 0, 0
            );
        )");
		rawDb.exec("INSERT INTO memes_fts(memes_fts) VALUES ('rebuild');");
	}

	db->shutdown();
	ASSERT_TRUE(db->initialize(dbFile));

	SearchQuery q;
	q.keyword = "ceshiyuju";
	auto results = db->searchMemes(q);
	std::cout << "[search-debug] Database_MigrateLegacyFtsToSimpleAndRebuildIndex\n"
	          << "  inserted.fileHash=legacy-hash\n"
	          << "  inserted.name=测试语句\n"
	          << "  query.keyword=" << q.keyword << '\n'
	          << "  query.enablePinyin=" << (q.enablePinyin ? "true" : "false") << '\n'
	          << "  results.count=" << results.items.size() << '\n';
	for (size_t i = 0; i < results.items.size(); ++i) {
		const auto &item = results.items[i];
		std::cout << "  result[" << i << "].fileHash=" << item.fileHash << ", name=" << item.name
		          << ", description=" << item.description << ", ocrText=" << item.ocrText << '\n';
	}
	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "legacy-hash");

	{
		SQLite::Statement versionStmt(*db->getRawDatabase(),
		                              "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1");
		ASSERT_TRUE(versionStmt.executeStep());
		EXPECT_EQ(versionStmt.getColumn(0).getInt(), 5);
	}

	{
		SQLite::Statement ftsStmt(*db->getRawDatabase(), "SELECT sql FROM sqlite_master WHERE name = 'memes_fts'");
		ASSERT_TRUE(ftsStmt.executeStep());
		EXPECT_TRUE(ftsStmt.getColumn(0).getString().find("tokenize='simple'") != std::string::npos);
	}
}

TEST_F(CoreFixesTest, Database_Restore_Atomic_Verification) {
	std::string dbFile = tempDir_->getSubPath("test_restore_source.db");

	// Create a database and backup
	Database localDb;
	ASSERT_TRUE(localDb.initialize(dbFile));
	MemeEntry m;
	m.fileHash  = "atomic_restore_h1";
	m.filePath  = "p1";
	m.mimeType  = "i/j";
	m.createdAt = 1;
	m.updatedAt = 1;
	int64_t id  = localDb.insertMeme(m);

	// Ensure unique backup path to avoid "output file already exists"
	std::string backup = tempDir_->getSubPath("manual_backup.db");
	std::filesystem::remove(backup);
	localDb.getRawDatabase()->exec("VACUUM INTO '" + backup + "'");

	localDb.shutdown();

	// Now restore into a NEW database
	std::string targetDbFile = tempDir_->getSubPath("test_restore_target.db");
	Database    target;
	ASSERT_TRUE(target.initialize(targetDbFile));

	// Ensure it's empty or has different data
	EXPECT_EQ(target.countMemes(SearchQuery()), 0);

	// Perform restore
	ASSERT_TRUE(target.restoreDatabase(backup));

	// Verify data is now there
	EXPECT_EQ(target.countMemes(SearchQuery()), 1);
	EXPECT_EQ(target.getMeme(id).fileHash, "atomic_restore_h1");
}

TEST_F(CoreFixesTest, Server_StartBackup_DoesNotCreateDuplicateRecentBackups) {
	db->shutdown();

	ServerConfig config;
	config.bindAddress             = "127.0.0.1";
	config.port                    = 0;
	config.authToken               = "test-token";
	config.storagePath             = tempDir_->getSubPath("storage");
	config.dbPath                  = tempDir_->getSubPath("server-startup.db");
	config.logDir                  = tempDir_->getSubPath("logs");
	config.logLevel                = "info";
	config.workerCount             = 1;
	config.maxQueueSize            = 16;
	config.thumbnailEnabled        = false;
	config.backupEnabled           = true;
	config.backupRetentionDays     = 30;
	config.recycleBinRetentionDays = 30;

	std::filesystem::create_directories(config.storagePath);
	std::filesystem::create_directories(config.logDir);

	auto countBackups = [&]() {
		size_t count = 0;
		for (const auto &entry : std::filesystem::directory_iterator(tempDir_->getPath())) {
			if (!entry.is_regular_file()) continue;
			const auto fileName = entry.path().filename().string();
			if (fileName.rfind("server-startup.db.bak.", 0) == 0) { ++count; }
		}
		return count;
	};

	{
		Server server;
		ASSERT_TRUE(server.start(config));
		server.stop();
		server.waitForStop();
	}
	const auto firstCount = countBackups();
	EXPECT_EQ(firstCount, 1U);

	{
		Server server;
		ASSERT_TRUE(server.start(config));
		server.stop();
		server.waitForStop();
	}
	EXPECT_EQ(countBackups(), firstCount);
}

} // namespace quickmemes::testing
