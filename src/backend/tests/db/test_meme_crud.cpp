/**
 * @file test_meme_crud.cpp
 * @brief Database Meme 增删改查集成测试
 */

#include "../mocks.hpp"
#include "utils/logger.hpp"

namespace quickmemes { namespace testing {

TEST_F(MemeDbTest, InsertMeme_ValidEntry_ReturnsId) {
	MemeEntry meme;
	meme.fileHash  = "testhash123";
	meme.filePath  = getSubPath("test.png");
	meme.mimeType  = "image/png";
	meme.fileSize  = 1024;
	meme.width     = 100;
	meme.height    = 100;
	meme.createdAt = 1234567890;

	int64_t id = db->insertMeme(meme);
	EXPECT_GT(id, 0);
}

TEST_F(MemeDbTest, InsertMeme_DuplicateHash_ThrowsDuplicate) {
	MemeEntry meme;
	meme.fileHash = "testhash123";
	meme.filePath = "/tmp/test.png";
	meme.mimeType = "image/png";
	meme.fileSize = 1024;
	meme.width    = 100;
	meme.height   = 100;

	db->insertMeme(meme);

	MemeEntry dup = meme;
	EXPECT_THROW(db->insertMeme(dup), ApiException);
}

TEST_F(MemeDbTest, GetMeme_ValidId_ReturnsEntryWithTags) {
	MemeEntry meme;
	meme.fileHash = "testhash123";
	meme.filePath = "/tmp/test.png";
	meme.mimeType = "image/png";
	meme.fileSize = 1024;
	meme.width    = 100;
	meme.height   = 100;
	int64_t id    = db->insertMeme(meme);

	MemeEntry loaded = db->getMeme(id);
	EXPECT_EQ(loaded.fileHash, "testhash123");
	EXPECT_EQ(loaded.filePath, "/tmp/test.png");
}

TEST_F(MemeDbTest, GetMeme_InvalidId_ThrowsNotFound) {
	EXPECT_THROW(db->getMeme(9999), ApiException);
}

TEST_F(MemeDbTest, UpdateMeme_ValidPatch_UpdatesFields) {
	MemeEntry meme;
	meme.fileHash = "testhash123";
	meme.filePath = "/tmp/test.png";
	meme.mimeType = "image/png";
	meme.fileSize = 1024;
	meme.width    = 100;
	meme.height   = 100;
	int64_t id    = db->insertMeme(meme);

	MemePatch patch;
	patch.name        = "My New Name";
	patch.description = "My New Description";

	bool success = db->updateMeme(id, patch);
	EXPECT_TRUE(success);

	MemeEntry loaded = db->getMeme(id);
	EXPECT_EQ(loaded.name, "My New Name");
	EXPECT_EQ(loaded.description, "My New Description");
}

}} // namespace quickmemes::testing
