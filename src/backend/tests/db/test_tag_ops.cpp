/**
 * @file test_tag_ops.cpp
 * @brief Database Tag 生命周期及关联测试
 */

#include "../mocks.hpp"

namespace quickmemes { namespace testing {

TEST_F(MemeDbTest, InsertTag_ValidTag_ReturnsId) {
	Tag t;
	t.name     = "Anime";
	t.color    = "#FF0000";
	int64_t id = db->insertTag(t);
	EXPECT_GT(id, 0);
}

TEST_F(MemeDbTest, InsertTag_DuplicateName_ThrowsDuplicate) {
	Tag t;
	t.name  = "Anime";
	t.color = "#FF0000";
	db->insertTag(t);
	EXPECT_THROW(db->insertTag(t), ApiException);
}

TEST_F(MemeDbTest, GetTags_ReturnsAllTagsOrdered) {
	Tag t1, t2;
	t1.name  = "B_tag";
	t1.color = "#000";
	t2.name  = "A_tag";
	t2.color = "#FFF";
	db->insertTag(t1);
	db->insertTag(t2);

	auto tags = db->getTags();
	ASSERT_EQ(tags.size(), 2);
	EXPECT_EQ(tags[0].name, "A_tag");
}

TEST_F(MemeDbTest, AddAndGetMemeTags_ReturnsAssociatedTags) {
	MemeEntry meme;
	meme.fileHash = "tags_hash1";
	meme.filePath = "/foo";
	meme.mimeType = "img";
	int64_t mId   = db->insertMeme(meme);

	Tag t;
	t.name        = "Funny";
	t.color       = "";
	int64_t tagId = db->insertTag(t);

	EXPECT_TRUE(db->addMemeTag(mId, tagId));
	auto mt = db->getMemeTags(mId);
	ASSERT_EQ(mt.size(), 1);
	EXPECT_EQ(mt[0].name, "Funny");
}

TEST_F(MemeDbTest, RemoveMemeTag_ExistingBond_RemovesAssociation) {
	MemeEntry meme;
	meme.fileHash = "tags_hash2";
	meme.filePath = "/foo";
	meme.mimeType = "img";
	int64_t mId   = db->insertMeme(meme);

	Tag t;
	t.name        = "Sad";
	t.color       = "";
	int64_t tagId = db->insertTag(t);

	db->addMemeTag(mId, tagId);
	EXPECT_TRUE(db->removeMemeTag(mId, tagId));
	auto mt = db->getMemeTags(mId);
	EXPECT_TRUE(mt.empty());
}

TEST_F(MemeDbTest, DeleteTag_ExistingTag_RemovesTag) {
	Tag t;
	t.name        = "ToDelete";
	int64_t tagId = db->insertTag(t);
	EXPECT_TRUE(db->deleteTag(tagId));
	auto tags = db->getTags();
	for (const auto &tag : tags) {
		EXPECT_NE(tag.id, tagId);
	}
}

}} // namespace quickmemes::testing
