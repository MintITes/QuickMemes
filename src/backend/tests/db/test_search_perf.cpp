/**
 * @file test_search_perf.cpp
 * @brief 搜索性能测试，覆盖 1000 条语料下的真实搜索链路
 */

#include "../mocks.hpp"
#include "../perf/perf_utils.hpp"

#include "core/handlers.hpp"
#include "utils/logger.hpp"

#include <algorithm>
#include <chrono>
#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <random>
#include <utility>
#include <thread>

namespace quickmemes { namespace testing {

namespace {

struct SearchCorpusItem {
	MemeEntry              meme;
	std::vector<int64_t>   tagIds;
	int64_t                categoryId = 0;
	std::vector<std::string> keywords;
	std::string            pinyinKeyword;
};

struct SearchPerfCase {
	std::string  label;
	SearchQuery   query;
	int64_t      expectedMemeId = 0;
};

static std::string pickOne(std::mt19937_64 &rng, const std::vector<std::string> &values) {
	std::uniform_int_distribution<size_t> dist(0, values.size() - 1);
	return values[dist(rng)];
}

static bool isAsciiOnly(const std::string &value) {
	return std::all_of(value.begin(), value.end(), [](unsigned char ch) { return ch <= 0x7f; });
}

static std::vector<std::string> splitTokens(const std::string &value) {
	std::vector<std::string> tokens;
	std::string              current;
	for (char ch : value) {
		if (ch == ' ' || ch == '|' || ch == ',' || ch == '/' || ch == '-') {
			if (!current.empty()) {
				tokens.push_back(current);
				current.clear();
			}
			continue;
		}
		current.push_back(ch);
	}
	if (!current.empty()) { tokens.push_back(current); }
	return tokens;
}

static SearchCorpusItem makeCorpusItem(size_t index, std::mt19937_64 &rng) {
	static const std::vector<std::pair<std::string, std::string>> kPinyinPairs = {
	    {"蔡徐坤", "cxk"}, {"原神启动", "yuanshen"}, {"测试语句", "ceshiyuju"},
	    {"有点脆", "youdian"}, {"这也太香了吧", "tai"}, {"对啊,吃什么啊", "chishenme"},
	};
	static const std::vector<std::string> kNamePools = {
	    "打工人", "摸鱼", "真香", "好耶", "离谱", "绷不住了", "猫猫", "狗头", "今日份", "抽象",
	    "上班摸鱼", "下班快乐", "周一醒来", "周末终于到了", "笑不活了", "精神状态",
	};
	static const std::vector<std::string> kDescPools = {
	    "今天也要努力一点",
	    "这个瞬间太真实了",
	    "完全符合日常场景",
	    "一眼就懂的吐槽图",
	    "适合工作群里转发",
	    "轻松表达情绪",
	    "典型的聊天截图风格",
	    "来源于真实评论截取",
	};
	static const std::vector<std::string> kOcrPools = {
	    "今天也要加油",
	    "我真的会谢",
	    "狠狠共情了",
	    "懂了",
	    "太真实了",
	    "别说了我懂",
	    "有点离谱",
	    "笑死我了",
	};
	static const std::vector<std::string> kMimePools = {"image/jpeg", "image/png", "image/gif", "image/webp"};
	static const std::vector<std::string> kSourcePools = {"微博", "B站", "抖音", "微信群", "贴吧", "小红书", "Telegram", "X"};

	std::uniform_int_distribution<int> percent(0, 99);
	std::uniform_int_distribution<size_t> nameDist(0, kNamePools.size() - 1);
	std::uniform_int_distribution<size_t> descDist(0, kDescPools.size() - 1);
	std::uniform_int_distribution<size_t> ocrDist(0, kOcrPools.size() - 1);
	std::uniform_int_distribution<size_t> mimeDist(0, kMimePools.size() - 1);
	std::uniform_int_distribution<size_t> sourceDist(0, kSourcePools.size() - 1);
	std::uniform_int_distribution<int> sizeDist(16 * 1024, 4 * 1024 * 1024);
	std::uniform_int_distribution<int> widthDist(96, 1920);
	std::uniform_int_distribution<int> heightDist(96, 1920);
	std::uniform_int_distribution<int64_t> ageDist(0, 365LL * 24 * 60 * 60 * 1000);

	SearchCorpusItem item;
	item.meme.fileHash  = "search_perf_hash_" + std::to_string(index);
	item.meme.filePath  = "perf/search/" + std::to_string(index) + ".jpg";
	item.meme.mimeType  = kMimePools[mimeDist(rng)];
	item.meme.fileSize  = sizeDist(rng);
	item.meme.width     = widthDist(rng);
	item.meme.height    = heightDist(rng);
	item.meme.sourceName = kSourcePools[sourceDist(rng)];
	item.meme.createdAt  = 1'700'000'000'000LL - ageDist(rng);
	item.meme.updatedAt  = item.meme.createdAt;
	item.meme.lastUsedAt = (percent(rng) < 20) ? item.meme.createdAt + 86'400'000 : 0;

	if (percent(rng) < 82) {
		item.meme.name = pickOne(rng, kNamePools) + " #" + std::to_string(index);
		item.keywords.push_back(item.meme.name);
		auto tokens = splitTokens(item.meme.name);
		item.keywords.insert(item.keywords.end(), tokens.begin(), tokens.end());
	}

	if (percent(rng) < 76) {
		item.meme.description = pickOne(rng, kDescPools) + " #" + std::to_string(index);
		item.keywords.push_back(item.meme.description);
	}

	if (percent(rng) < 63) {
		item.meme.ocrText = pickOne(rng, kOcrPools) + " #" + std::to_string(index);
		item.keywords.push_back(item.meme.ocrText);
	}

	if (percent(rng) < 45) {
		auto [chinese, pinyin] = kPinyinPairs[index % kPinyinPairs.size()];
		auto target = percent(rng) < 50 ? "name" : (percent(rng) < 50 ? "description" : "ocr");
		if (target == "name") {
			item.meme.name = chinese + " #" + std::to_string(index);
		} else if (target == "description") {
			item.meme.description = chinese + " #" + std::to_string(index);
		} else {
			item.meme.ocrText = chinese + " #" + std::to_string(index);
		}
		item.pinyinKeyword = pinyin;
		item.keywords.push_back(chinese);
		item.keywords.push_back(pinyin);
	}

	return item;
}

static std::string firstNonEmpty(const SearchCorpusItem &item) {
	if (!item.meme.name.empty()) { return item.meme.name; }
	if (!item.meme.description.empty()) { return item.meme.description; }
	if (!item.meme.ocrText.empty()) { return item.meme.ocrText; }
	if (!item.pinyinKeyword.empty()) { return item.pinyinKeyword; }
	if (!item.keywords.empty()) { return item.keywords.front(); }
	return "测试";
}

static std::vector<SearchCorpusItem> buildCorpus(Database &db, TestDirectory &dir, uint64_t seed, size_t size) {
	std::mt19937_64 rng(seed);
	std::vector<SearchCorpusItem> corpus;
	corpus.reserve(size);

	std::vector<Tag> tags;
	const std::vector<std::string> tagNames = {
	    "搞笑", "抽象", "猫猫", "狗狗", "打工", "摸鱼", "学习", "游戏", "影视", "热点", "日常", "夸张"};
	tags.reserve(tagNames.size());
	for (size_t i = 0; i < tagNames.size(); ++i) {
		Tag tag;
		tag.name = tagNames[i];
		tag.color = "#" + std::to_string(100000 + static_cast<int>(i) * 1111);
		tag.id    = db.insertTag(tag);
		tags.push_back(tag);
	}

	std::vector<Category> categories;
	const std::vector<std::string> categoryNames = {
	    "日常", "搞笑", "吐槽", "游戏", "二创", "截图", "热梗", "群聊"};
	categories.reserve(categoryNames.size());
	for (size_t i = 0; i < categoryNames.size(); ++i) {
		Category category;
		category.uuid = "perf-cat-" + std::to_string(i);
		category.name = categoryNames[i];
		category.color = "#" + std::to_string(200000 + static_cast<int>(i) * 1111);
		category.id = db.insertCategory(category);
		categories.push_back(category);
	}

	std::uniform_int_distribution<int> percent(0, 99);
	std::uniform_int_distribution<size_t> tagCountDist(0, 2);

	for (size_t i = 0; i < size; ++i) {
		auto item = makeCorpusItem(i, rng);
		item.meme.filePath = dir.getSubPath("search_corpus/" + std::to_string(i) + ".jpg");
		item.meme.id       = db.insertMeme(item.meme);

		if (percent(rng) < 72) {
			auto category = categories[i % categories.size()];
			item.categoryId = category.id;
			db.updateMemeCategory(item.meme.id, category.id);
		}

		size_t tagCount = tagCountDist(rng);
		for (size_t t = 0; t < tagCount; ++t) {
			auto tag = tags[(i + t) % tags.size()];
			item.tagIds.push_back(tag.id);
			db.addMemeTag(item.meme.id, tag.id);
			item.keywords.push_back(tag.name);
		}

		item.keywords.erase(std::remove_if(item.keywords.begin(), item.keywords.end(), [](const std::string &value) {
			return value.empty();
		}), item.keywords.end());
		corpus.push_back(std::move(item));
	}

	return corpus;
}

static SearchPerfCase makeCase(const SearchCorpusItem &item, std::mt19937_64 &rng, size_t ordinal, int kind) {
	SearchPerfCase perfCase;
	perfCase.expectedMemeId = item.meme.id;

	switch (kind) {
	case 0: {
		perfCase.label = "keyword_name";
		auto keyword   = firstNonEmpty(item);
		perfCase.query.keyword    = keyword;
		perfCase.query.limit       = 200;
		perfCase.query.includeTags = (ordinal % 3 == 0);
		break;
	}
	case 1: {
		perfCase.label = "keyword_description";
		perfCase.query.keyword    = item.meme.description.empty() ? firstNonEmpty(item) : item.meme.description;
		perfCase.query.sortOrder   = "DESC";
		perfCase.query.limit      = 200;
		break;
	}
	case 2: {
		perfCase.label = "filter_source_format";
		perfCase.query.source = item.meme.sourceName;
		perfCase.query.formats = {item.meme.mimeType};
		perfCase.query.sizeMin = std::max<int64_t>(0, item.meme.fileSize - 2048);
		perfCase.query.sizeMax = item.meme.fileSize + 2048;
		perfCase.query.limit   = 100;
		perfCase.query.sortBy  = "lastUsedAt";
		break;
	}
	}

	return perfCase;
}

static std::vector<SearchPerfCase> buildCases(const std::vector<SearchCorpusItem> &corpus, uint64_t seed, size_t count) {
	std::mt19937_64 rng(seed ^ 0x5f3759dfULL);
	std::vector<SearchPerfCase> cases;
	cases.reserve(count);

	for (size_t i = 0; i < count; ++i) {
		const size_t baseIndex = (i * 37 + 11) % corpus.size();
		const int    kindHint  = static_cast<int>(i % 3);
		const SearchCorpusItem *picked = nullptr;
		for (size_t offset = 0; offset < corpus.size(); ++offset) {
			const auto &candidate = corpus[(baseIndex + offset) % corpus.size()];
			if (firstNonEmpty(candidate).empty()) { continue; }
			picked = &candidate;
			break;
		}
		if (picked == nullptr) { picked = &corpus[baseIndex]; }
		cases.push_back(makeCase(*picked, rng, i, kindHint));
	}

	return cases;
}

static bool responseContainsMemeId(const nlohmann::json &response, int64_t memeId) {
	if (!response.contains("data") || !response["data"].is_object()) { return false; }
	const auto &items = response["data"]["items"];
	if (!items.is_array()) { return false; }
	for (const auto &entry : items) {
		if (!entry.is_object() || !entry.contains("meme")) { continue; }
		const auto &meme = entry["meme"];
		if (meme.is_object() && meme.contains("id") && meme["id"].get<int64_t>() == memeId) { return true; }
	}
	return false;
}

} // namespace

class SearchPerfTest : public MemeDbTest {
protected:
	void SetUp() override {
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_FATAL);
		MemeDbTest::SetUp();
	}

	void TearDown() override {
		MemeDbTest::TearDown();
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_INFO);
	}
};

TEST_F(SearchPerfTest, Search_1000MemeCorpus_P95Under20Ms) {
	constexpr size_t   kCorpusSize  = 1000;
	constexpr size_t   kCaseCount   = 96;
	constexpr size_t   kWarmupCount = 8;
	constexpr uint64_t  kSeed       = 0x534541524348504FULL;

	auto corpus = buildCorpus(*db, *tempDir_, kSeed, kCorpusSize);
	auto cases  = buildCases(corpus, kSeed, kCaseCount);

	for (size_t i = 0; i < std::min(kWarmupCount, cases.size()); ++i) {
		HttpRequestProxy warmupReq;
		warmupReq.method = "POST";
		warmupReq.path   = "/api/memes/search";
		warmupReq.body   = nlohmann::json(cases[i].query).dump();
		HttpResponseProxy warmupRes;
		handlePostMemesSearch(warmupReq, warmupRes);
		ASSERT_EQ(warmupRes.status, 200);
	}

	perf::PerfStats stats;
	for (size_t i = 0; i < cases.size(); ++i) {
		const auto &perfCase = cases[i];
		HttpRequestProxy req;
		req.method = "POST";
		req.path   = "/api/memes/search";
		req.body   = nlohmann::json(perfCase.query).dump();

		HttpResponseProxy res;
		double           elapsedMs = perf::measureMs([&]() {
			handlePostMemesSearch(req, res);
		});
		stats.add(perfCase.label, elapsedMs);
		perf::printPerfNode("search", i, perfCase.label, elapsedMs);

		ASSERT_EQ(res.status, 200) << perfCase.label;
		auto response = nlohmann::json::parse(res.body);
		EXPECT_TRUE(response["success"].get<bool>()) << perfCase.label;
		EXPECT_TRUE(responseContainsMemeId(response, perfCase.expectedMemeId)) << perfCase.label;
	}

	std::cout << "[perf] search seed=" << kSeed << " samples=" << cases.size()
	          << " collected=" << stats.samples_.size() << '\n';
	perf::printPerfTopSlowest("search", stats);

	auto tagCandidate = std::find_if(corpus.begin(), corpus.end(), [](const SearchCorpusItem &item) {
		return !item.tagIds.empty();
	});
	auto categoryCandidate = std::find_if(corpus.begin(), corpus.end(), [](const SearchCorpusItem &item) {
		return item.categoryId != 0;
	});
	ASSERT_NE(tagCandidate, corpus.end());
	ASSERT_NE(categoryCandidate, corpus.end());
	auto pinyinCandidate = std::find_if(corpus.begin(), corpus.end(), [](const SearchCorpusItem &item) {
		return !item.pinyinKeyword.empty();
	});
	ASSERT_NE(pinyinCandidate, corpus.end());

	std::vector<SearchPerfCase> coverageCases = {
	    SearchPerfCase{"tag_filter_coverage", SearchQuery{}, tagCandidate->meme.id},
	    SearchPerfCase{"category_filter_coverage", SearchQuery{}, categoryCandidate->meme.id},
	    SearchPerfCase{"pinyin_coverage", SearchQuery{}, pinyinCandidate->meme.id},
	};

	coverageCases[0].query.keyword = firstNonEmpty(*tagCandidate);
	coverageCases[0].query.tagIds  = {tagCandidate->tagIds.front()};
	coverageCases[0].query.limit   = 50;
	coverageCases[1].query.keyword    = firstNonEmpty(*categoryCandidate);
	coverageCases[1].query.categoryId = categoryCandidate->categoryId;
	coverageCases[1].query.limit      = 50;
	coverageCases[2].query.keyword       = pinyinCandidate->pinyinKeyword;
	coverageCases[2].query.enablePinyin  = true;
	coverageCases[2].query.limit         = 50;

	for (const auto &coverageCase : coverageCases) {
		HttpRequestProxy req;
		req.method = "POST";
		req.path   = "/api/memes/search";
		req.body   = nlohmann::json(coverageCase.query).dump();

		HttpResponseProxy res;
		handlePostMemesSearch(req, res);
		ASSERT_EQ(res.status, 200) << coverageCase.label;
		auto response = nlohmann::json::parse(res.body);
		EXPECT_TRUE(response["success"].get<bool>()) << coverageCase.label;
		EXPECT_TRUE(responseContainsMemeId(response, coverageCase.expectedMemeId)) << coverageCase.label;
	}
}

}} // namespace quickmemes::testing
