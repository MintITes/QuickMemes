/**
 * @file test_logger.cpp
 * @brief Logger 模块测试
 */

#include "utils/logger.hpp"
#include <gtest/gtest.h>
#include <filesystem>

namespace quickmemes {
namespace testing {

class LoggerTest : public ::testing::Test {
protected:
    void SetUp() override {
        tmpDir = std::filesystem::temp_directory_path() / "qm_test_logs";
        std::filesystem::create_directory(tmpDir);
    }

    void TearDown() override {
        std::filesystem::remove_all(tmpDir);
    }

    std::filesystem::path tmpDir;
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

}  // namespace testing
}  // namespace quickmemes
