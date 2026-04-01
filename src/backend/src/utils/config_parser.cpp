/**
 * @file config_parser.cpp
 * @brief 命令行参数解析实现
 */

#include "utils/config_parser.hpp"

#include <algorithm>
#include <charconv>
#include <format>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace quickmemes {

ServerConfig parseArgs(int argc, char *argv[]) {
	ServerConfig config;

	// 构建参数 vector (连续内存，避免堆碎片)
	std::vector<std::pair<std::string_view, std::optional<std::string_view>>> args;
	args.reserve(static_cast<size_t>(argc));

	for (int i = 1; i < argc; ++i) {
		std::string_view arg = argv[i];
		if (arg.starts_with("--")) {
			if (auto eqPos = arg.find('='); eqPos != std::string_view::npos) {
				args.emplace_back(arg.substr(0, eqPos), arg.substr(eqPos + 1));
			} else if (i + 1 < argc && !std::string_view(argv[i + 1]).starts_with("--")) {
				args.emplace_back(arg, argv[i + 1]);
				++i;
			} else {
				args.emplace_back(arg, std::nullopt);
			}
		}
	}

	// 辅助：获取字符串参数
	auto getString = [&](std::string_view key, std::string &out, bool required = false) {
		auto it = std::ranges::find_if(args, [key](const auto &pair) { return pair.first == key; });
		if (it != args.end()) {
			if (!it->second.has_value()) {
				throw std::invalid_argument(std::format("missing value for {}", key));
			}
			out = *it->second;
		} else if (required) {
			throw std::invalid_argument(std::format("missing required argument {}", key));
		}
	};

	// 辅助：获取 int 参数
	auto getInt = [&](std::string_view key, int &out, bool required = false) {
		auto it = std::ranges::find_if(args, [key](const auto &pair) { return pair.first == key; });
		if (it != args.end()) {
			if (!it->second.has_value()) {
				throw std::invalid_argument(std::format("missing value for {}", key));
			}
			std::string_view value  = *it->second;
			const auto      *begin  = value.data();
			const auto      *end    = value.data() + value.size();
			int              parsed = 0;
			if (auto result = std::from_chars(begin, end, parsed);
			    result.ec != std::errc{} || result.ptr != end) {
				throw std::invalid_argument(std::format("invalid integer value for {}", key));
			}
			out = parsed;
		} else if (required) {
			throw std::invalid_argument(std::format("missing required argument {}", key));
		}
	};

	// 辅助：获取 bool 参数
	auto getBool = [&](std::string_view key, bool &out, bool required = false) {
		auto it = std::ranges::find_if(args, [key](const auto &pair) { return pair.first == key; });
		if (it != args.end()) {
			if (!it->second.has_value()) {
				out = true;
				return;
			}
			std::string_view value = *it->second;
			if (value == "true" || value == "1") {
				out = true;
			} else if (value == "false" || value == "0") {
				out = false;
			} else {
				throw std::invalid_argument(std::format("invalid boolean value for {}", key));
			}
		} else if (required) {
			throw std::invalid_argument(std::format("missing required argument {}", key));
		}
	};



	// 解析核心必传参数
	getString("--bind-address", config.bindAddress, true);
	getInt("--port", config.port, true);
	getString("--auth-token", config.authToken, true);
	getString("--storage-path", config.storagePath, true);
	getString("--db-path", config.dbPath, true);
	getString("--log-dir", config.logDir, true);
	getString("--log-level", config.logLevel, true);

	// 可选项
	getBool("--log-retention-enabled", config.logRetentionEnabled);
	getInt("--log-retention-days", config.logRetentionDays);

	getString("--api-key", config.visionConfig.apiKey);
	getString("--api-base-url", config.visionConfig.apiBaseUrl);
	getString("--vision-model", config.visionConfig.visionModel);
	getInt("--api-timeout", config.visionConfig.timeoutSeconds);
	getInt("--api-retries", config.visionConfig.maxRetries);

	getString("--ocr-api-key", config.visionConfig.ocrApiKey);
	getString("--ocr-api-url", config.visionConfig.ocrApiUrl);
	getString("--ocr-provider", config.visionConfig.ocrProvider);

	getString("--embedding-provider", config.embeddingConfig.provider);
	getString("--embedding-model", config.embeddingConfig.model);
	getString("--embedding-api-url", config.embeddingConfig.apiUrl);
	getString("--embedding-api-key", config.embeddingConfig.apiKey);
	getInt("--embedding-dimensions", config.embeddingConfig.dimensions);
	getInt("--embedding-timeout", config.embeddingConfig.timeoutSeconds);
	getInt("--embedding-retries", config.embeddingConfig.maxRetries);

	getBool("--thumbnail-enabled", config.thumbnailEnabled);
	getInt("--thumbnail-max-size", config.thumbnailMaxSize);
	getBool("--backup-enabled", config.backupEnabled);
	getInt("--backup-retention-days", config.backupRetentionDays);
	getInt("--recycle-bin-retention-days", config.recycleBinRetentionDays);
	getInt("--max-queue-size", config.maxQueueSize);
	getInt("--worker-count", config.workerCount);

	return config;
}

} // namespace quickmemes
