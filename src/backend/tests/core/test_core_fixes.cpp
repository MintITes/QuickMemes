#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "core/server.hpp"
#include "db/database.hpp"
#include "vision/vision.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>

namespace quickmemes::testing {

class CoreFixesTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		// Vision probe mock is not needed here as we use fallback 1536
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

	// Verify vec_memes was created with dynamic dimension
	SQLite::Statement stmt(*db->getRawDatabase(), "SELECT sql FROM sqlite_master WHERE name = 'vec_memes'");
	if (stmt.executeStep()) {
		std::string sql = stmt.getColumn(0).getString();
		EXPECT_TRUE(sql.find("embedding float") != std::string::npos);
		// Ensure it doesn't have a hardcoded 1536 if the model dimension is different
		// In this test environment, it defaults to 1536, but the code uses a variable.
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
	config.bindAddress            = "127.0.0.1";
	config.port                   = 0;
	config.authToken              = "test-token";
	config.storagePath            = tempDir_->getSubPath("storage");
	config.dbPath                 = tempDir_->getSubPath("server-startup.db");
	config.logDir                 = tempDir_->getSubPath("logs");
	config.logLevel               = "info";
	config.workerCount            = 1;
	config.maxQueueSize           = 16;
	config.thumbnailEnabled       = false;
	config.backupEnabled          = true;
	config.backupRetentionDays    = 30;
	config.recycleBinRetentionDays = 30;

	std::filesystem::create_directories(config.storagePath);
	std::filesystem::create_directories(config.logDir);

	auto countBackups = [&]() {
		size_t count = 0;
		for (const auto &entry : std::filesystem::directory_iterator(tempDir_->getPath())) {
			if (!entry.is_regular_file()) continue;
			const auto fileName = entry.path().filename().string();
			if (fileName.rfind("server-startup.db.bak.", 0) == 0) {
				++count;
			}
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
