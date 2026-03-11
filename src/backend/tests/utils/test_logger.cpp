/**
 * @file test_logger.cpp
 * @brief Logger 模块测试
 */

#include "../test_utils.hpp"
#include "utils/logger.hpp"

#include <filesystem>
#include <gtest/gtest.h>

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
	// TODO: implement
}

TEST_F(LoggerTest, LogWrite_BelowMinLevel_IgnoresLog) {
	// TODO: implement
}

TEST_F(LoggerTest, CleanOldLogs_RemovesExpiredFiles) {
	// TODO: implement
}

}} // namespace quickmemes::testing
