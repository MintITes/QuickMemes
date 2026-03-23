/**
 * @file test_config_parser.cpp
 * @brief 命令行参数解析测试
 */

#include "utils/config_parser.hpp"

#include <gtest/gtest.h>
#include <vector>

namespace quickmemes { namespace testing {

TEST(ConfigParserTest, ParseArgs_ValidArgs_PopulatesConfig) {
	const std::vector<const char *> rawArgs = {"quickmemes",
	                                           "--bind-address",
	                                           "0.0.0.0",
	                                           "--port",
	                                           "8080",
	                                           "--auth-token",
	                                           "secret-token",
	                                           "--storage-path",
	                                           "/var/lib/quickmemes/storage",
	                                           "--db-path",
	                                           "/var/lib/quickmemes/db.sqlite3",
	                                           "--log-dir",
	                                           "/var/log/quickmemes",
	                                           "--log-level",
	                                           "info",
	                                           "--log-retention-enabled",
	                                           "true",
	                                           "--log-retention-days",
	                                           "7",
	                                           "--api-key",
	                                           "vision-key",
	                                           "--api-base-url",
	                                           "https://api.example.com/v1",
	                                           "--vision-model",
	                                           "gpt-4v",
	                                           "--embedding-provider",
	                                           "JinaAI",
	                                           "--embedding-model",
	                                           "jina-embeddings-v5-text-small",
	                                           "--embedding-api-url",
	                                           "https://api.jina.ai/v1/embeddings",
	                                           "--embedding-api-key",
	                                           "embedding-key",
	                                           "--embedding-dimensions",
	                                           "768",
	                                           "--embedding-timeout",
	                                           "28",
	                                           "--embedding-retries",
	                                           "4",
	                                           "--search-max-candidates-per-scorer",
	                                           "320",
	                                           "--search-vector-top-k",
	                                           "88",
	                                           "--search-min-score",
	                                           "0.15",
	                                           "--search-weight-name",
	                                           "0.31",
	                                           "--search-weight-description",
	                                           "0.17",
	                                           "--search-weight-ocr-text",
	                                           "0.16",
	                                           "--search-weight-tag-name",
	                                           "0.12",
	                                           "--search-weight-category-name",
	                                           "0.08",
	                                           "--search-weight-vector-description",
	                                           "0.09",
	                                           "--search-weight-vector-ocr",
	                                           "0.07",
	                                           "--api-timeout",
	                                           "45",
	                                           "--api-retries",
	                                           "3",
	                                           "--ocr-api-key",
	                                           "ocr-key",
	                                           "--ocr-api-url",
	                                           "https://ocr.example.com",
	                                           "--ocr-provider",
	                                           "PaddleOCR",
	                                           "--thumbnail-enabled",
	                                           "false",
	                                           "--thumbnail-max-size",
	                                           "256",
	                                           "--backup-enabled",
	                                           "true",
	                                           "--backup-retention-days",
	                                           "14",
	                                           "--recycle-bin-retention-days",
	                                           "21",
	                                           "--max-queue-size",
	                                           "1200",
	                                           "--worker-count",
	                                           "8"};

	std::vector<char *> argv;
	argv.reserve(rawArgs.size());
	for (const auto *arg : rawArgs)
		argv.push_back(const_cast<char *>(arg));

	const int argc = static_cast<int>(argv.size());

	auto config = parseArgs(argc, argv.data());

	EXPECT_EQ(config.bindAddress, "0.0.0.0");
	EXPECT_EQ(config.port, 8080);
	EXPECT_EQ(config.authToken, "secret-token");
	EXPECT_EQ(config.storagePath, "/var/lib/quickmemes/storage");
	EXPECT_EQ(config.dbPath, "/var/lib/quickmemes/db.sqlite3");
	EXPECT_EQ(config.logDir, "/var/log/quickmemes");
	EXPECT_EQ(config.logLevel, "info");
	EXPECT_TRUE(config.logRetentionEnabled);
	EXPECT_EQ(config.logRetentionDays, 7);

	EXPECT_EQ(config.visionConfig.apiKey, "vision-key");
	EXPECT_EQ(config.visionConfig.apiBaseUrl, "https://api.example.com/v1");
	EXPECT_EQ(config.visionConfig.visionModel, "gpt-4v");
	EXPECT_EQ(config.visionConfig.timeoutSeconds, 45);
	EXPECT_EQ(config.visionConfig.maxRetries, 3);
	EXPECT_EQ(config.visionConfig.ocrApiKey, "ocr-key");
	EXPECT_EQ(config.visionConfig.ocrApiUrl, "https://ocr.example.com");
	EXPECT_EQ(config.visionConfig.ocrProvider, "PaddleOCR");
	EXPECT_EQ(config.embeddingConfig.provider, "JinaAI");
	EXPECT_EQ(config.embeddingConfig.model, "jina-embeddings-v5-text-small");
	EXPECT_EQ(config.embeddingConfig.apiUrl, "https://api.jina.ai/v1/embeddings");
	EXPECT_EQ(config.embeddingConfig.apiKey, "embedding-key");
	EXPECT_EQ(config.embeddingConfig.dimensions, 768);
	EXPECT_EQ(config.embeddingConfig.timeoutSeconds, 28);
	EXPECT_EQ(config.embeddingConfig.maxRetries, 4);
	EXPECT_EQ(config.searchConfig.maxCandidatesPerScorer, 320);
	EXPECT_EQ(config.searchConfig.vectorTopK, 88);
	EXPECT_DOUBLE_EQ(config.searchConfig.minScore, 0.15);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.name, 0.31);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.description, 0.17);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.ocrText, 0.16);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.tagName, 0.12);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.categoryName, 0.08);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.vectorDescription, 0.09);
	EXPECT_DOUBLE_EQ(config.searchConfig.weights.vectorOcr, 0.07);

	EXPECT_FALSE(config.thumbnailEnabled);
	EXPECT_EQ(config.thumbnailMaxSize, 256);
	EXPECT_TRUE(config.backupEnabled);
	EXPECT_EQ(config.backupRetentionDays, 14);
	EXPECT_EQ(config.recycleBinRetentionDays, 21);
	EXPECT_EQ(config.maxQueueSize, 1200);
	EXPECT_EQ(config.workerCount, 8);
}

// NOTE: 测试缺少必填参数通常会导致 exit(1)，
// 可以在 GTest 中使用 EXPECT_DEATH 测试

TEST(ConfigParserTest, ParseArgs_MissingRequired_Exits) {
	const std::vector<const char *> rawArgs = {"quickmemes", "--bind-address", "0.0.0.0"};

	std::vector<char *> argv;
	argv.reserve(rawArgs.size());
	for (const auto *arg : rawArgs)
		argv.push_back(const_cast<char *>(arg));

	const int argc = static_cast<int>(argv.size());

	EXPECT_THROW(
	    {
		    try {
			    (void)parseArgs(argc, argv.data());
		    } catch (const std::invalid_argument &e) {
			    EXPECT_NE(std::string(e.what()).find("missing required argument --port"), std::string::npos);
			    throw;
		    }
	    },
	    std::invalid_argument);
}

}} // namespace quickmemes::testing
