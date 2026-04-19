/**
 * @file test_embedding_mock.cpp
 * @brief Embedding 模块 Mock 与 Live 测试
 */

#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "embedding/embedding.hpp"

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <numeric>
#include <algorithm>

using ::testing::_;
using ::testing::HasSubstr;
using ::testing::NiceMock;
using ::testing::Return;

namespace quickmemes { namespace testing {

namespace {

std::filesystem::path testsRootPath() {
	return std::filesystem::path(__FILE__).parent_path().parent_path();
}

std::string readTestEnvValue(const std::string &key) {
	std::ifstream ifs(testsRootPath() / ".test_env");
	if (!ifs.is_open()) { return ""; }

	std::string line;
	while (std::getline(ifs, line)) {
		if (line.empty() || line[0] == '#') { continue; }
		auto eqPos = line.find('=');
		if (eqPos == std::string::npos) { continue; }
		if (line.substr(0, eqPos) != key) { continue; }

		auto value = line.substr(eqPos + 1);
		while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) {
			value.erase(value.begin());
		}
		while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) {
			value.pop_back();
		}
		if (value.size() >= 2 &&
		    ((value.front() == '"' && value.back() == '"') || (value.front() == '\'' && value.back() == '\''))) {
			value = value.substr(1, value.size() - 2);
		}
		return value;
	}
	return "";
}

double dotProduct(const std::vector<float> &a, const std::vector<float> &b) {
	double value = 0.0;
	for (size_t i = 0; i < std::min(a.size(), b.size()); ++i) {
		value += static_cast<double>(a[i]) * static_cast<double>(b[i]);
	}
	return value;
}

EmbeddingConfig makeConfig() {
	EmbeddingConfig config;
	config.provider        = "JinaAI";
	config.model           = "jina-embeddings-v5-text-small";
	config.apiUrl          = "https://api.jina.ai/v1/embeddings";
	config.apiKey          = "test-key";
	config.dimensions      = 512;
	config.timeoutSeconds  = 15;
	config.maxRetries      = 2;
	return config;
}

} // namespace

class EmbeddingMockTest : public ::testing::Test {
protected:
	void SetUp() override {
		mockHttp = std::make_shared<NiceMock<MockHttpClient>>();
		module   = std::make_unique<EmbeddingModule>(mockHttp);
	}

	std::shared_ptr<NiceMock<MockHttpClient>> mockHttp;
	std::unique_ptr<EmbeddingModule>          module;
};

TEST_F(EmbeddingMockTest, GenerateEmbeddings_BuildsJinaRequestBody) {
	auto config = makeConfig();
	config.dimensions = 2;
	module->initialize(config);

	EXPECT_CALL(*mockHttp,
	            post("https://api.jina.ai/v1/embeddings",
	                 HasSubstr("Authorization: Bearer test-key"),
	                 ::testing::AllOf(HasSubstr("\"model\":\"jina-embeddings-v5-text-small\""),
	                                  HasSubstr("\"task\":\"text-matching\""),
	                                  HasSubstr("\"dimensions\":2"),
	                                  HasSubstr("\"truncate\":true"),
	                                  HasSubstr("\"normalized\":true"),
	                                  HasSubstr("\"input\":[\"text1\",\"text2\"]")),
	                 15))
	    .WillOnce(Return(R"({"data":[{"index":0,"embedding":[0.1,0.2]},{"index":1,"embedding":[0.3,0.4]}]})"));

	auto vectors = module->generateEmbeddings({"text1", "text2"});
	ASSERT_EQ(vectors.size(), 2);
	EXPECT_EQ(vectors[0].size(), 2);
	EXPECT_EQ(vectors[1].size(), 2);
}

TEST_F(EmbeddingMockTest, Initialize_InvalidDimensionsFallsBackToDefault) {
	auto config        = makeConfig();
	config.dimensions  = 2048;
	config.maxRetries  = 0;
	config.timeoutSeconds = 12;
	module->initialize(config);

	EXPECT_EQ(module->getDimensions(), 512);
	nlohmann::json response;
	response["data"] = nlohmann::json::array({{{"index", 0}, {"embedding", std::vector<float>(512, 0.1f)}}});
	EXPECT_CALL(*mockHttp, post(_, _, HasSubstr("\"dimensions\":512"), 12)).WillOnce(Return(response.dump()));
	auto vector = module->generateEmbedding("hello");
	EXPECT_EQ(vector.size(), 512);
}

TEST_F(EmbeddingMockTest, Initialize_UnsupportedProviderDoesNotSendRequests) {
	auto config   = makeConfig();
	config.provider = "Other";
	module->initialize(config);

	EXPECT_FALSE(module->isAvailable());
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).Times(0);
	EXPECT_THROW(module->generateEmbedding("hello"), EmbeddingException);
}

TEST_F(EmbeddingMockTest, GenerateEmbeddings_SkipsBlankInput) {
	auto config = makeConfig();
	module->initialize(config);

	EXPECT_CALL(*mockHttp, post(_, _, _, _)).Times(0);
	auto vectors = module->generateEmbeddings({"", "   ", "\n"});
	EXPECT_TRUE(vectors.empty());
}

TEST_F(EmbeddingMockTest, GenerateEmbeddings_RetriesRetryableErrorsOnly) {
	auto config         = makeConfig();
	config.dimensions   = 2;
	config.maxRetries   = 1;
	module->initialize(config);

	EXPECT_CALL(*mockHttp, post(_, _, _, _))
	    .WillOnce(::testing::Throw(ApiException(
	        ERR_AI_REQUEST_FAILED,
	        "HTTP Request error: HTTP Request returned 503. Body: {\"code\":\"SERVICE_UNAVAILABLE\",\"message\":\"busy\"}")))
	    .WillOnce(Return(R"({"data":[{"index":0,"embedding":[0.5,0.5]}]})"));

	auto vector = module->generateEmbedding("retry");
	EXPECT_EQ(vector.size(), 2);
}

TEST_F(EmbeddingMockTest, GenerateEmbeddings_AuthErrorsDoNotRetry) {
	auto config         = makeConfig();
	config.dimensions   = 2;
	config.maxRetries   = 2;
	module->initialize(config);

	EXPECT_CALL(*mockHttp, post(_, _, _, _))
	    .WillOnce(::testing::Throw(ApiException(
	        ERR_AI_REQUEST_FAILED,
	        "HTTP Request error: HTTP Request returned 401. Body: {\"code\":\"AUTH_INVALID_API_KEY\",\"message\":\"Invalid API key\"}")));

	try {
		(void)module->generateEmbedding("auth");
		FAIL() << "Expected EmbeddingException";
	} catch (const EmbeddingException &e) {
		EXPECT_EQ(e.error().statusCode, 401);
		EXPECT_EQ(e.error().providerCode, "AUTH_INVALID_API_KEY");
		EXPECT_FALSE(e.error().retryable);
		EXPECT_THAT(e.what(), HasSubstr("Invalid API key"));
	}
}

TEST_F(EmbeddingMockTest, SetHttpClient_NullptrRejected) {
	EXPECT_THROW(module->setHttpClient(nullptr), std::invalid_argument);
}

TEST_F(EmbeddingMockTest, Reconfigure_InvalidConfig_AcceptsConfigAndDisablesEmbedding) {
	auto config = makeConfig();
	ASSERT_TRUE(module->initialize(config));

	EmbeddingConfig invalid = config;
	invalid.provider        = "Other";
	invalid.model           = "bad-model";

	EXPECT_TRUE(module->reconfigure(invalid));
	EXPECT_FALSE(module->isAvailable());
	EXPECT_EQ(module->getConfig().provider, "Other");
	EXPECT_EQ(module->getConfig().model, "bad-model");
}

TEST_F(EmbeddingMockTest, InvalidJsonResponse_IsNotRetried) {
	auto config       = makeConfig();
	config.dimensions = 2;
	config.maxRetries = 2;
	ASSERT_TRUE(module->initialize(config));

	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return("not-json"));

	EXPECT_THROW(
	    {
		    try {
			    (void)module->generateEmbedding("broken-json");
		    } catch (const EmbeddingException &e) {
			    EXPECT_FALSE(e.error().retryable);
			    EXPECT_THAT(e.what(), HasSubstr("Invalid embedding response JSON"));
			    throw;
		    }
	    },
	    EmbeddingException);
}

TEST(EmbeddingLiveTest, GenerateEmbeddings_JinaAiOutputsSimilarityScores) {
	if (std::getenv("QM_RUN_JINA_EMBEDDING_LIVE") == nullptr) {
		GTEST_SKIP() << "Set QM_RUN_JINA_EMBEDDING_LIVE=1 to enable the live Jina embedding test";
	}

	auto apiUrl = readTestEnvValue("jina-embedding-url");
	auto apiKey = readTestEnvValue("jina-embedding-key");
	if (apiUrl.empty()) { GTEST_SKIP() << "No jina-embedding-url found in src/backend/tests/.test_env"; }
	if (apiKey.empty()) { GTEST_SKIP() << "No jina-embedding-key found in src/backend/tests/.test_env"; }

	EmbeddingConfig config;
	config.provider       = "JinaAI";
	config.model          = "jina-embeddings-v5-text-small";
	config.apiUrl         = apiUrl;
	config.apiKey         = apiKey;
	config.dimensions     = 512;
	config.timeoutSeconds = 20;
	config.maxRetries     = 0;

	EmbeddingModule module;
	ASSERT_TRUE(module.initialize(config));

	const std::vector<std::string> corpus = {"咕咕嘎嘎", "鸡你太美", "纳西妲", "white", "我不中嘞", "测试语句"};
	const auto                     corpusVectors = module.generateEmbeddings(corpus, "text-matching");
	ASSERT_EQ(corpusVectors.size(), corpus.size());
	for (const auto &vector : corpusVectors) {
		EXPECT_EQ(vector.size(), static_cast<size_t>(config.dimensions));
	}

	const auto genshin = module.generateEmbedding("原神", "retrieval.query");
	const auto caixukun = module.generateEmbedding("蔡徐坤", "retrieval.query");
	const auto ceshiyuju = module.generateEmbedding("ceshiyuju", "retrieval.query");
	ASSERT_EQ(genshin.size(), static_cast<size_t>(config.dimensions));
	ASSERT_EQ(caixukun.size(), static_cast<size_t>(config.dimensions));
	ASSERT_EQ(ceshiyuju.size(), static_cast<size_t>(config.dimensions));

	std::vector<double> genshinScores;
	std::vector<double> caixukunScores;
	std::vector<double> ceshiyujuScores;
	std::vector<std::pair<std::string, double>> genshinRanked;
	std::vector<std::pair<std::string, double>> caixukunRanked;
	std::vector<std::pair<std::string, double>> ceshiyujuRanked;
	for (size_t i = 0; i < corpus.size(); ++i) {
		double genshinScore  = dotProduct(genshin, corpusVectors[i]);
		double caixukunScore = dotProduct(caixukun, corpusVectors[i]);
		double ceshiyujuScore = dotProduct(ceshiyuju, corpusVectors[i]);
		genshinScores.push_back(genshinScore);
		caixukunScores.push_back(caixukunScore);
		ceshiyujuScores.push_back(ceshiyujuScore);
		genshinRanked.emplace_back(corpus[i], genshinScore);
		caixukunRanked.emplace_back(corpus[i], caixukunScore);
		ceshiyujuRanked.emplace_back(corpus[i], ceshiyujuScore);
	}

	std::sort(genshinRanked.begin(), genshinRanked.end(), [](const auto &lhs, const auto &rhs) {
		return lhs.second > rhs.second;
	});
	std::sort(caixukunRanked.begin(), caixukunRanked.end(), [](const auto &lhs, const auto &rhs) {
		return lhs.second > rhs.second;
	});
	std::sort(ceshiyujuRanked.begin(), ceshiyujuRanked.end(), [](const auto &lhs, const auto &rhs) {
		return lhs.second > rhs.second;
	});

	for (const auto &[candidate, score] : genshinRanked) {
		std::cout << "[EmbeddingLive] query=原神 candidate=" << candidate << " score=" << score << std::endl;
	}
	for (const auto &[candidate, score] : caixukunRanked) {
		std::cout << "[EmbeddingLive] query=蔡徐坤 candidate=" << candidate << " score=" << score << std::endl;
	}
	for (const auto &[candidate, score] : ceshiyujuRanked) {
		std::cout << "[EmbeddingLive] query=ceshiyuju candidate=" << candidate << " score=" << score << std::endl;
	}

	ASSERT_EQ(genshinScores.size(), corpus.size());
	ASSERT_EQ(caixukunScores.size(), corpus.size());
	ASSERT_EQ(ceshiyujuScores.size(), corpus.size());
	EXPECT_GT(genshinScores[2], genshinScores[0]);
	EXPECT_GT(caixukunScores[1], caixukunScores[0]);
}

}} // namespace quickmemes::testing
