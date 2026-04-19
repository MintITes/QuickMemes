/**
 * @file test_category_ops.cpp
 * @brief Database Category 生命周期及关联测试
 */

#include "../mocks.hpp"

namespace quickmemes { namespace testing {

TEST_F(MemeDbTest, InsertCategory_ValidCategory_ReturnsId) {
	Category c;
	c.name     = "Memes 2024";
	c.color    = "#FFD700";
	c.uuid     = "uuid-123-456";
	int64_t id = db->insertCategory(c);
	EXPECT_GT(id, 0);

	auto cats = db->getCategories();
	ASSERT_FALSE(cats.empty());
	EXPECT_EQ(cats[0].name, "Memes 2024");
	EXPECT_EQ(cats[0].color, "#FFD700");
	EXPECT_EQ(cats[0].position, 1);
}

TEST_F(MemeDbTest, InsertCategory_WithoutUuid_GeneratesDistinctUuids) {
	Category c1;
	c1.name  = "Auto UUID 1";
	c1.color = "#123456";

	Category c2;
	c2.name  = "Auto UUID 2";
	c2.color = "#654321";

	const int64_t id1 = db->insertCategory(c1);
	const int64_t id2 = db->insertCategory(c2);

	EXPECT_GT(id1, 0);
	EXPECT_GT(id2, 0);
	EXPECT_NE(id1, id2);

	const auto cats = db->getCategories();
	ASSERT_EQ(cats.size(), 2);
	EXPECT_FALSE(cats[0].uuid.empty());
	EXPECT_FALSE(cats[1].uuid.empty());
	EXPECT_NE(cats[0].uuid, cats[1].uuid);
	EXPECT_EQ(cats[0].position, 1);
	EXPECT_EQ(cats[1].position, 2);
}

TEST_F(MemeDbTest, UpdateCategory_PartialPatch_UpdatesFields) {
	Category c;
	c.name     = "Old Name";
	c.color    = "#000";
	c.uuid     = "u-update";
	int64_t id = db->insertCategory(c);

	CategoryPatch patch;
	std::string   newName = "New Name";
	patch.name            = newName;
	EXPECT_TRUE(db->updateCategory(id, patch));

	auto cats = db->getCategories();
	EXPECT_EQ(cats[0].name, "New Name");
	EXPECT_EQ(cats[0].color, "#000"); // Unchanged
}

TEST_F(MemeDbTest, UpdateCategory_Position_ReordersCategories) {
	Category first;
	first.name            = "First";
	first.color           = "#111111";
	first.uuid            = "u-first";
	const int64_t firstId = db->insertCategory(first);

	Category second;
	second.name            = "Second";
	second.color           = "#222222";
	second.uuid            = "u-second";
	const int64_t secondId = db->insertCategory(second);

	CategoryPatch patch;
	patch.position = 0;
	EXPECT_TRUE(db->updateCategory(firstId, patch));

	auto categories = db->getCategories();
	ASSERT_EQ(categories.size(), 2);
	EXPECT_EQ(categories[0].id, firstId);

	patch.position = 3;
	EXPECT_TRUE(db->updateCategory(firstId, patch));

	categories = db->getCategories();
	ASSERT_EQ(categories.size(), 2);
	EXPECT_EQ(categories[0].id, secondId);
	EXPECT_EQ(categories[1].id, firstId);
	EXPECT_EQ(categories[1].position, 3);
}

TEST_F(MemeDbTest, DeleteCategory_ResetsMemeAssociations) {
	Category c;
	c.name        = "Trash Bin";
	c.uuid        = "u-del";
	int64_t catId = db->insertCategory(c);

	MemeEntry meme;
	meme.fileHash = "cat_hash1";
	meme.filePath = "/xyz";
	meme.mimeType = "img/png";
	int64_t mId   = db->insertMeme(meme);

	EXPECT_TRUE(db->updateMemeCategory(mId, catId));

	auto mSearch = db->getMeme(mId);
	EXPECT_EQ(mSearch.categoryId, catId);

	EXPECT_TRUE(db->deleteCategory(catId));

	auto mAfter = db->getMeme(mId);
	EXPECT_EQ(mAfter.categoryId, 0); // Reset to 0
}

TEST_F(MemeDbTest, SearchByCategory_FiltersCorrectly) {
	Category c1, c2;
	c1.name     = "Work";
	c1.uuid     = "u1";
	c2.name     = "Fun";
	c2.uuid     = "u2";
	int64_t id1 = db->insertCategory(c1);
	int64_t id2 = db->insertCategory(c2);

	MemeEntry m1, m2, m3, m4, m5;
	m1.fileHash = "h1";
	m1.filePath = "p1";
	m1.mimeType = "j";
	db->insertMeme(m1);
	m2.fileHash = "h2";
	m2.filePath = "p2";
	m2.mimeType = "j";
	db->insertMeme(m2);
	m3.fileHash = "h3";
	m3.filePath = "p3";
	m3.mimeType = "j";
	db->insertMeme(m3);
	m4.fileHash = "h4";
	m4.filePath = "p4";
	m4.mimeType = "j";
	m4.ocrText  = "recognized text";
	db->insertMeme(m4);
	m5.fileHash = "h5";
	m5.filePath = "p5";
	m5.mimeType = "j";
	db->insertMeme(m5);

	// Get IDs (assuming insert order)
	int64_t m1id = 1, m2id = 2, m3id = 3, m4id = 4, m5id = 5;
	db->updateMemeCategory(m1id, id1);
	db->updateMemeCategory(m2id, id2);
	// m3 remains fully uncategorized (no category, no tags, no OCR)
	Tag tag;
	tag.name      = "has-tag";
	int64_t tagId = db->insertTag(tag);
	ASSERT_TRUE(db->addMemeTag(m5id, tagId));

	SearchQuery q;
	q.categoryId = id1;
	auto res1    = db->searchMemes(q);
	EXPECT_EQ(res1.items.size(), 1);
	EXPECT_EQ(res1.items[0].id, m1id);

	q.categoryId = id2;
	auto res2    = db->searchMemes(q);
	EXPECT_EQ(res2.items.size(), 1);
	EXPECT_EQ(res2.items[0].id, m2id);

	q.categoryId = -1; // No category, no tags, no OCR
	auto res3    = db->searchMemes(q);
	EXPECT_EQ(res3.items.size(), 1);
	EXPECT_EQ(res3.items[0].id, m3id);
	EXPECT_NE(res3.items[0].id, m4id);
	EXPECT_NE(res3.items[0].id, m5id);
}

}} // namespace quickmemes::testing
