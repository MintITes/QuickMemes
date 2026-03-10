/**
 * @file test_config_parser.cpp
 * @brief 命令行参数解析测试
 */

#include "utils/config_parser.hpp"

#include <gtest/gtest.h>

namespace quickmemes {
namespace testing {

TEST(ConfigParserTest, ParseArgs_ValidArgs_PopulatesConfig) {
	// TODO: implement — 模拟 arc/argv 数组
}

// NOTE: 测试缺少必填参数通常会导致 exit(1)，
// 可以在 GTest 中使用 EXPECT_DEATH 测试

TEST(ConfigParserTest, ParseArgs_MissingRequired_Exits) {
	// TODO: implement
}

} // namespace testing
} // namespace quickmemes
