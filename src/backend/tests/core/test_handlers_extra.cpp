/**
 * @file test_handlers_extra.cpp
 * @brief 补充 API 路径的单元测试
 */

#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "core/handlers.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes { namespace testing {

class HandlersExtraTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		tempDir_ = std::make_unique<TestDirectory>();
		TaskQueue::get().initialize(1, 100, tempDir_->getSubPath("storage"));
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		tempDir_.reset();
		MemeDbTest::TearDown();
	}
	std::unique_ptr<TestDirectory> tempDir_;
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

}} // namespace quickmemes::testing
