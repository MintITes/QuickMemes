/**
 * @file test_search.cpp
 * @brief Database 搜索功能（全文 + 向量）测试
 */

#include "../mocks.hpp"

namespace quickmemes { namespace testing {

TEST_F(MemeDbTest, SearchMemes_ValidQuery_ReturnsMatchingResults) {
	MemeEntry meme;
	meme.fileHash = "hash_search_1";
	meme.filePath = getSubPath("a.png");
	meme.mimeType = "image/png";
	meme.ocrText  = "Hello world from the meme";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "world";
	auto results = db->searchMemes(q);
	EXPECT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_1");
}

TEST_F(MemeDbTest, SearchMemes_NameKeywordSupportsPartialMatch) {
	MemeEntry meme;
	meme.fileHash = "hash_search_name_partial";
	meme.filePath = getSubPath("partial.png");
	meme.mimeType = "image/png";
	meme.name     = "FunnyReactionFace";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "Reaction";
	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_name_partial");
}

TEST_F(MemeDbTest, SearchMemes_OcrKeywordSupportsPartialMatch) {
	MemeEntry meme;
	meme.fileHash = "hash_search_ocr_partial";
	meme.filePath = getSubPath("ocr_partial.png");
	meme.mimeType = "image/png";
	meme.ocrText   = "识别到的中文文本";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "中文文";
	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_ocr_partial");
}

TEST_F(MemeDbTest, SearchMemes_TagKeyword_ReturnsMatchingResults) {
	MemeEntry meme;
	meme.fileHash  = "hash_search_tag_1";
	meme.filePath  = getSubPath("tagged.png");
	meme.mimeType  = "image/png";
	meme.name      = "Unrelated title";
	int64_t memeId = db->insertMeme(meme);

	Tag tag;
	tag.name      = "Reaction";
	tag.color     = "#ffffff";
	int64_t tagId = db->insertTag(tag);
	ASSERT_TRUE(db->addMemeTag(memeId, tagId));

	SearchQuery q;
	q.keyword    = "reaction";
	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_tag_1");
	ASSERT_EQ(results.items[0].tags.size(), 1);
	EXPECT_EQ(results.items[0].tags[0].name, "Reaction");
}

TEST_F(MemeDbTest, VectorSearch_ValidEmbedding_ReturnsRankedResults) {
	MemeEntry meme;
	meme.fileHash = "hash_vec_1";
	meme.filePath = getSubPath("b.png");
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	std::vector<float> embed(1536, 0.1f);
	db->upsertEmbedding(id, embed);

	auto results = db->vectorSearch(embed, 10);
	EXPECT_GE(results.size(), 1);
}

TEST_F(MemeDbTest, VectorSearch_InsufficientDimension_ThrowsError) {
	std::vector<float> bad(10, 0.1f);
	EXPECT_THROW(db->vectorSearch(bad, 10), ApiException);
}

TEST_F(MemeDbTest, SearchMemes_AllFilters_Works) {
	// Setup diverse memes
	MemeEntry m1;
	m1.fileHash  = "h1";
	m1.filePath  = "p1.png";
	m1.mimeType  = "image/png";
	m1.fileSize  = 100;
	m1.createdAt = 1000;
	m1.name      = "Apple";
	db->insertMeme(m1);
	MemeEntry m2;
	m2.fileHash  = "h2";
	m2.filePath  = "p2.jpg";
	m2.mimeType  = "image/jpeg";
	m2.fileSize  = 200;
	m2.createdAt = 2000;
	m2.name      = "Banana";
	db->insertMeme(m2);
	MemeEntry m3;
	m3.fileHash  = "h3";
	m3.filePath  = "p3.gif";
	m3.mimeType  = "image/gif";
	m3.fileSize  = 300;
	m3.createdAt = 3000;
	m3.name      = "Cherry";
	db->insertMeme(m3);

	SearchQuery q;

	// 1. Time filter
	q.timeFrom   = 1500;
	q.timeTo     = 2500;
	auto resTime = db->searchMemes(q);
	EXPECT_EQ(resTime.items.size(), 1);
	EXPECT_EQ(resTime.items[0].fileHash, "h2");

	// 2. Format filter
	q              = SearchQuery();
	q.formats      = {"image/png", "image/gif"};
	auto resFormat = db->searchMemes(q);
	EXPECT_EQ(resFormat.items.size(), 2);

	// 3. Size filter
	q            = SearchQuery();
	q.sizeMin    = 150;
	q.sizeMax    = 250;
	auto resSize = db->searchMemes(q);
	EXPECT_EQ(resSize.items.size(), 1);
	EXPECT_EQ(resSize.items[0].fileHash, "h2");

	// 4. Regex filter
	q             = SearchQuery();
	q.regex       = "^B.*a$"; // Banana
	auto resRegex = db->searchMemes(q);
	EXPECT_EQ(resRegex.items.size(), 1);
	EXPECT_EQ(resRegex.items[0].fileHash, "h2");
}

TEST_F(MemeDbTest, SearchMemes_Sorting_Works) {
	MemeEntry m1;
	m1.fileHash   = "h1";
	m1.filePath   = "p1";
	m1.name       = "A";
	m1.createdAt  = 100;
	m1.lastUsedAt = 300;
	db->insertMeme(m1);
	MemeEntry m2;
	m2.fileHash   = "h2";
	m2.filePath   = "p2";
	m2.name       = "B";
	m2.createdAt  = 200;
	m2.lastUsedAt = 100;
	db->insertMeme(m2);

	SearchQuery q;

	// Sort by createdAt ASC
	q.sortBy    = "createdAt";
	q.sortOrder = "ASC";
	auto res1   = db->searchMemes(q);
	ASSERT_EQ(res1.items.size(), 2);
	EXPECT_EQ(res1.items[0].fileHash, "h1");

	// Sort by lastUsedAt DESC
	q.sortBy    = "lastUsedAt";
	q.sortOrder = "DESC";
	auto res2   = db->searchMemes(q);
	ASSERT_EQ(res2.items.size(), 2);
	EXPECT_EQ(res2.items[0].fileHash, "h1");
}

}} // namespace quickmemes::testing
