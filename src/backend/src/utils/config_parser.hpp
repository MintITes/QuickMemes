#pragma once
/**
 * @file config_parser.hpp
 * @brief 命令行参数解析与服务器配置结构
 *
 * 严格对应 docs/arch/config.md「C++ 命令行参数规范」和
 * docs/arch/cpp_core.md「ServerConfig / VisionConfig」定义。
 */

#include <string>

namespace quickmemes {

/**
 * @brief Vision 模块配置
 *
 * 由 C++ 核心模块在 startServer 时传递给 Vision 模块初始化。
 */
struct VisionConfig {
	std::string apiKey;              ///< AI API 鉴权密钥
	std::string apiBaseUrl;          ///< AI API 基础 URL（兼容 OpenAI 格式）
	std::string visionModel;         ///< 图像分析模型名称
	int         timeoutSeconds = 30; ///< 单次请求超时秒数
	int         maxRetries     = 2;  ///< 失败重试次数
	std::string ocrApiKey;           ///< 云端 OCR API 密钥（可为空）
	std::string ocrApiUrl;           ///< 云端 OCR API 地址（PaddleOCR / 兼容旧提供商）
	std::string ocrProvider;         ///< 云端 OCR 提供商标识（如 "PaddleOCR"）
};

/**
 * @brief Embedding 模块配置
 *
 * 由 C++ 核心模块在 startServer 时传递给 Embedding 模块初始化。
 */
struct EmbeddingConfig {
	std::string provider;            ///< Embedding 提供商标识
	std::string model;               ///< Embedding 模型名称
	std::string apiUrl;              ///< Embedding API 地址
	std::string apiKey;              ///< Embedding API 密钥
	int         dimensions     = 512; ///< 向量维度
	int         timeoutSeconds = 30;  ///< 单次请求超时秒数
	int         maxRetries     = 2;   ///< 失败重试次数
};

/**
 * @brief 服务器全局配置
 *
 * 由 main() 中 parseArgs() 解析命令行参数后构建。
 * 传递给 startServer() 启动各子模块。
 */
struct ServerConfig {
	std::string  bindAddress;                    ///< HTTP/WS 绑定地址（默认 "127.0.0.1"）
	int          port = 0;                       ///< HTTP/WS 监听端口
	std::string  authToken;                      ///< 请求校验令牌
	std::string  storagePath;                    ///< Meme 文件存储根目录
	std::string  dbPath;                         ///< SQLite 数据库文件路径
	std::string  logDir;                         ///< 日志文件输出目录
	std::string  logLevel;                       ///< 最低日志输出等级
	bool         logRetentionEnabled = true;     ///< 是否启用日志自动清理
	int          logRetentionDays    = 30;       ///< 日志保留天数
	VisionConfig visionConfig;                   ///< Vision 模块配置
	EmbeddingConfig embeddingConfig;             ///< Embedding 模块配置
	int          workerCount             = 4;    ///< 导入线程池线程数
	int          maxQueueSize            = 500;  ///< 处理队列最大深度
	bool         thumbnailEnabled        = true; ///< 是否启用缩略图生成
	int          thumbnailMaxSize        = 300;  ///< 缩略图最大边长像素
	bool         backupEnabled           = true; ///< 是否启用自动备份
	int          backupRetentionDays     = 30;   ///< 备份保留天数
	int          recycleBinRetentionDays = 30;   ///< 回收站保留天数
};

/**
 * @brief 解析命令行参数，构建 ServerConfig
 *
 * 在 main() 入口中调用，遍历 argv 按 --key value 格式解析全部参数。
 * 任意必传参数缺失时，输出错误信息并以退出码 1 终止。
 *
 * @param argc int 命令行参数个数
 * @param argv char*[] 命令行参数数组
 * @return ServerConfig 完整填充的服务器配置对象
 */
[[nodiscard]] ServerConfig parseArgs(int argc, char *argv[]);

} // namespace quickmemes
