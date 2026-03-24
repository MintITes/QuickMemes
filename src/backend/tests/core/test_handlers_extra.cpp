/**
 * @file test_handlers_extra.cpp
 * @brief 补充 API 路径的单元测试
 */

#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "core/handlers.hpp"
#include "core/server.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"
#include "vision/vision.hpp"

#include <chrono>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <thread>

using ::testing::_;
using ::testing::NiceMock;
using ::testing::Return;

namespace quickmemes { namespace testing {

class HandlersExtraTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		tempDir_ = std::make_unique<TestDirectory>();
		importImagePath_ = tempDir_->getSubPath("import.jpg");
		createTestImage(importImagePath_);
		TaskQueue::get().initialize(1, 100, tempDir_->getSubPath("storage"));

		mockHttp_ = std::make_shared<NiceMock<MockHttpClient>>();
		VisionConfig config;
		config.ocrProvider = "PaddleOCR";
		config.ocrApiKey   = "ocr-key";
		config.ocrApiUrl   = "https://ocr.example.com";
		VisionModule::get().setHttpClient(mockHttp_);
		VisionModule::get().initialize(config);
	}

	void TearDown() override {
		VisionModule::get().shutdown();
		TaskQueue::get().shutdown();
		g_server.reset();
		tempDir_.reset();
		MemeDbTest::TearDown();
	}
	void createTestImage(const std::string &path) {
		std::ofstream ofs(path, std::ios::binary);
		unsigned char data[] = {0xFF, 0xD8, 0xFF, 0xEE, 0x00, 0x0E, 0x41, 0x64, 0x6F, 0x62,
		                        0x65, 0x00, 0x64, 0x80, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9};
		ofs.write(reinterpret_cast<const char *>(data), sizeof(data));
		ofs.close();
	}
	std::unique_ptr<TestDirectory>            tempDir_;
	std::shared_ptr<NiceMock<MockHttpClient>> mockHttp_;
	std::string                               importImagePath_;
};

/**
 * @brief 测试项目汇总 4.1: /api/import/cancel 任务取消逻辑
 */
TEST_F(HandlersExtraTest, ImportCancel_NonExistentTask_ReturnsError) {
	HttpRequestProxy req;
	req.path   = "/api/import/cancel";
	req.method = "POST";
	req.body   = R"({"taskId": "non-existent-id"})";
	HttpResponseProxy res;

	handlePostImportCancel(req, res);

	auto j = nlohmann::json::parse(res.body);
	EXPECT_FALSE(j["success"].get<bool>());
	EXPECT_EQ(j["code"].get<int>(), 1002); // ERR_NOT_FOUND
}

TEST_F(HandlersExtraTest, ImportRequest_ReturnsInitialPendingTaskSnapshot) {
	HttpRequestProxy req;
	req.path        = "/api/import";
	req.method      = "POST";
	nlohmann::json body;
	body["source"] = "LOCAL_FILE";
	body["inputs"] = {importImagePath_};
	body["options"] = {
	    {"autoOcr", true},
	    {"autoAiAnalyze", true},
	    {"sourceName", "test"},
	    {"sourceUrl", ""}
    };
	req.body = body.dump();
	HttpResponseProxy res;

	handlePostImport(req, res);

	EXPECT_EQ(res.status, 200);
	auto j = nlohmann::json::parse(res.body);
	EXPECT_TRUE(j["success"].get<bool>());
	EXPECT_EQ(j["data"]["status"].get<std::string>(), "PENDING");
	EXPECT_EQ(j["data"]["total"].get<int>(), 1);
	EXPECT_EQ(j["data"]["processed"].get<int>(), 0);
	EXPECT_EQ(j["data"]["inputs"][0].get<std::string>(), importImagePath_);
	EXPECT_EQ(j["data"]["source"].get<std::string>(), "LOCAL_FILE");
}

/**
 * @brief 测试项目汇总 4.1: /api/memes/batch/tags 批量打标原子性与有效性
 */
TEST_F(HandlersExtraTest, BatchTags_ValidIds_Success) {
	// 1. 准备数据
	MemeEntry m1;
	m1.fileHash = "h1";
	m1.filePath = "p1";
	int64_t id1 = db->insertMeme(m1);

	MemeEntry m2;
	m2.fileHash = "h2";
	m2.filePath = "p2";
	int64_t id2 = db->insertMeme(m2);

	Tag t;
	t.name      = "BatchTag";
	int64_t tid = db->insertTag(t);

	// 2. 发起请求
	HttpRequestProxy req;
	req.path   = "/api/memes/batch/tags";
	req.method = "POST";
	nlohmann::json body;
	body["memeIds"] = {id1, id2};
	body["tagId"]   = tid;
	req.body        = body.dump();
	HttpResponseProxy res;

	handlePostMemesBatchTags(req, res);

	// 3. 验证结果
	EXPECT_EQ(res.status, 200);
	auto j = nlohmann::json::parse(res.body);
	EXPECT_TRUE(j["success"].get<bool>());
	EXPECT_EQ(j["data"]["succeeded"].get<int>(), 2);

	// 4. 验证 DB
	auto tags1 = db->getMemeTags(id1);
	auto tags2 = db->getMemeTags(id2);
	EXPECT_EQ(tags1.size(), 1);
	EXPECT_EQ(tags2.size(), 1);
	EXPECT_EQ(tags1[0].name, "BatchTag");
}

/**
 * @brief 测试项目汇总 4.1: /api/memes/trash 和 /api/memes/trash/purge 回收站逻辑
 */
TEST_F(HandlersExtraTest, TrashManagement_Workflow_Success) {
	// 1. 插入并软删除
	MemeEntry m1;
	m1.fileHash = "h1";
	m1.filePath = tempDir_->getSubPath("p1");
	int64_t id1 = db->insertMeme(m1);
	db->softDeleteMeme(id1);

	// 2. 测试 /api/memes/trash 列表
	HttpRequestProxy req;
	req.path   = "/api/memes/trash";
	req.method = "GET";
	req.query  = "limit=10&offset=0";
	HttpResponseProxy res;

	handleGetMemesTrash(req, res);

	auto j = nlohmann::json::parse(res.body);
	EXPECT_TRUE(j["success"].get<bool>());
	EXPECT_EQ(j["data"]["total"].get<int>(), 1);
	EXPECT_EQ(j["data"]["items"][0]["meme"]["id"].get<int64_t>(), id1);

	// 3. 测试 /api/memes/trash/purge 清空回收站
	HttpRequestProxy reqPurge;
	reqPurge.path   = "/api/memes/trash/purge";
	reqPurge.method = "DELETE";
	reqPurge.query  = "olderThanDays=0";
	HttpResponseProxy resPurge;

	handleDeleteTrashPurge(reqPurge, resPurge);

	auto jPurge = nlohmann::json::parse(resPurge.body);
	EXPECT_TRUE(jPurge["success"].get<bool>());
	EXPECT_EQ(jPurge["data"]["purged"].get<int>(), 1);

	// 再次查询应当为空
	handleGetMemesTrash(req, res);
	auto jFinal = nlohmann::json::parse(res.body);
	EXPECT_EQ(jFinal["data"]["total"].get<int>(), 0);
}

TEST_F(HandlersExtraTest, ManualOcr_ByMemeId_UpdatesDatabaseAndReturnsTaskId) {
	tempDir_->createSubDirs("storage/2026-03");
	auto          imagePath = tempDir_->getSubPath("storage/2026-03/sample.ppm");
	std::ofstream ofs(imagePath, std::ios::binary);
	ofs << "P6\n1 1\n255\n";
	const unsigned char pixel[] = {255, 255, 255};
	ofs.write(reinterpret_cast<const char *>(pixel), sizeof(pixel));
	ofs.close();

	MemeEntry meme;
	meme.fileHash  = "manual-ocr-hash";
	meme.filePath  = "2026-03/sample.ppm";
	meme.mimeType  = "image/jpeg";
	int64_t memeId = db->insertMeme(meme);

	EXPECT_CALL(*mockHttp_,
	            post("https://ocr.example.com/ocr",
	                 ::testing::HasSubstr("Authorization: token ocr-key"),
	                 ::testing::AllOf(::testing::HasSubstr("\"fileType\":1"),
	                                  ::testing::HasSubstr("\"file\":\""),
	                                  ::testing::HasSubstr("\"visualize\":false")),
	                 _))
	    .WillOnce(Return(
	        R"({"errorCode":0,"errorMsg":"Success","result":{"ocrResults":[{"prunedResult":{"res":{"rec_texts":["manual","ocr"]}}}]}})"));

	HttpRequestProxy req;
	req.path        = "/api/meme/" + std::to_string(memeId) + "/ocr";
	req.method      = "POST";
	req.header_auth = "Bearer test-token";
	HttpResponseProxy res;

	handlePostMemeOcr(req, res);

	EXPECT_EQ(res.status, 200);
	auto resp = nlohmann::json::parse(res.body);
	EXPECT_TRUE(resp["success"].get<bool>());
	EXPECT_FALSE(resp["data"]["taskId"].get<std::string>().empty());

	bool updated = false;
	for (int i = 0; i < 40; ++i) {
		auto current = db->getMeme(memeId);
		if (current.ocrStatus == ProcessingStatus::DONE && current.ocrText == "manual\nocr") {
			updated = true;
			break;
		}
		std::this_thread::sleep_for(std::chrono::milliseconds(50));
	}

	EXPECT_TRUE(updated);
	auto updatedMeme = db->getMeme(memeId);
	EXPECT_EQ(updatedMeme.ocrStatus, ProcessingStatus::DONE);
	EXPECT_EQ(updatedMeme.ocrText, "manual\nocr");
}

TEST_F(HandlersExtraTest, GetMemeThumbnail_TaskQueueUnavailableFallsBackToOriginalFile) {
	tempDir_->createSubDirs("storage/2026-03");
	const auto imagePath = tempDir_->getSubPath("storage/2026-03/thumb-source.jpg");
	createTestImage(imagePath);

	ServerConfig config;
	config.thumbnailEnabled = true;
	g_server                = std::make_unique<Server>();
	g_server->updateConfig(config);

	MemeEntry meme;
	meme.fileHash = "thumb-fallback-hash";
	meme.filePath = "2026-03/thumb-source.jpg";
	meme.mimeType = "image/jpeg";
	const int64_t memeId = db->insertMeme(meme);

	TaskQueue::get().shutdown();
	TaskQueue::get().initialize(1, 100, tempDir_->getSubPath("storage"));
	TaskQueue::get().shutdown();

	HttpRequestProxy req;
	req.path   = "/api/meme/" + std::to_string(memeId) + "/thumbnail";
	req.method = "GET";
	HttpResponseProxy res;

	handleGetMemeThumbnail(req, res);

	EXPECT_EQ(res.status, 200);
	EXPECT_EQ(std::filesystem::path(res.filePath), std::filesystem::path(imagePath));
	EXPECT_EQ(res.contentType, "image/jpeg");
}

}} // namespace quickmemes::testing
