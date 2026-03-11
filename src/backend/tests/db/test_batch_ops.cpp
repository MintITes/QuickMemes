#include "../mocks.hpp"

namespace quickmemes { namespace testing {

class BatchOpsTest : public MemeDbTest {};

TEST_F(BatchOpsTest, DeleteMemesBatch_ValidIds_RemovesMemes) {
	MemeEntry m1, m2;
	m1.fileHash = "batch_hash1";
	m1.filePath = "/foo1";
	m1.mimeType = "img";
	m2.fileHash = "batch_hash2";
	m2.filePath = "/foo2";
	m2.mimeType = "img";
	int64_t id1 = db->insertMeme(m1);
	int64_t id2 = db->insertMeme(m2);

	auto   memes               = db->getDeletedMemes(10, 0);
	size_t initialDeletedCount = memes.size();

	EXPECT_TRUE(db->softDeleteMeme(id1));
	EXPECT_TRUE(db->softDeleteMeme(id2));

	memes = db->getDeletedMemes(10, 0);
	EXPECT_EQ(memes.size(), initialDeletedCount + 2);
}

TEST_F(BatchOpsTest, AddMemeTagBatch_ValidIds_AddsTags) {
	MemeEntry m1;
	m1.fileHash = "batch_hash3";
	m1.filePath = "/foo3";
	m1.mimeType = "img";
	int64_t mId = db->insertMeme(m1);

	Tag t;
	t.name        = "BatchTag";
	int64_t tagId = db->insertTag(t);

	EXPECT_TRUE(db->addMemeTag(mId, tagId));
	auto tags = db->getMemeTags(mId);
	EXPECT_EQ(tags.size(), 1);
	EXPECT_EQ(tags[0].name, "BatchTag");
}

TEST_F(BatchOpsTest, DeleteMemesBatch_InvalidIds_IgnoresInvalid) {
	auto initialDeletedCount = db->getDeletedMemes(100, 0).size();

	// Pass IDs that don't exist
	// softDeleteMeme returns false if no row was updated
	EXPECT_FALSE(db->softDeleteMeme(999999));

	auto finalDeletedCount = db->getDeletedMemes(100, 0).size();
	EXPECT_EQ(initialDeletedCount, finalDeletedCount);
}

TEST_F(BatchOpsTest, AddMemeTagBatch_NonExistentTag_ReturnsFalseDueToConstraint) {
	MemeEntry m1;
	m1.fileHash = "batch_hash4";
	m1.filePath = "/foo4";
	m1.mimeType = "img";
	int64_t mId = db->insertMeme(m1);

	// tag ID 999999 doesn't exist
	// Database::addMemeTag now catches the SQLite exception and returns false
	EXPECT_FALSE(db->addMemeTag(mId, 999999));
}

}} // namespace quickmemes::testing
