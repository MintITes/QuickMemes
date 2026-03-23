/**
 * @file config_parser.cpp
 * @brief 命令行参数解析实现
 */

#include "utils/config_parser.hpp"

#include <iostream>
#include <stdexcept>
#include <string>
#include <unordered_map>

namespace quickmemes {

ServerConfig parseArgs(int argc, char *argv[]) {
	ServerConfig config;

	// 构建参数 map
	std::unordered_map<std::string, std::string> args;
	for (int i = 1; i < argc; ++i) {
		std::string arg = argv[i];
		if (arg.starts_with("--")) {
			auto eqPos = arg.find('=');
			if (eqPos != std::string::npos) {
				args[arg.substr(0, eqPos)] = arg.substr(eqPos + 1);
			} else if (i + 1 < argc && !std::string(argv[i + 1]).starts_with("--")) {
				args[arg] = argv[i + 1];
				++i;
			} else {
				args[arg] = "true";
			}
		}
	}

	// 辅助：获取字符串参数
	auto getString = [&](const std::string &key, std::string &out, bool required = false) {
		if (auto it = args.find(key); it != args.end()) {
			out = it->second;
		} else if (required) {
			throw std::invalid_argument("missing required argument " + key);
		}
	};

	// 辅助：获取 int 参数
	auto getInt = [&](const std::string &key, int &out, bool required = false) {
		if (auto it = args.find(key); it != args.end()) {
			try {
				out = std::stoi(it->second);
			} catch (...) { throw std::invalid_argument("invalid integer value for " + key); }
		} else if (required) {
			throw std::invalid_argument("missing required argument " + key);
		}
	};

	auto getDouble = [&](const std::string &key, double &out, bool required = false) {
		if (auto it = args.find(key); it != args.end()) {
			try {
				out = std::stod(it->second);
			} catch (...) { throw std::invalid_argument("invalid number value for " + key); }
		} else if (required) {
			throw std::invalid_argument("missing required argument " + key);
		}
	};

	// 辅助：获取 bool 参数
	auto getBool = [&](const std::string &key, bool &out, bool required = false) {
		if (auto it = args.find(key); it != args.end()) {
			out = (it->second == "true" || it->second == "1");
		} else if (required) {
			throw std::invalid_argument("missing required argument " + key);
		}
	};

	// 解析必传参数
	getString("--bind-address", config.bindAddress, true);
	getInt("--port", config.port, true);
	getString("--auth-token", config.authToken, true);
	getString("--storage-path", config.storagePath, true);
	getString("--db-path", config.dbPath, true);
	getString("--log-dir", config.logDir, true);
	getString("--log-level", config.logLevel, true);

	// 解析严格必传属性
	getBool("--log-retention-enabled", config.logRetentionEnabled, true);
	getInt("--log-retention-days", config.logRetentionDays, true);

	getString("--api-key", config.visionConfig.apiKey, true);
	getString("--api-base-url", config.visionConfig.apiBaseUrl, true);
	getString("--vision-model", config.visionConfig.visionModel, true);
	getInt("--api-timeout", config.visionConfig.timeoutSeconds, true);
	getInt("--api-retries", config.visionConfig.maxRetries, true);

	getString("--ocr-api-key", config.visionConfig.ocrApiKey, true);
	getString("--ocr-api-url", config.visionConfig.ocrApiUrl, true);
	getString("--ocr-provider", config.visionConfig.ocrProvider, true);

	getString("--embedding-provider", config.embeddingConfig.provider, true);
	getString("--embedding-model", config.embeddingConfig.model, true);
	getString("--embedding-api-url", config.embeddingConfig.apiUrl, true);
	getString("--embedding-api-key", config.embeddingConfig.apiKey, true);
	getInt("--embedding-dimensions", config.embeddingConfig.dimensions, true);
	getInt("--embedding-timeout", config.embeddingConfig.timeoutSeconds, true);
	getInt("--embedding-retries", config.embeddingConfig.maxRetries, true);

	getInt("--search-max-candidates-per-scorer", config.searchConfig.maxCandidatesPerScorer, true);
	getInt("--search-vector-top-k", config.searchConfig.vectorTopK, true);
	getDouble("--search-min-score", config.searchConfig.minScore, true);
	getDouble("--search-weight-name", config.searchConfig.weights.name, true);
	getDouble("--search-weight-description", config.searchConfig.weights.description, true);
	getDouble("--search-weight-ocr-text", config.searchConfig.weights.ocrText, true);
	getDouble("--search-weight-tag-name", config.searchConfig.weights.tagName, true);
	getDouble("--search-weight-category-name", config.searchConfig.weights.categoryName, true);
	getDouble("--search-weight-vector-description", config.searchConfig.weights.vectorDescription, true);
	getDouble("--search-weight-vector-ocr", config.searchConfig.weights.vectorOcr, true);

	getBool("--thumbnail-enabled", config.thumbnailEnabled, true);
	getInt("--thumbnail-max-size", config.thumbnailMaxSize, true);
	getBool("--backup-enabled", config.backupEnabled, true);
	getInt("--backup-retention-days", config.backupRetentionDays, true);
	getInt("--recycle-bin-retention-days", config.recycleBinRetentionDays, true);
	getInt("--max-queue-size", config.maxQueueSize, true);
	getInt("--worker-count", config.workerCount, true);

	return config;
}

} // namespace quickmemes
