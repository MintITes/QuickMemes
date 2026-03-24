#pragma once
/**
 * @file logger.hpp
 * @brief QuickMemes C++ 日志模块
 *
 * 严格对应 docs/arch/logger.md。
 * 提供 Logger 单例和日志宏，支持五个等级、线程安全写入、日志文件自动清理。
 */

#include <cstdint>
#include <atomic>
#include <fstream>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace quickmemes {

/**
 * @brief 日志等级枚举
 *
 * 对应 logger.md 定义的五个日志等级。
 * 数值越大优先级越高，低于 minLevel 的日志不输出。
 */
enum class LogLevel : int {
	LL_DEBUG = 0, ///< 调试信息
	LL_INFO  = 1, ///< 一般信息
	LL_WARN  = 2, ///< 警告
	LL_ERROR = 3, ///< 错误
	LL_FATAL = 4  ///< 致命错误（写入后终止进程）
};

/**
 * @brief 将 LogLevel 枚举转换为固定宽度 5 字符的字符串
 * @param level LogLevel 枚举值
 * @return std::string 如 "INFO " / "ERROR"
 */
[[nodiscard]] std::string logLevelToString(LogLevel level);

/**
 * @brief 将字符串解析为 LogLevel 枚举
 * @param str std::string 如 "DEBUG" / "INFO" / "WARN" / "ERROR" / "FATAL"
 * @return LogLevel 对应枚举值，未识别时返回 LogLevel::INFO
 */
[[nodiscard]] LogLevel logLevelFromString(const std::string &str);

/**
 * @brief 全局 Logger 单例
 *
 * Meyer's Singleton 模式。提供线程安全的日志写入能力。
 * 日志同时输出到 stderr 和文件 logs/{module}-{YYYY-MM-DD}.log。
 */
class Logger {
public:
	/**
	 * @brief 获取全局 Logger 单例实例
	 * @return Logger& 单例引用
	 */
	static Logger &get();

	/**
	 * @brief 初始化 Logger
	 *
	 * 创建日志目录（若不存在），设置最低输出等级和日志清理配置。
	 *
	 * @param logDir std::string 日志文件输出目录
	 * @param minLevel LogLevel 最低输出等级
	 * @param retentionEnabled bool 是否启用日志自动清理（默认 true）
	 * @param retentionDays int 日志保留天数（默认 30）
	 */
	void initialize(const std::string &logDir, LogLevel minLevel, bool retentionEnabled = true, int retentionDays = 30);

	/**
	 * @brief 写入一条日志
	 *
	 * 检查等级后格式化日志行，加锁写入文件和 stderr。
	 * FATAL 等级写入后调用 std::abort() 终止进程。
	 *
	 * @param level LogLevel 日志等级
	 * @param module std::string 模块名称（不超过 8 字符，如 "cpp_core"）
	 * @param message std::string 日志内容
	 */
	void log(LogLevel level, const std::string &module, const std::string &message);

	/**
	 * @brief 刷新当前已打开的日志文件流
	 *
	 * 用于测试或需要明确落盘时主动调用；正常日志热路径不再每条都 flush。
	 */
	void flush();

	/**
	 * @brief 设置最低输出等级
	 * @param level LogLevel 新的最低输出等级
	 */
	void setMinLevel(LogLevel level);

	/**
	 * @brief 清理超期日志文件
	 *
	 * 遍历 logDir 下所有 .log 文件，删除超过 retentionDays 天的文件。
	 *
	 * @param retentionDays int 日志保留天数
	 * @return int 已删除的日志文件数量
	 */
	int cleanOldLogs(int retentionDays);

	// 禁止拷贝和移动
	Logger(const Logger &)            = delete;
	Logger &operator=(const Logger &) = delete;

private:
	Logger() = default;

	std::string                                                     logDir_;                       ///< 日志文件输出目录
	std::atomic<LogLevel>                                           minLevel_{LogLevel::LL_INFO}; ///< 最低输出等级
	bool                                                            retentionEnabled_ = true;      ///< 是否启用日志清理
	int                                                             retentionDays_    = 30;        ///< 日志保留天数
	bool                                                            initialized_      = false;     ///< 是否已初始化
	std::mutex                                                      mutex_;          ///< 保护并发写入的互斥锁
	std::unordered_map<std::string, std::unique_ptr<std::ofstream>> fileStreams_;    ///< 模块对应的文件流
	std::string                                                     currentLogDate_; ///< 当前记录的日期，用于日志轮转

	/**
	 * @brief 内部无锁的日志清理方法
	 */
	int cleanOldLogsInternal(int retentionDays);
};

} // namespace quickmemes

// ─────────────────────────────────────────────────────────────
// 日志宏定义 — 各模块通过宏调用
// ─────────────────────────────────────────────────────────────

/// @brief 输出 DEBUG 级日志
/// @param module 模块名字符串
/// @param msg 日志内容字符串
#define LOG_DEBUG(module, msg) ::quickmemes::Logger::get().log(::quickmemes::LogLevel::LL_DEBUG, module, msg)

/// @brief 输出 INFO 级日志
/// @param module 模块名字符串
/// @param msg 日志内容字符串
#define LOG_INFO(module, msg) ::quickmemes::Logger::get().log(::quickmemes::LogLevel::LL_INFO, module, msg)

/// @brief 输出 WARN 级日志
/// @param module 模块名字符串
/// @param msg 日志内容字符串
#define LOG_WARN(module, msg) ::quickmemes::Logger::get().log(::quickmemes::LogLevel::LL_WARN, module, msg)

/// @brief 输出 ERROR 级日志
/// @param module 模块名字符串
/// @param msg 日志内容字符串
#define LOG_ERROR(module, msg) ::quickmemes::Logger::get().log(::quickmemes::LogLevel::LL_ERROR, module, msg)

/// @brief 输出 FATAL 级日志（写入后终止进程）
/// @param module 模块名字符串
/// @param msg 日志内容字符串
#define LOG_FATAL(module, msg) ::quickmemes::Logger::get().log(::quickmemes::LogLevel::LL_FATAL, module, msg)
