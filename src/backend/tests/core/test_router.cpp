/**
 * @file test_router.cpp
 * @brief Router 模块单元测试
 */

#include "core/router.hpp"
#include <gtest/gtest.h>

namespace quickmemes {
namespace testing {

class RouterTest : public ::testing::Test {
protected:
    Router router;
};

TEST_F(RouterTest, RegisterAndDispatch_ValidRoute_CallsHandler) {
    // TODO: implement
}

TEST_F(RouterTest, Dispatch_InvalidRoute_Returns404) {
    // TODO: implement
}

TEST_F(RouterTest, VerifyAuthToken_ValidToken_ReturnsTrue) {
    EXPECT_TRUE(Router::verifyAuthToken("valid_token", "valid_token"));
}

TEST_F(RouterTest, VerifyAuthToken_InvalidToken_ReturnsFalse) {
    EXPECT_FALSE(Router::verifyAuthToken("invalid", "valid_token"));
}

}  // namespace testing
}  // namespace quickmemes
