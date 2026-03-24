#include "../mocks.hpp"
#include "core/handlers.hpp"
#include "core/server.hpp"
#include "embedding/embedding.hpp"
#include "vision/vision.hpp"

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes { namespace testing {

class ConfigApiTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		mockHttp_ = std::make_shared<::testing::NiceMock<MockHttpClient>>();
		EXPECT_CALL(*mockHttp_, get(::testing::_, ::testing::_, ::testing::_)).WillRepeatedly(::testing::Return("ok"));
		VisionModule::get().setHttpClient(mockHttp_);
		EmbeddingModule::get().setHttpClient(mockHttp_);

		ServerConfig config;
		config.visionConfig.apiKey         = "old-key";
		config.visionConfig.apiBaseUrl     = "https://vision.example.com";
		config.visionConfig.visionModel    = "vision-model";
		config.embeddingConfig.provider    = "JinaAI";
		config.embeddingConfig.model       = "jina-embeddings-v5-text-small";
		config.embeddingConfig.apiUrl      = "https://embedding.example.com/v1/embeddings";
		config.embeddingConfig.apiKey      = "old-embedding-key";
		config.embeddingConfig.dimensions  = 512;

		ASSERT_TRUE(VisionModule::get().initialize(config.visionConfig));
		ASSERT_TRUE(EmbeddingModule::get().initialize(config.embeddingConfig));

		g_server = std::make_unique<Server>();
		g_server->updateConfig(config);
	}

	void TearDown() override {
		VisionModule::get().shutdown();
		EmbeddingModule::get().shutdown();
		VisionModule::get().setHttpClient(std::make_shared<HttpClient>());
		EmbeddingModule::get().setHttpClient(std::make_shared<HttpClient>());
		g_server.reset();
		MemeDbTest::TearDown();
	}

	std::shared_ptr<::testing::NiceMock<MockHttpClient>> mockHttp_;
};

TEST_F(ConfigApiTest, PatchConfig_UpdateAiKey_Success) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({"aiApiKey": "new-key"})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 200);
	EXPECT_EQ(g_server->getConfig().visionConfig.apiKey, "new-key");
}

TEST_F(ConfigApiTest, PatchConfig_UpdateEmbeddingModel_Success) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({"embeddingModel": "jina-embeddings-v5-text-small", "embeddingProvider": "JinaAI"})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 200);
	EXPECT_EQ(g_server->getConfig().embeddingConfig.model, "jina-embeddings-v5-text-small");
	EXPECT_EQ(g_server->getConfig().embeddingConfig.provider, "JinaAI");
}

TEST_F(ConfigApiTest, PatchConfig_InvalidJson_ReturnsError) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({invalid json})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 400);
}

TEST_F(ConfigApiTest, PatchConfig_InvalidEmbeddingConfig_ReturnsErrorAndKeepsOldConfig) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({"embeddingProvider": "UnsupportedProvider"})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 400);
	EXPECT_EQ(g_server->getConfig().embeddingConfig.provider, "JinaAI");
	EXPECT_EQ(g_server->getConfig().embeddingConfig.model, "jina-embeddings-v5-text-small");
}

}} // namespace quickmemes::testing
