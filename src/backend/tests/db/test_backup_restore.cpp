/**
 * @file test_backup_restore.cpp
 * @brief 数据库备份与恢复的端到端测试
 */

#include "../mocks.hpp"

#include <filesystem>
#include <fstream>
#include "../test_utils.hpp"

namespace quickmemes {
namespace testing {

class BackupRestoreTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		dbPath = tempDir_->getSubPath("test.db");

		db = std::make_unique<Database>();
		ASSERT_TRUE(db->initialize(dbPath));
	}

	void TearDown() override {
		db->shutdown();
		db.reset();
		tempDir_.reset();
	}

	std::string dbPath;
	std::unique_ptr<Database> db;
	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(BackupRestoreTest, CreateBackup_RestoreFromBackup_DataPreserved) {
	// Insert some data
	MemeEntry meme;
	meme.fileHash = "bk_hash_1";
	meme.filePath = "bk_path_1";
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	Tag tag;
	tag.name      = "backup_tag";
	int64_t tagId = db->insertTag(tag);
	db->addMemeTag(id, tagId);

	// Perform backup
	std::string bakPath = db->backupDatabase();
	EXPECT_FALSE(bakPath.empty());
	EXPECT_TRUE(std::filesystem::exists(bakPath));

	// Insert more data which will be lost after restore
	MemeEntry meme2;
	meme2.fileHash = "bk_hash_2";
	meme2.filePath = "bk_path_2";
	meme2.mimeType = "image/jpeg";
	db->insertMeme(meme2);

	// Restore from backup
	EXPECT_TRUE(db->restoreDatabase(bakPath));

	// Verify data from before backup matches
	auto restoredMeme = db->getMeme(id);
	EXPECT_EQ(restoredMeme.fileHash, "bk_hash_1");
	auto tags = db->getMemeTags(id);
	ASSERT_EQ(tags.size(), 1);
	EXPECT_EQ(tags[0].name, "backup_tag");

	// Verify data inserted after backup is gone
	SearchQuery q;
	auto results = db->searchMemes(q);
	EXPECT_EQ(results.items.size(), 1); // Only the first meme
}

TEST_F(BackupRestoreTest, IntegrityCheck_DetectsCorruption) {
	EXPECT_TRUE(db->checkIntegrity());

	// Corrupt the database file intentionally
	db->shutdown();
	{
		std::ofstream ofs(dbPath, std::ios::binary | std::ios::out | std::ios::in);
		ofs.seekp(100);
		ofs.write("CORRUPT_GARBAGE", 14);
	}

	db->initialize(dbPath);
	EXPECT_FALSE(db->checkIntegrity());
}

} // namespace testing
} // namespace quickmemes
