/**
 * @file test_router.cpp
 * @brief Router 模块单元测试
 */

#include "core/handlers.hpp"
#include "core/router.hpp"
#include "db/database.hpp"

#include <gtest/gtest.h>

namespace quickmemes { namespace testing {

class RouterTest : public ::testing::Test {
protected:
	void SetUp() override {
		// Some handlers might call Database::get(), initialize a mock/memory one
		try {
			Database::get().initialize(":memory:");
		} catch (...) {}
		router.registerRoute("GET", "/api/health", handleGetHealth);
	}
	void TearDown() override {
		Database::get().shutdown();
	}
	Router router;
};

TEST_F(RouterTest, RegisterAndDispatch_ValidRoute_CallsHandler) {
	bool handlerCalled = false;
	router.registerRoute("GET", "/test", [&](const HttpRequestProxy &, HttpResponseProxy &res) {
		handlerCalled = true;
		res.status    = 200;
		res.body      = "ok";
	});

	HttpRequestProxy req;
	req.method = "GET";
	req.path   = "/test";
	HttpResponseProxy res;
	router.dispatch(req, res);

	EXPECT_TRUE(handlerCalled);
	EXPECT_EQ(res.status, 200);
	EXPECT_EQ(res.body, "ok");
}

TEST_F(RouterTest, Dispatch_InvalidRoute_Returns404) {
	HttpRequestProxy req;
	req.method = "GET";
	req.path   = "/invalid";
	HttpResponseProxy res;
	router.dispatch(req, res);

	EXPECT_EQ(res.status, 404);
}

TEST_F(RouterTest, VerifyAuthToken_ValidToken_ReturnsTrue) {
	EXPECT_TRUE(Router::verifyAuthToken("valid_token", "valid_token"));
}

TEST_F(RouterTest, VerifyAuthToken_InvalidToken_ReturnsFalse) {
	EXPECT_FALSE(Router::verifyAuthToken("invalid", "valid_token"));
}

TEST_F(RouterTest, Dispatch_AuthMissing_Returns401) {
	router.setAuthToken("secret");
	HttpRequestProxy req;
	req.method = "GET";
	req.path   = "/api/tags"; // Real endpoint
	HttpResponseProxy res;
	router.dispatch(req, res);

	EXPECT_EQ(res.status, 401);
}

TEST_F(RouterTest, Dispatch_AuthWrong_Returns403) {
	router.setAuthToken("secret");
	HttpRequestProxy req;
	req.method      = "GET";
	req.path        = "/api/tags";
	req.header_auth = "Bearer wrong_token";
	HttpResponseProxy res;
	router.dispatch(req, res);

	EXPECT_EQ(res.status, 403);
}

TEST_F(RouterTest, Dispatch_RealEndpoint_Exists) {
	// Should not return 404 for registered real endpoints
	HttpRequestProxy req;
	req.method = "GET";
	req.path   = "/api/health"; // Health is open
	HttpResponseProxy res;
	router.dispatch(req, res);

	EXPECT_NE(res.status, 404);
}

}} // namespace quickmemes::testing
