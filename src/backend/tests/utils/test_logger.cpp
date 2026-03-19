/**
 * @file test_logger.cpp
 * @brief Logger 模块测试
 */

#include "../test_utils.hpp"
#include "utils/logger.hpp"

#include <chrono>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iomanip>
#include <sstream>

namespace quickmemes { namespace testing {

class LoggerTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
	}

	void TearDown() override {
		tempDir_.reset();
	}

	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(LoggerTest, LogWrite_AboveMinLevel_WritesToFile) {
	auto &logger = ::quickmemes::Logger::get();
	logger.initialize(tempDir_->getPath(), ::quickmemes::LogLevel::LL_DEBUG, false);

	const std::string module  = "logtest1"; // unique module to avoid cached streams
	const std::string message = "hello logger";
	logger.log(::quickmemes::LogLevel::LL_INFO, module, message);

	// build expected log file path: <logDir>/<module>-<YYYY-MM-DD>.log
	auto    now   = std::chrono::system_clock::now();
	auto    timeT = std::chrono::system_clock::to_time_t(now);
	std::tm tm{};
#ifdef _WIN32
	localtime_s(&tm, &timeT);
#else
	localtime_r(&timeT, &tm);
#endif
	std::ostringstream date;
	date << std::put_time(&tm, "%Y-%m-%d");
	const std::string logPath = tempDir_->getPath() + "/" + module + "-" + date.str() + ".log";

	ASSERT_TRUE(std::filesystem::exists(logPath));
	std::ifstream ifs(logPath);
	ASSERT_TRUE(ifs.is_open());
	std::stringstream buffer;
	buffer << ifs.rdbuf();
	ASSERT_NE(buffer.str().find(message), std::string::npos);
}

TEST_F(LoggerTest, LogWrite_BelowMinLevel_IgnoresLog) {
	auto &logger = ::quickmemes::Logger::get();
	logger.initialize(tempDir_->getPath(), ::quickmemes::LogLevel::LL_WARN, false);

	const std::string module  = "logtest2";
	const std::string message = "should be filtered";
	logger.log(::quickmemes::LogLevel::LL_DEBUG, module, message);

	auto    now   = std::chrono::system_clock::now();
	auto    timeT = std::chrono::system_clock::to_time_t(now);
	std::tm tm{};
#ifdef _WIN32
	localtime_s(&tm, &timeT);
#else
	localtime_r(&timeT, &tm);
#endif
	std::ostringstream date;
	date << std::put_time(&tm, "%Y-%m-%d");
	const std::string logPath = tempDir_->getPath() + "/" + module + "-" + date.str() + ".log";

	ASSERT_FALSE(std::filesystem::exists(logPath));
}

TEST_F(LoggerTest, CleanOldLogs_RemovesExpiredFiles) {
	const std::string logDir = tempDir_->getPath();
	const std::string oldLog = logDir + "/old.log";
	const std::string newLog = logDir + "/new.log";

	{
		std::ofstream ofsOld(oldLog);
		ofsOld << "old";
	}
	{
		std::ofstream ofsNew(newLog);
		ofsNew << "new";
	}

	const auto nowFileClock = std::filesystem::file_time_type::clock::now();
	std::filesystem::last_write_time(oldLog, nowFileClock - std::chrono::hours(24 * 5)); // 5 days ago
	std::filesystem::last_write_time(newLog, nowFileClock - std::chrono::hours(24));     // 1 day ago

	auto &logger = ::quickmemes::Logger::get();
	logger.initialize(logDir, ::quickmemes::LogLevel::LL_INFO, false);

	int removed = logger.cleanOldLogs(3);
	EXPECT_EQ(removed, 1);
	EXPECT_FALSE(std::filesystem::exists(oldLog));
	EXPECT_TRUE(std::filesystem::exists(newLog));
}

}} // namespace quickmemes::testing
