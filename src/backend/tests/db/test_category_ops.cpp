/**
 * @file test_category_ops.cpp
 * @brief Database Category 生命周期及关联测试
 */

#include "../mocks.hpp"

namespace quickmemes {
namespace testing {

TEST_F(MemeDbTest, InsertCategory_ValidCategory_ReturnsId) {
	Category c;
	c.name  = "Memes 2024";
	c.color = "#FFD700";
	c.uuid  = "uuid-123-456";
	int64_t id = db->insertCategory(c);
	EXPECT_GT(id, 0);

	auto cats = db->getCategories();
	ASSERT_FALSE(cats.empty());
	EXPECT_EQ(cats[0].name, "Memes 2024");
	EXPECT_EQ(cats[0].color, "#FFD700");
}

TEST_F(MemeDbTest, UpdateCategory_PartialPatch_UpdatesFields) {
	Category c;
	c.name  = "Old Name";
	c.color = "#000";
	c.uuid  = "u-update";
	int64_t id = db->insertCategory(c);

	CategoryPatch patch;
	std::string newName = "New Name";
	patch.name = newName;
	EXPECT_TRUE(db->updateCategory(id, patch));

	auto cats = db->getCategories();
	EXPECT_EQ(cats[0].name, "New Name");
	EXPECT_EQ(cats[0].color, "#000"); // Unchanged
}

TEST_F(MemeDbTest, DeleteCategory_ResetsMemeAssociations) {
	Category c;
	c.name = "Trash Bin";
	c.uuid = "u-del";
	int64_t catId = db->insertCategory(c);

	MemeEntry meme;
	meme.fileHash = "cat_hash1";
	meme.filePath = "/xyz";
	meme.mimeType = "img/png";
	int64_t mId = db->insertMeme(meme);

	EXPECT_TRUE(db->updateMemeCategory(mId, catId));
	
	auto mSearch = db->getMeme(mId);
	EXPECT_EQ(mSearch.categoryId, catId);

	EXPECT_TRUE(db->deleteCategory(catId));
	
	auto mAfter = db->getMeme(mId);
	EXPECT_EQ(mAfter.categoryId, 0); // Reset to 0
}

TEST_F(MemeDbTest, SearchByCategory_FiltersCorrectly) {
	Category c1, c2;
	c1.name = "Work"; c1.uuid = "u1";
	c2.name = "Fun";  c2.uuid = "u2";
	int64_t id1 = db->insertCategory(c1);
	int64_t id2 = db->insertCategory(c2);

	MemeEntry m1, m2, m3;
	m1.fileHash = "h1"; m1.filePath = "p1"; m1.mimeType="j"; db->insertMeme(m1);
	m2.fileHash = "h2"; m2.filePath = "p2"; m2.mimeType="j"; db->insertMeme(m2);
	m3.fileHash = "h3"; m3.filePath = "p3"; m3.mimeType="j"; db->insertMeme(m3);

	// Get IDs (assuming 1, 2, 3)
	int64_t m1id = 1, m2id = 2, m3id = 3;
	db->updateMemeCategory(m1id, id1);
	db->updateMemeCategory(m2id, id2);
	// m3 remains uncategorized (0)

	SearchQuery q;
	q.categoryId = id1;
	auto res1 = db->searchMemes(q);
	EXPECT_EQ(res1.items.size(), 1);
	EXPECT_EQ(res1.items[0].id, m1id);

	q.categoryId = id2;
	auto res2 = db->searchMemes(q);
	EXPECT_EQ(res2.items.size(), 1);
	EXPECT_EQ(res2.items[0].id, m2id);

	q.categoryId = -1; // Uncategorized
	auto res3 = db->searchMemes(q);
	EXPECT_EQ(res3.items.size(), 1);
	EXPECT_EQ(res3.items[0].id, m3id);
}

} // namespace testing
} // namespace quickmemes
