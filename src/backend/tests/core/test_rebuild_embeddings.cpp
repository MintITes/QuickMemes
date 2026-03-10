#include "../mocks.hpp"
#include "core/handlers.hpp"
#include "core/task_queue.hpp"
#include "vision/vision.hpp"
#include "../test_utils.hpp"

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes {
namespace testing {

class RebuildEmbeddingsTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		tempDir_ = std::make_unique<TestDirectory>();

		auto mockHttp = std::make_shared<MockHttpClient>();
		EXPECT_CALL(*mockHttp, get(::testing::_, ::testing::_, ::testing::_)).WillRepeatedly(::testing::Return("ok"));
		VisionModule::get().setHttpClient(mockHttp);

		VisionConfig cfg;
		cfg.apiKey     = "test-key";
		cfg.apiBaseUrl = "http://mock-api.com";
		VisionModule::get().initialize(cfg);

		TaskQueue::get().initialize(1, 100, tempDir_->getSubPath("storage"));
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		VisionModule::get().setHttpClient(std::make_shared<HttpClient>());
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

} // namespace testing
} // namespace quickmemes
