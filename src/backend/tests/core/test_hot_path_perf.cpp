/**
 * @file test_hot_path_perf.cpp
 * @brief Perf coverage for the most common backend hot paths.
 */

#include "../mocks.hpp"
#include "../perf/perf_utils.hpp"

#include "core/handlers.hpp"
#include "core/task_queue.hpp"
#include "utils/logger.hpp"

#include <algorithm>
#include <filesystem>
#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <vector>

namespace quickmemes { namespace testing {

namespace {

struct HotPathItem {
	int64_t     memeId = 0;
	std::string absoluteFilePath;
	std::string absoluteThumbPath;
	bool        hasThumbnail = false;
};

struct HotPathTaxonomyData {
	std::vector<int64_t> tagIds;
	std::vector<int64_t> categoryIds;
};

HttpRequestProxy makeRequest(std::string method, std::string path) {
	HttpRequestProxy req;
	req.method = std::move(method);
	req.path   = std::move(path);
	return req;
}

std::vector<int64_t> collectMemeIds(const std::vector<HotPathItem> &items, size_t offset, size_t count) {
	std::vector<int64_t> ids;
	ids.reserve(count);

	for (size_t i = 0; i < count && offset + i < items.size(); ++i) {
		ids.push_back(items[offset + i].memeId);
	}

	return ids;
}

std::vector<HotPathItem> buildHotPathCorpus(Database &db, const std::string &storageRoot, size_t count) {
	std::vector<HotPathItem> items;
	items.reserve(count);

	for (size_t i = 0; i < count; ++i) {
		const bool hasThumbnail = (i % 2 == 0);
		const auto relativePath = std::filesystem::path("perf_hot_path") / ("meme_" + std::to_string(i) + ".jpg");
		const auto fileHash     = "perf_hot_hash_" + std::to_string(i);
		const auto absoluteFilePath = (std::filesystem::path(storageRoot) / relativePath).string();
		const auto absoluteThumbPath =
		    (std::filesystem::path(storageRoot) / "thumbs" / relativePath.parent_path() / (fileHash + ".jpg")).string();

		perf::writeTinyJpeg(absoluteFilePath);
		if (hasThumbnail) {
			perf::writeTinyJpeg(absoluteThumbPath);
		}

		MemeEntry meme;
		meme.fileHash    = fileHash;
		meme.filePath    = relativePath.string();
		meme.mimeType    = "image/jpeg";
		meme.fileSize    = 2048 + static_cast<int64_t>(i);
		meme.width       = 640;
		meme.height      = 480;
		meme.sourceName  = "perf";
		meme.name        = "hot_path_" + std::to_string(i);
		meme.description = "hot_path_description_" + std::to_string(i);
		meme.createdAt   = 1'700'000'000'000LL + static_cast<int64_t>(i);
		meme.updatedAt   = meme.createdAt;

		items.push_back(HotPathItem{
		    db.insertMeme(meme),
		    absoluteFilePath,
		    absoluteThumbPath,
		    hasThumbnail,
		});
	}

	return items;
}

HotPathTaxonomyData prepareHotPathTaxonomy(Database &db, const std::vector<HotPathItem> &items) {
	HotPathTaxonomyData data;

	for (size_t i = 0; i < 6; ++i) {
		Tag tag;
		tag.name = "perf_tag_" + std::to_string(i);
		data.tagIds.push_back(db.insertTag(tag));
	}

	for (size_t i = 0; i < 4; ++i) {
		Category category;
		category.name     = "perf_category_" + std::to_string(i);
		category.color    = (i % 2 == 0) ? "#225588" : "#884422";
		category.position = static_cast<int64_t>(i);
		data.categoryIds.push_back(db.insertCategory(category));
	}

	for (size_t i = 0; i < std::min<size_t>(3, items.size()); ++i) {
		EXPECT_TRUE(db.addMemeTag(items[i].memeId, data.tagIds[i % data.tagIds.size()]));
	}

	for (size_t i = 0; i < std::min<size_t>(2, items.size()); ++i) {
		EXPECT_TRUE(db.updateMemeCategory(items[i].memeId, data.categoryIds[i % data.categoryIds.size()]));
	}

	return data;
}

} // namespace

class HotPathPerfTest : public MemeDbTest {
protected:
	void SetUp() override {
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_FATAL);
		MemeDbTest::SetUp();

		storageRoot_ = tempDir_->getSubPath("storage");
		std::filesystem::create_directories(storageRoot_);
		TaskQueue::get().shutdown();
		TaskQueue::get().initialize(1, 128, storageRoot_);
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_INFO);
		MemeDbTest::TearDown();
	}

	std::string storageRoot_;
};

TEST_F(HotPathPerfTest, GetMeme_RequestPath_P95Under20Ms) {
	constexpr size_t   kCorpusSize  = 64;
	constexpr size_t   kWarmupCount = 4;
	constexpr uint64_t kSeed        = 0x484F545F4745544DULL;

	const auto items = buildHotPathCorpus(*db, storageRoot_, kCorpusSize);

	for (size_t i = 0; i < std::min(kWarmupCount, items.size()); ++i) {
		HttpResponseProxy res;
		handleGetMeme(makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId)), res);
		ASSERT_EQ(res.status, 200);
	}

	perf::PerfStats stats;
	for (size_t i = 0; i < items.size(); ++i) {
		HttpRequestProxy req = makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId));
		HttpResponseProxy res;
		double elapsedMs = perf::measureMs([&]() {
			handleGetMeme(req, res);
		});

		stats.add("get_meme_" + std::to_string(items[i].memeId), elapsedMs);
		perf::printPerfNode("get_meme", i, std::to_string(items[i].memeId), elapsedMs);

		ASSERT_EQ(res.status, 200);
		auto body = nlohmann::json::parse(res.body);
		EXPECT_TRUE(body["success"].get<bool>());
		EXPECT_EQ(body["data"]["id"].get<int64_t>(), items[i].memeId);
	}

	std::cout << "[perf] get_meme seed=" << kSeed << " samples=" << items.size()
	          << " collected=" << stats.samples_.size() << '\n';
	perf::printPerfTopSlowest("get_meme", stats);
	EXPECT_LT(stats.p95Ms(), 20.0);
}

TEST_F(HotPathPerfTest, PostMemeUse_RequestPath_P95Under25Ms) {
	constexpr size_t   kCorpusSize  = 64;
	constexpr size_t   kWarmupCount = 4;
	constexpr uint64_t kSeed        = 0x484F545F55534550ULL;

	const auto items = buildHotPathCorpus(*db, storageRoot_, kCorpusSize);

	for (size_t i = 0; i < std::min(kWarmupCount, items.size()); ++i) {
		HttpResponseProxy res;
		handlePostMemeUse(makeRequest("POST", "/api/meme/" + std::to_string(items[i].memeId) + "/use"), res);
		ASSERT_EQ(res.status, 200);
	}

	perf::PerfStats stats;
	for (size_t i = 0; i < items.size(); ++i) {
		HttpRequestProxy req = makeRequest("POST", "/api/meme/" + std::to_string(items[i].memeId) + "/use");
		HttpResponseProxy res;
		double elapsedMs = perf::measureMs([&]() {
			handlePostMemeUse(req, res);
		});

		stats.add("post_meme_use_" + std::to_string(items[i].memeId), elapsedMs);
		perf::printPerfNode("post_meme_use", i, std::to_string(items[i].memeId), elapsedMs);

		ASSERT_EQ(res.status, 200);
		auto body = nlohmann::json::parse(res.body);
		EXPECT_TRUE(body["success"].get<bool>());
		EXPECT_GT(body["data"]["lastUsedAt"].get<int64_t>(), 0);
	}

	std::cout << "[perf] post_meme_use seed=" << kSeed << " samples=" << items.size()
	          << " collected=" << stats.samples_.size() << '\n';
	perf::printPerfTopSlowest("post_meme_use", stats);
	EXPECT_LT(stats.p95Ms(), 25.0);
}

TEST_F(HotPathPerfTest, GetMemeAssets_RequestPath_P95Under30Ms) {
	constexpr size_t   kCorpusSize  = 48;
	constexpr size_t   kWarmupCount = 4;
	constexpr uint64_t kSeed        = 0x484F545F41535354ULL;

	const auto items = buildHotPathCorpus(*db, storageRoot_, kCorpusSize);

	for (size_t i = 0; i < std::min(kWarmupCount, items.size()); ++i) {
		HttpResponseProxy fileRes;
		handleGetMemeFile(makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId) + "/file"), fileRes);
		ASSERT_EQ(fileRes.status, 200);

		HttpResponseProxy thumbnailRes;
		handleGetMemeThumbnail(makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId) + "/thumbnail"),
		                       thumbnailRes);
		ASSERT_EQ(thumbnailRes.status, 200);
	}

	perf::PerfStats fileStats;
	perf::PerfStats thumbnailStats;
	for (size_t i = 0; i < items.size(); ++i) {
		HttpRequestProxy fileReq = makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId) + "/file");
		HttpResponseProxy fileRes;
		double fileElapsedMs = perf::measureMs([&]() {
			handleGetMemeFile(fileReq, fileRes);
		});

		fileStats.add("get_meme_file_" + std::to_string(items[i].memeId), fileElapsedMs);
		perf::printPerfNode("get_meme_file", i, std::to_string(items[i].memeId), fileElapsedMs);

		ASSERT_EQ(fileRes.status, 200);
		EXPECT_EQ(fileRes.filePath, items[i].absoluteFilePath);
		EXPECT_EQ(fileRes.contentType, "image/jpeg");

		HttpRequestProxy thumbnailReq =
		    makeRequest("GET", "/api/meme/" + std::to_string(items[i].memeId) + "/thumbnail");
		HttpResponseProxy thumbnailRes;
		double thumbnailElapsedMs = perf::measureMs([&]() {
			handleGetMemeThumbnail(thumbnailReq, thumbnailRes);
		});

		const std::string label =
		    (items[i].hasThumbnail ? "thumbnail_hit_" : "thumbnail_fallback_") + std::to_string(items[i].memeId);
		thumbnailStats.add(label, thumbnailElapsedMs);
		perf::printPerfNode("get_meme_thumbnail", i, label, thumbnailElapsedMs);

		ASSERT_EQ(thumbnailRes.status, 200);
		if (items[i].hasThumbnail) {
			EXPECT_EQ(thumbnailRes.filePath, items[i].absoluteThumbPath);
			EXPECT_EQ(thumbnailRes.contentType, "image/jpeg");
		} else {
			EXPECT_EQ(thumbnailRes.filePath, items[i].absoluteFilePath);
			EXPECT_EQ(thumbnailRes.contentType, "image/jpeg");
		}
	}

	std::cout << "[perf] get_meme_assets seed=" << kSeed << " file_samples=" << fileStats.samples_.size()
	          << " thumbnail_samples=" << thumbnailStats.samples_.size() << '\n';
	perf::printPerfTopSlowest("get_meme_file", fileStats);
	perf::printPerfTopSlowest("get_meme_thumbnail", thumbnailStats);
	EXPECT_LT(fileStats.p95Ms(), 30.0);
	EXPECT_LT(thumbnailStats.p95Ms(), 30.0);
}

TEST_F(HotPathPerfTest, GetTagsAndCategories_P95Under25Ms) {
	constexpr size_t   kCorpusSize  = 32;
	constexpr size_t   kSampleCount = 24;
	constexpr size_t   kWarmupCount = 3;
	constexpr uint64_t kSeed        = 0x484F545F54414743ULL;

	const auto items         = buildHotPathCorpus(*db, storageRoot_, kCorpusSize);
	const auto taxonomyData  = prepareHotPathTaxonomy(*db, items);
	const size_t expectedTags = taxonomyData.tagIds.size();
	const size_t expectedCategories = taxonomyData.categoryIds.size();

	for (size_t i = 0; i < kWarmupCount; ++i) {
		HttpResponseProxy tagRes;
		handleGetTags(makeRequest("GET", "/api/tags"), tagRes);
		ASSERT_EQ(tagRes.status, 200);

		HttpResponseProxy categoryRes;
		handleGetCategories(makeRequest("GET", "/api/categories"), categoryRes);
		ASSERT_EQ(categoryRes.status, 200);
	}

	perf::PerfStats tagStats;
	perf::PerfStats categoryStats;
	for (size_t i = 0; i < kSampleCount; ++i) {
		HttpRequestProxy tagReq = makeRequest("GET", "/api/tags");
		HttpResponseProxy tagRes;
		double tagElapsedMs = perf::measureMs([&]() {
			handleGetTags(tagReq, tagRes);
		});

		tagStats.add("get_tags_" + std::to_string(i), tagElapsedMs);
		perf::printPerfNode("get_tags", i, "tags_" + std::to_string(i), tagElapsedMs);

		ASSERT_EQ(tagRes.status, 200);
		auto tagBody = nlohmann::json::parse(tagRes.body);
		ASSERT_TRUE(tagBody["success"].get<bool>());
		ASSERT_TRUE(tagBody["data"].is_array());
		EXPECT_GE(tagBody["data"].size(), expectedTags);

		HttpRequestProxy categoryReq = makeRequest("GET", "/api/categories");
		HttpResponseProxy categoryRes;
		double categoryElapsedMs = perf::measureMs([&]() {
			handleGetCategories(categoryReq, categoryRes);
		});

		categoryStats.add("get_categories_" + std::to_string(i), categoryElapsedMs);
		perf::printPerfNode("get_categories", i, "categories_" + std::to_string(i), categoryElapsedMs);

		ASSERT_EQ(categoryRes.status, 200);
		auto categoryBody = nlohmann::json::parse(categoryRes.body);
		ASSERT_TRUE(categoryBody["success"].get<bool>());
		ASSERT_TRUE(categoryBody["data"].is_array());
		EXPECT_GE(categoryBody["data"].size(), expectedCategories);
	}

	std::cout << "[perf] get_tags_and_categories seed=" << kSeed << " tag_samples=" << tagStats.samples_.size()
	          << " category_samples=" << categoryStats.samples_.size() << '\n';
	perf::printPerfTopSlowest("get_tags", tagStats);
	perf::printPerfTopSlowest("get_categories", categoryStats);
	EXPECT_LT(tagStats.p95Ms(), 25.0);
	EXPECT_LT(categoryStats.p95Ms(), 25.0);
}

TEST_F(HotPathPerfTest, BatchWriteHotPaths_P95Under40Ms) {
	constexpr size_t   kCorpusSize   = 64;
	constexpr size_t   kBatchSize    = 4;
	constexpr size_t   kWarmupCount  = 1;
	constexpr uint64_t kSeed         = 0x484F545F42415443ULL;
	constexpr double   kThresholdMs  = 40.0;

	const auto items        = buildHotPathCorpus(*db, storageRoot_, kCorpusSize);
	const auto taxonomyData = prepareHotPathTaxonomy(*db, items);

	const auto tagBatchIds      = collectMemeIds(items, 8, kBatchSize);
	const auto categoryBatchIds = collectMemeIds(items, 16, kBatchSize);
	const auto deleteBatchIdsA  = collectMemeIds(items, 24, kBatchSize);
	const auto deleteBatchIdsB  = collectMemeIds(items, 28, kBatchSize);

	ASSERT_EQ(tagBatchIds.size(), kBatchSize);
	ASSERT_EQ(categoryBatchIds.size(), kBatchSize);
	ASSERT_EQ(deleteBatchIdsA.size(), kBatchSize);
	ASSERT_EQ(deleteBatchIdsB.size(), kBatchSize);

	auto makeBatchTagsRequest = [&](const std::vector<int64_t> &memeIds, int64_t tagId) {
		HttpRequestProxy req = makeRequest("POST", "/api/memes/batch/tags");
		req.body             = nlohmann::json{{"memeIds", memeIds}, {"tagId", tagId}}.dump();
		return req;
	};

	auto makeBatchCategoryRequest = [&](const std::vector<int64_t> &memeIds, int64_t categoryId) {
		HttpRequestProxy req = makeRequest("POST", "/api/memes/batch/category");
		req.body             = nlohmann::json{{"memeIds", memeIds}, {"categoryId", categoryId}}.dump();
		return req;
	};

	auto makeBatchDeleteRequest = [&](const std::vector<int64_t> &ids) {
		HttpRequestProxy req = makeRequest("DELETE", "/api/memes/batch");
		req.body             = nlohmann::json{{"ids", ids}}.dump();
		return req;
	};

	{
		HttpResponseProxy res;
		handlePostMemesBatchTags(makeBatchTagsRequest(tagBatchIds, taxonomyData.tagIds.back()), res);
		ASSERT_EQ(res.status, 200);
	}
	{
		HttpResponseProxy res;
		handlePostMemesBatchCategory(makeBatchCategoryRequest(categoryBatchIds, taxonomyData.categoryIds.back()), res);
		ASSERT_EQ(res.status, 200);
	}
	{
		HttpResponseProxy res;
		handleDeleteMemesBatch(makeBatchDeleteRequest(deleteBatchIdsA), res);
		ASSERT_EQ(res.status, 200);
	}

	perf::PerfStats batchTagStats;
	{
		HttpResponseProxy res;
		double elapsedMs = perf::measureMs([&]() {
			handlePostMemesBatchTags(makeBatchTagsRequest(tagBatchIds, taxonomyData.tagIds.front()), res);
		});

		batchTagStats.add("batch_tags", elapsedMs);
		perf::printPerfNode("batch_tags", 0, "batch_tags", elapsedMs);

		ASSERT_EQ(res.status, 200);
		auto body = nlohmann::json::parse(res.body);
		ASSERT_TRUE(body["success"].get<bool>());
		EXPECT_EQ(body["data"]["succeeded"].get<int>(), static_cast<int>(kBatchSize));
	}

	perf::PerfStats batchCategoryStats;
	{
		HttpResponseProxy res;
		double elapsedMs = perf::measureMs([&]() {
			handlePostMemesBatchCategory(makeBatchCategoryRequest(categoryBatchIds, taxonomyData.categoryIds.front()),
			                             res);
		});

		batchCategoryStats.add("batch_category", elapsedMs);
		perf::printPerfNode("batch_category", 0, "batch_category", elapsedMs);

		ASSERT_EQ(res.status, 200);
		auto body = nlohmann::json::parse(res.body);
		ASSERT_TRUE(body["success"].get<bool>());
		EXPECT_EQ(body["data"]["succeeded"].get<int>(), static_cast<int>(kBatchSize));
	}

	perf::PerfStats batchDeleteStats;
	{
		HttpResponseProxy res;
		double elapsedMs = perf::measureMs([&]() {
			handleDeleteMemesBatch(makeBatchDeleteRequest(deleteBatchIdsB), res);
		});

		batchDeleteStats.add("batch_delete", elapsedMs);
		perf::printPerfNode("batch_delete", 0, "batch_delete", elapsedMs);

		ASSERT_EQ(res.status, 200);
		auto body = nlohmann::json::parse(res.body);
		ASSERT_TRUE(body["success"].get<bool>());
		EXPECT_EQ(body["data"]["succeeded"].get<int>(), static_cast<int>(kBatchSize));
	}

	std::cout << "[perf] batch_write_hot_paths seed=" << kSeed << " tag_samples=" << batchTagStats.samples_.size()
	          << " category_samples=" << batchCategoryStats.samples_.size()
	          << " delete_samples=" << batchDeleteStats.samples_.size() << '\n';
	perf::printPerfTopSlowest("batch_tags", batchTagStats);
	perf::printPerfTopSlowest("batch_category", batchCategoryStats);
	perf::printPerfTopSlowest("batch_delete", batchDeleteStats);
	EXPECT_LT(batchTagStats.p95Ms(), kThresholdMs);
	EXPECT_LT(batchCategoryStats.p95Ms(), kThresholdMs);
	EXPECT_LT(batchDeleteStats.p95Ms(), kThresholdMs);
}

}} // namespace quickmemes::testing
