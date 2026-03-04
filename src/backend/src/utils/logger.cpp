/**
 * @file logger.cpp
 * @brief Logger 单例实现
 */

#include "utils/logger.hpp"

#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace quickmemes {

std::string logLevelToString(LogLevel level) {
    switch (level) {
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO:  return "INFO ";
        case LogLevel::WARN:  return "WARN ";
        case LogLevel::ERROR: return "ERROR";
        case LogLevel::FATAL: return "FATAL";
    }
    return "?????";
}

LogLevel logLevelFromString(const std::string& str) {
    if (str == "DEBUG") return LogLevel::DEBUG;
    if (str == "WARN")  return LogLevel::WARN;
    if (str == "ERROR") return LogLevel::ERROR;
    if (str == "FATAL") return LogLevel::FATAL;
    return LogLevel::INFO;
}

Logger& Logger::get() {
    static Logger instance;
    return instance;
}

void Logger::initialize(const std::string& logDir, LogLevel minLevel,
                        bool retentionEnabled, int retentionDays) {
    std::lock_guard lock(mutex_);
    logDir_ = logDir;
    minLevel_ = minLevel;
    retentionEnabled_ = retentionEnabled;
    retentionDays_ = retentionDays;
    initialized_ = true;

    // 创建日志目录（若不存在）
    std::error_code ec;
    std::filesystem::create_directories(logDir_, ec);
    if (ec) {
        std::cerr << "[WARN] Failed to create log directory: " << logDir_
                  << " (" << ec.message() << ")" << std::endl;
    }

    // 若启用日志清理，立即执行一次
    if (retentionEnabled_) {
        // NOTE: cleanOldLogs 内部需要 mutex_，此处已持锁，
        // 因此直接内联清理逻辑或使用无锁版本
        // TODO: implement log cleanup logic
    }
}

void Logger::log(LogLevel level, const std::string& module, const std::string& message) {
    if (level < minLevel_) return;

    // 格式化时间戳
    auto now = std::chrono::system_clock::now();
    auto timeT = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    std::tm tm{};
    localtime_r(&timeT, &tm);

    std::ostringstream timestamp;
    timestamp << std::put_time(&tm, "%Y-%m-%d %H:%M:%S")
              << '.' << std::setfill('0') << std::setw(3) << ms.count();

    // 格式化模块名（固定宽度 8 字符）
    std::string paddedModule = module;
    if (paddedModule.size() < 8) {
        paddedModule.resize(8, ' ');
    }

    // 格式化日志行
    std::ostringstream line;
    line << "[" << timestamp.str() << "] "
         << "[" << logLevelToString(level) << "] "
         << "[" << paddedModule << "] "
         << message << "\n";
    std::string logLine = line.str();

    {
        std::lock_guard lock(mutex_);

        // 输出到 stderr
        std::cerr << logLine;

        // 写入文件
        if (initialized_ && !logDir_.empty()) {
            std::ostringstream dateStr;
            dateStr << std::put_time(&tm, "%Y-%m-%d");
            std::string filename = logDir_ + "/" + module + "-" + dateStr.str() + ".log";

            std::ofstream ofs(filename, std::ios::app);
            if (ofs.is_open()) {
                ofs << logLine;
            }
        }
    }

    // FATAL 级别写入后终止进程
    if (level == LogLevel::FATAL) {
        std::abort();
    }
}

void Logger::setMinLevel(LogLevel level) {
    std::lock_guard lock(mutex_);
    minLevel_ = level;
}

int Logger::cleanOldLogs(int retentionDays) {
    // TODO: implement — 遍历 logDir_ 目录，解析文件名中的日期，删除超期文件
    (void)retentionDays;
    return 0;
}

}  // namespace quickmemes
