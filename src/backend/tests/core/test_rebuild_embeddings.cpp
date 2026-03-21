#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "core/handlers.hpp"
#include "core/task_queue.hpp"
#include "embedding/embedding.hpp"
#include "vision/vision.hpp"

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes { namespace testing {

class RebuildEmbeddingsTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		tempDir_ = std::make_unique<TestDirectory>();

		auto mockHttp = std::make_shared<MockHttpClient>();
		EXPECT_CALL(*mockHttp, get(::testing::_, ::testing::_, ::testing::_)).WillRepeatedly(::testing::Return("ok"));
		VisionModule::get().setHttpClient(mockHttp);
		EmbeddingModule::get().setHttpClient(mockHttp);

		EmbeddingConfig embeddingConfig;
		embeddingConfig.provider   = "JinaAI";
		embeddingConfig.model      = "jina-embeddings-v5-text-small";
		embeddingConfig.apiUrl     = "http://mock-api.com/v1/embeddings";
		embeddingConfig.apiKey     = "test-key";
		embeddingConfig.dimensions = 2;
		EmbeddingModule::get().initialize(embeddingConfig);

		TaskQueue::get().initialize(1, 100, tempDir_->getSubPath("storage"));
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		VisionModule::get().setHttpClient(std::make_shared<HttpClient>());
		EmbeddingModule::get().setHttpClient(std::make_shared<HttpClient>());
		EmbeddingModule::get().shutdown();
		tempDir_.reset();
		MemeDbTest::TearDown();
	}
	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(RebuildEmbeddingsTest, HandleRebuild_Success) {
	HttpRequestProxy req;
	req.path   = "/api/admin/rebuild-embeddings";
	req.method = "POST";
	req.body   = "{}";
	HttpResponseProxy res;

	handlePostAdminRebuildEmbeddings(req, res);

	EXPECT_EQ(res.status, 200);
	auto j = nlohmann::json::parse(res.body);
	EXPECT_TRUE(j["success"].get<bool>());
	EXPECT_TRUE(j["data"].contains("taskId"));
	EXPECT_TRUE(j["data"]["taskId"].get<std::string>().find("rebuild-") == 0);
}

}} // namespace quickmemes::testing
