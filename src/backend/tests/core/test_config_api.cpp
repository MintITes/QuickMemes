#include "../mocks.hpp"
#include "core/handlers.hpp"
#include "core/server.hpp"

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes { namespace testing {

class ConfigApiTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
		// Initialize g_server for handlePatchConfig
		ServerConfig config;
		config.visionConfig.apiKey = "old-key";
		g_server                   = std::make_unique<Server>();
		g_server->updateConfig(config);
	}

	void TearDown() override {
		g_server.reset();
		MemeDbTest::TearDown();
	}
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

TEST_F(ConfigApiTest, PatchConfig_UpdateSearchConfig_Success) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({"search":{"maxCandidatesPerScorer":150,"vectorTopK":60,"minScore":0.2,"weights":{"name":0.4,"description":0.1,"ocrText":0.1,"tagName":0.1,"categoryName":0.1,"vectorDescription":0.1,"vectorOcr":0.1}}})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 200);
	EXPECT_EQ(g_server->getConfig().searchConfig.maxCandidatesPerScorer, 150);
	EXPECT_EQ(g_server->getConfig().searchConfig.vectorTopK, 60);
	EXPECT_DOUBLE_EQ(g_server->getConfig().searchConfig.minScore, 0.2);
	EXPECT_DOUBLE_EQ(g_server->getConfig().searchConfig.weights.name, 0.4);
}

TEST_F(ConfigApiTest, PatchConfig_InvalidSearchWeights_ReturnsError) {
	HttpRequestProxy req;
	req.path   = "/api/config";
	req.method = "PATCH";
	req.body   = R"({"search":{"weights":{"name":-0.1}}})";
	HttpResponseProxy res;

	handlePatchConfig(req, res);

	EXPECT_EQ(res.status, 400);
}

}} // namespace quickmemes::testing
