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
	case LogLevel::INFO: return "INFO ";
	case LogLevel::WARN: return "WARN ";
	case LogLevel::ERROR: return "ERROR";
	case LogLevel::FATAL: return "FATAL";
	}
	return "?????";
}

LogLevel logLevelFromString(const std::string &str) {
	if (str == "DEBUG") return LogLevel::DEBUG;
	if (str == "WARN") return LogLevel::WARN;
	if (str == "ERROR") return LogLevel::ERROR;
	if (str == "FATAL") return LogLevel::FATAL;
	return LogLevel::INFO;
}

Logger &Logger::get() {
	static Logger instance;
	return instance;
}

void Logger::initialize(const std::string &logDir, LogLevel minLevel, bool retentionEnabled, int retentionDays) {
	std::lock_guard lock(mutex_);
	logDir_           = logDir;
	minLevel_         = minLevel;
	retentionEnabled_ = retentionEnabled;
	retentionDays_    = retentionDays;
	initialized_      = true;

	// 创建日志目录（若不存在）
	std::error_code ec;
	std::filesystem::create_directories(logDir_, ec);
	if (ec) {
		std::cerr << "[WARN] Failed to create log directory: " << logDir_ << " (" << ec.message() << ")" << std::endl;
	}

	// 若启用日志清理，立即执行一次
	if (retentionEnabled_) {
		// 由于已经在 mutex_ 保护下执行，所以这里的 cleanOldLogs()
		// 本身不应再次尝试获取互斥锁。我们将其重构。
		cleanOldLogsInternal(retentionDays_);
	}
}

void Logger::log(LogLevel level, const std::string &module, const std::string &message) {
	if (level < minLevel_) return;

	// 格式化时间戳
	auto    now   = std::chrono::system_clock::now();
	auto    timeT = std::chrono::system_clock::to_time_t(now);
	auto    ms    = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
	std::tm tm{};
	localtime_r(&timeT, &tm);

	std::ostringstream timestamp;
	timestamp << std::put_time(&tm, "%Y-%m-%d %H:%M:%S") << '.' << std::setfill('0') << std::setw(3) << ms.count();

	// 格式化模块名（固定宽度 8 字符）
	std::string paddedModule = module;
	if (paddedModule.size() < 8) { paddedModule.resize(8, ' '); }

	// 格式化日志行
	std::ostringstream line;
	line << "[" << timestamp.str() << "] "
	     << "[" << logLevelToString(level) << "] "
	     << "[" << paddedModule << "] " << message << "\n";
	std::string logLine = line.str();

	{
		std::lock_guard lock(mutex_);

		// 输出到 stderr
		std::cerr << logLine;

		// 写入文件
		if (initialized_ && !logDir_.empty()) {
			std::ostringstream dateStr;
			dateStr << std::put_time(&tm, "%Y-%m-%d");
			std::string date = dateStr.str();

			// 日期发生变化时，清空当前的文件柄集（下次写入时会重新打开新日期的文件）
			if (date != currentLogDate_) {
				fileStreams_.clear();
				currentLogDate_ = date;
			}

			auto it = fileStreams_.find(module);
			if (it == fileStreams_.end()) {
				std::string filename = logDir_ + "/" + module + "-" + date + ".log";
				auto        ofs      = std::make_unique<std::ofstream>(filename, std::ios::app);
				if (ofs->is_open()) { it = fileStreams_.emplace(module, std::move(ofs)).first; }
			}

			if (it != fileStreams_.end() && it->second->is_open()) {
				*(it->second) << logLine;
				it->second->flush();
			}
		}
	}

	// FATAL 级别写入后终止进程
	if (level == LogLevel::FATAL) { std::abort(); }
}

void Logger::setMinLevel(LogLevel level) {
	std::lock_guard lock(mutex_);
	minLevel_ = level;
}

int Logger::cleanOldLogs(int retentionDays) {
	std::lock_guard lock(mutex_);
	return cleanOldLogsInternal(retentionDays);
}

int Logger::cleanOldLogsInternal(int retentionDays) {
	if (logDir_.empty()) return 0;

	int deletedCount = 0;
	try {
		auto                                now = std::chrono::system_clock::now();
		std::filesystem::directory_iterator dirIter(logDir_);

		for (auto &entry : dirIter) {
			if (entry.is_regular_file() && entry.path().extension() == ".log") {
				auto ftime  = std::filesystem::last_write_time(entry);
				auto sftime = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
				    ftime - std::filesystem::file_time_type::clock::now() + std::chrono::system_clock::now());

				auto ageDays = std::chrono::duration_cast<std::chrono::hours>(now - sftime).count() / 24;
				if (ageDays >= retentionDays) {
					std::filesystem::remove(entry.path());
					deletedCount++;
				}
			}
		}
	} catch (const std::exception &e) {
		std::cerr << "[ERROR] Exception during log cleanup: " << e.what() << std::endl;
	}

	return deletedCount;
}

} // namespace quickmemes
