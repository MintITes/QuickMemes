/**
 * @file config_parser.cpp
 * @brief 命令行参数解析实现
 */

#include "utils/config_parser.hpp"

#include <iostream>
#include <string>
#include <unordered_map>

namespace quickmemes {

ServerConfig parseArgs(int argc, char* argv[]) {
    ServerConfig config;

    // 构建参数 map
    std::unordered_map<std::string, std::string> args;
    for (int i = 1; i < argc - 1; i += 2) {
        args[argv[i]] = argv[i + 1];
    }

    // 辅助：获取字符串参数
    auto getString = [&](const std::string& key, std::string& out, bool required = false) {
        if (auto it = args.find(key); it != args.end()) {
            out = it->second;
        } else if (required) {
            std::cerr << "Error: missing required argument " << key << std::endl;
            std::exit(1);
        }
    };

    // 辅助：获取 int 参数
    auto getInt = [&](const std::string& key, int& out, bool required = false) {
        if (auto it = args.find(key); it != args.end()) {
            try {
                out = std::stoi(it->second);
            } catch (...) {
                std::cerr << "Error: invalid integer value for " << key << std::endl;
                std::exit(1);
            }
        } else if (required) {
            std::cerr << "Error: missing required argument " << key << std::endl;
            std::exit(1);
        }
    };

    // 辅助：获取 bool 参数
    auto getBool = [&](const std::string& key, bool& out) {
        if (auto it = args.find(key); it != args.end()) {
            out = (it->second == "true" || it->second == "1");
        }
    };

    // 解析必传参数
    getString("--bind-address",  config.bindAddress,  true);
    getInt   ("--port",          config.port,         true);
    getString("--auth-token",    config.authToken,    true);
    getString("--storage-path",  config.storagePath,  true);
    getString("--db-path",       config.dbPath,       true);
    getString("--log-dir",       config.logDir,       true);
    getString("--log-level",     config.logLevel,     true);

    // 解析可选参数
    getBool("--log-retention-enabled", config.logRetentionEnabled);
    getInt ("--log-retention-days",    config.logRetentionDays);

    getString("--api-key",         config.visionConfig.apiKey);
    getString("--api-base-url",    config.visionConfig.apiBaseUrl);
    getString("--vision-model",    config.visionConfig.visionModel);
    getString("--embedding-model", config.visionConfig.embeddingModel);
    getInt   ("--api-timeout",     config.visionConfig.timeoutSeconds);
    getInt   ("--api-retries",     config.visionConfig.maxRetries);

    getString("--ocr-api-key",  config.visionConfig.ocrApiKey);
    getString("--ocr-api-url",  config.visionConfig.ocrApiUrl);
    getString("--ocr-provider", config.visionConfig.ocrProvider);

    getBool("--thumbnail-enabled",     config.thumbnailEnabled);
    getInt ("--thumbnail-max-size",    config.thumbnailMaxSize);
    getBool("--backup-enabled",        config.backupEnabled);
    getInt ("--backup-retention-days", config.backupRetentionDays);
    getInt ("--max-queue-size",        config.maxQueueSize);

    return config;
}

}  // namespace quickmemes
