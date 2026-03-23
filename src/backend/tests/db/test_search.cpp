/**
 * @file test_search.cpp
 * @brief Database 搜索功能（全文 + 向量）测试
 */

#include "../mocks.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <chrono>
#include <iostream>

namespace {
std::string quoteField(const std::string &value) { return "\"" + value + "\""; }

std::string summarizeMeme(const quickmemes::MemeEntry &meme) {
	if (!meme.name.empty()) return meme.name;
	if (!meme.description.empty()) return meme.description;
	return meme.ocrText;
}

void printSearchDebug(const char *label, const quickmemes::MemeEntry &meme, const quickmemes::SearchQuery &q,
                      const quickmemes::PagedMemeResults &results) {
	std::cout << "插入项:"
	          << " fileHash=" << meme.fileHash
	          << " name=" << meme.name
	          << " description=" << meme.description
	          << " ocrText=" << meme.ocrText << '\n';
	std::cout << "搜索字符串:"
	          << " keyword=" << q.keyword
	          << " enablePinyin=" << (q.enablePinyin ? "true" : "false")
	          << " resultCount=" << results.items.size() << '\n';
	for (size_t i = 0; i < results.items.size(); ++i) {
		const auto &item = results.items[i];
		std::cout << "匹配项:"
		          << " index=" << i
		          << " fileHash=" << item.fileHash
		          << " name=" << item.name
		          << " description=" << item.description
		          << " ocrText=" << item.ocrText << '\n';
	}
}

void printCorpusDebug(const char *label, const std::vector<quickmemes::MemeEntry> &memes) {
	std::cout << "插入项:";
	for (size_t i = 0; i < memes.size(); ++i) {
		if (i > 0) std::cout << ' ';
		std::cout << "[" << (i + 1) << "]" << quoteField(summarizeMeme(memes[i]));
	}
	std::cout << '\n';
}

void printQuerySummary(const char *label, const quickmemes::SearchQuery &q, const quickmemes::PagedMemeResults &results) {
	(void)label;
	std::cout << "搜索字符串:" << quoteField(q.keyword) << " enablePinyin=" << (q.enablePinyin ? "true" : "false")
	          << '\n';
	std::cout << "匹配项:";
	if (results.items.empty()) {
		std::cout << "[]" << '\n';
		return;
	}
	for (size_t i = 0; i < results.items.size(); ++i) {
		if (i > 0) std::cout << ' ';
		std::cout << "[" << (i + 1) << "]" << quoteField(summarizeMeme(results.items[i]));
	}
	std::cout << '\n';
}
} // namespace

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
	printSearchDebug("SearchMemes_NameKeywordSupportsPartialMatch", meme, q, results);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_name_partial");
}

TEST_F(MemeDbTest, SearchMemes_DescriptionAsciiSubstringDoesNotFallback) {
	MemeEntry meme;
	meme.fileHash    = "hash_search_desc_ascii_no_fallback";
	meme.filePath    = getSubPath("desc_ascii.png");
	meme.mimeType    = "image/png";
	meme.description = "FunnyReactionFace";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "Reaction";
	auto results = db->searchMemes(q);
	printSearchDebug("SearchMemes_DescriptionAsciiSubstringDoesNotFallback", meme, q, results);

	EXPECT_TRUE(results.items.empty());
}

TEST_F(MemeDbTest, SearchMemes_ChineseKeywordMatchesName) {
	MemeEntry meme;
	meme.fileHash = "hash_search_chinese_name";
	meme.filePath = getSubPath("chinese_name.png");
	meme.mimeType = "image/png";
	meme.name     = "测试表情包";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "表情包";
	auto results = db->searchMemes(q);
	printSearchDebug("SearchMemes_ChineseKeywordMatchesName", meme, q, results);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_chinese_name");
}

TEST_F(MemeDbTest, SearchMemes_OcrKeywordSupportsPartialMatch) {
	MemeEntry meme;
	meme.fileHash = "hash_search_ocr_partial";
	meme.filePath = getSubPath("ocr_partial.png");
	meme.mimeType = "image/png";
	meme.ocrText  = "识别到的中文文本";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "中文文";
	auto results = db->searchMemes(q);
	printSearchDebug("SearchMemes_OcrKeywordSupportsPartialMatch", meme, q, results);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_ocr_partial");
}

TEST_F(MemeDbTest, SearchMemes_PinyinKeywordMatchesChineseTextWhenEnabled) {
	MemeEntry meme;
	meme.fileHash    = "hash_search_pinyin_enabled";
	meme.filePath    = getSubPath("pinyin_enabled.png");
	meme.mimeType    = "image/png";
	meme.description = "测试语句";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword    = "ceshiyuju";
	auto results = db->searchMemes(q);
	printSearchDebug("SearchMemes_PinyinKeywordMatchesChineseTextWhenEnabled", meme, q, results);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_pinyin_enabled");
}

TEST_F(MemeDbTest, SearchMemes_PinyinKeywordDoesNotMatchWhenDisabled) {
	MemeEntry meme;
	meme.fileHash = "hash_search_pinyin_disabled";
	meme.filePath = getSubPath("pinyin_disabled.png");
	meme.mimeType = "image/png";
	meme.ocrText  = "测试语句";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword       = "ceshiyuju";
	q.enablePinyin  = false;
	auto results    = db->searchMemes(q);
	printSearchDebug("SearchMemes_PinyinKeywordDoesNotMatchWhenDisabled", meme, q, results);

	EXPECT_TRUE(results.items.empty());
}

TEST_F(MemeDbTest, SearchMemes_ChineseKeywordStillMatchesWhenPinyinDisabled) {
	MemeEntry meme;
	meme.fileHash    = "hash_search_chinese_no_pinyin";
	meme.filePath    = getSubPath("chinese_no_pinyin.png");
	meme.mimeType    = "image/png";
	meme.description = "测试语句";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword       = "测试语句";
	q.enablePinyin  = false;
	auto results    = db->searchMemes(q);
	printSearchDebug("SearchMemes_ChineseKeywordStillMatchesWhenPinyinDisabled", meme, q, results);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_chinese_no_pinyin");
}

TEST_F(MemeDbTest, SearchMemes_MixedChineseAndPinyinQueries_ReturnExpectedResultsRepeatedly) {
	std::vector<MemeEntry> corpus;

	MemeEntry cai;
	cai.fileHash = "hash_search_mix_cxk";
	cai.filePath = getSubPath("mix_cxk.png");
	cai.mimeType = "image/png";
	cai.name     = "蔡徐坤";
	corpus.push_back(cai);

	MemeEntry eat;
	eat.fileHash    = "hash_search_mix_eat";
	eat.filePath    = getSubPath("mix_eat.png");
	eat.mimeType    = "image/png";
	eat.description = "对啊,吃什么啊";
	corpus.push_back(eat);

	MemeEntry genshin;
	genshin.fileHash = "hash_search_mix_yuanshen";
	genshin.filePath = getSubPath("mix_yuanshen.png");
	genshin.mimeType = "image/png";
	genshin.ocrText  = "原神启动";
	corpus.push_back(genshin);

	MemeEntry crispy;
	crispy.fileHash    = "hash_search_mix_youdian";
	crispy.filePath    = getSubPath("mix_youdian.png");
	crispy.mimeType    = "image/png";
	crispy.description = "有点脆";
	corpus.push_back(crispy);

	MemeEntry tasty;
	tasty.fileHash = "hash_search_mix_tai";
	tasty.filePath = getSubPath("mix_tai.png");
	tasty.mimeType = "image/png";
	tasty.ocrText  = "这也太香了吧";
	corpus.push_back(tasty);

	for (const auto &meme : corpus) { db->insertMeme(meme); }
	printCorpusDebug("SearchMemes_MixedChineseAndPinyinQueries_ReturnExpectedResultsRepeatedly", corpus);

	struct QueryCase {
		const char *label;
		const char *keyword;
		const char *expectedFileHash;
	};

	const std::vector<QueryCase> cases = {
	    {"single-char-to-sentence", "蔡", "hash_search_mix_cxk"},
	    {"multi-char-to-sentence", "吃什么", "hash_search_mix_eat"},
	    {"full-pinyin-to-sentence", "yuanshen", "hash_search_mix_yuanshen"},
	    {"pinyin-initials-to-sentence", "cxk", "hash_search_mix_cxk"},
	    {"single-char-plus-pinyin", "有dian", "hash_search_mix_youdian"},
	    {"multi-char-plus-pinyin", "这也tai", "hash_search_mix_tai"},
	};

	for (const auto &queryCase : cases) {
		SearchQuery q;
		q.keyword = queryCase.keyword;
		auto results = db->searchMemes(q);
		printQuerySummary(queryCase.label, q, results);

		ASSERT_FALSE(results.items.empty()) << "keyword=" << queryCase.keyword;
		EXPECT_EQ(results.items[0].fileHash, queryCase.expectedFileHash) << "keyword=" << queryCase.keyword;
	}
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

TEST_F(MemeDbTest, SearchMemes_CategoryKeyword_ReturnsMatchingResults) {
	Category category;
	category.uuid  = "cat-search-1";
	category.name  = "Reaction";
	category.color = "#ffffff";
	int64_t categoryId = db->insertCategory(category);

	MemeEntry meme;
	meme.fileHash = "hash_search_category_1";
	meme.filePath = getSubPath("category.png");
	meme.mimeType = "image/png";
	int64_t memeId = db->insertMeme(meme);
	ASSERT_TRUE(db->updateMemeCategory(memeId, categoryId));

	SearchQuery byCategoryId;
	byCategoryId.categoryId = categoryId;
	auto categoryResults = db->searchMemes(byCategoryId);
	ASSERT_EQ(categoryResults.items.size(), 1);
	EXPECT_EQ(categoryResults.items[0].fileHash, "hash_search_category_1");

	SearchQuery q;
	q.keyword    = "reaction";
	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	EXPECT_EQ(results.items[0].fileHash, "hash_search_category_1");
	EXPECT_EQ(results.items[0].categoryId, categoryId);
}

TEST_F(MemeDbTest, SearchMemes_HybridSearch_PopulatesRelevanceScores) {
	MemeEntry meme;
	meme.fileHash = "hash_search_hybrid_score";
	meme.filePath = getSubPath("hybrid_score.png");
	meme.mimeType = "image/png";
	meme.ocrText  = "hybrid search world";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword = "world";
	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	ASSERT_EQ(results.scoredItems.size(), 1);
	EXPECT_GT(results.scoredItems[0].relevanceScore, 0.0f);
	EXPECT_GT(results.scoredItems[0].scoreBreakdown.ocrText, 0.0f);
	EXPECT_EQ(results.scoredItems[0].similarityScore, -1.0f);
}

TEST_F(MemeDbTest, SearchMemes_VectorUnavailable_FallsBackToTextScoring) {
	MemeEntry meme;
	meme.fileHash    = "hash_search_vector_fallback";
	meme.filePath    = getSubPath("vector_fallback.png");
	meme.mimeType    = "image/png";
	meme.description = "vector fallback text";
	db->insertMeme(meme);

	SearchQuery q;
	q.keyword   = "fallback";
	q.useVector = true;

	auto results = db->searchMemes(q);

	ASSERT_EQ(results.items.size(), 1);
	ASSERT_EQ(results.scoredItems.size(), 1);
	EXPECT_GT(results.scoredItems[0].relevanceScore, 0.0f);
	EXPECT_EQ(results.scoredItems[0].similarityScore, -1.0f);
	EXPECT_EQ(results.scoredItems[0].scoreBreakdown.vectorDescription, 0.0f);
	EXPECT_EQ(results.scoredItems[0].scoreBreakdown.vectorOcr, 0.0f);
}

TEST_F(MemeDbTest, VectorSearch_ValidEmbedding_ReturnsRankedResults) {
	MemeEntry meme;
	meme.fileHash = "hash_vec_1";
	meme.filePath = getSubPath("b.png");
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	std::vector<float> embed(512, 0.1f);
	db->upsertDescriptionEmbedding(id, embed);

	auto results = db->vectorSearch(embed, 10);
	EXPECT_GE(results.size(), 1);
}

TEST_F(MemeDbTest, VectorSearch_InsufficientDimension_ThrowsError) {
	std::vector<float> bad(10, 0.1f);
	EXPECT_THROW(db->vectorSearch(bad, 10), ApiException);
}

TEST_F(MemeDbTest, EmbeddingTables_DescriptionAndOcrStoreSeparately) {
	MemeEntry meme;
	meme.fileHash = "hash_vec_split_1";
	meme.filePath = getSubPath("split.png");
	meme.mimeType = "image/png";
	int64_t id    = db->insertMeme(meme);

	std::vector<float> desc(512, 0.2f);
	std::vector<float> ocr(512, 0.3f);
	db->upsertDescriptionEmbedding(id, desc);
	db->upsertOcrEmbedding(id, ocr);

	auto rawDb = db->getRawDatabase();
	ASSERT_NE(rawDb, nullptr);

	SQLite::Statement descStmt(*rawDb, "SELECT count(*) FROM vec_meme_desc WHERE meme_id = ?");
	descStmt.bind(1, id);
	ASSERT_TRUE(descStmt.executeStep());
	EXPECT_EQ(descStmt.getColumn(0).getInt(), 1);

	SQLite::Statement ocrStmt(*rawDb, "SELECT count(*) FROM vec_meme_ocr WHERE meme_id = ?");
	ocrStmt.bind(1, id);
	ASSERT_TRUE(ocrStmt.executeStep());
	EXPECT_EQ(ocrStmt.getColumn(0).getInt(), 1);
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

TEST_F(MemeDbTest, SearchMemes_Performance_100CasesUnder50ms) {
#ifndef NDEBUG
	GTEST_SKIP() << "Performance threshold is enforced in Release builds";
#endif

	std::vector<int64_t> categoryIds;
	categoryIds.reserve(200);
	for (int i = 0; i < 200; ++i) {
		Category category;
		category.uuid  = "perf-category-" + std::to_string(i);
		category.name  = "category-key-" + std::to_string(i);
		category.color = "#ffffff";
		categoryIds.push_back(db->insertCategory(category));
	}

	std::vector<int64_t> tagIds;
	tagIds.reserve(1000);
	for (int i = 0; i < 1000; ++i) {
		Tag tag;
		tag.name  = "tag-key-" + std::to_string(i);
		tag.color = "#ffffff";
		tagIds.push_back(db->insertTag(tag));
	}

	for (int i = 0; i < 10000; ++i) {
		MemeEntry meme;
		meme.fileHash    = "perf-hash-" + std::to_string(i);
		meme.filePath    = getSubPath("perf-" + std::to_string(i) + ".png");
		meme.mimeType    = "image/png";
		meme.name        = "name-key-" + std::to_string(i % 500);
		meme.description = "desc-key-" + std::to_string(i % 300);
		meme.ocrText     = "ocr-key-" + std::to_string(i % 300);
		int64_t memeId   = db->insertMeme(meme);
		ASSERT_TRUE(db->updateMemeCategory(memeId, categoryIds[i % categoryIds.size()]));
		ASSERT_TRUE(db->addMemeTag(memeId, tagIds[i % tagIds.size()]));
	}

	std::vector<SearchQuery> warmups;
	for (int i = 0; i < 10; ++i) {
		SearchQuery q;
		q.keyword = "name-key-" + std::to_string(i);
		q.sortBy  = "relevance";
		q.limit   = 20;
		warmups.push_back(q);
	}
	for (const auto &q : warmups) { (void)db->searchMemes(q); }

	std::vector<SearchQuery> cases;
	cases.reserve(100);
	for (int i = 0; i < 25; ++i) {
		SearchQuery byName;
		byName.keyword = "name-key-" + std::to_string(i);
		byName.sortBy  = "relevance";
		byName.limit   = 20;
		cases.push_back(byName);

		SearchQuery byDesc;
		byDesc.keyword = "desc-key-" + std::to_string(i);
		byDesc.sortBy  = "relevance";
		byDesc.limit   = 20;
		cases.push_back(byDesc);

		SearchQuery byTag;
		byTag.keyword = "tag-key-" + std::to_string(i);
		byTag.sortBy  = "relevance";
		byTag.limit   = 20;
		cases.push_back(byTag);

		SearchQuery byCategory;
		byCategory.keyword = "category-key-" + std::to_string(i);
		byCategory.sortBy  = "relevance";
		byCategory.limit   = 20;
		cases.push_back(byCategory);
	}

	ASSERT_EQ(cases.size(), 100u);

	long long totalMs = 0;
	long long maxMs   = 0;
	for (size_t i = 0; i < cases.size(); ++i) {
		auto started = std::chrono::steady_clock::now();
		auto results = db->searchMemes(cases[i]);
		auto elapsed =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - started).count();
		totalMs = totalMs + elapsed;
		maxMs   = std::max(maxMs, static_cast<long long>(elapsed));
		ASSERT_FALSE(results.items.empty()) << "case=" << i << " keyword=" << cases[i].keyword;
		EXPECT_LE(elapsed, 50) << "case=" << i << " keyword=" << cases[i].keyword;
	}

	std::cout << "search perf totalMs=" << totalMs << " avgMs=" << (totalMs / static_cast<long long>(cases.size()))
	          << " maxMs=" << maxMs << '\n';
}

}} // namespace quickmemes::testing
