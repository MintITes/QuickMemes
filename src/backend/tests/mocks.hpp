#pragma once
/**
 * @file mocks.hpp
 * @brief QA 测试骨架全局 Mock 和 Fixture 声明
 *
 * 严格按照 backend-testing.md「测试环境准备」要求实现。
 */

#include "db/database.hpp"
#include "test_utils.hpp"
#include "vision/http_client.hpp"

#include <gmock/gmock.h>
#include <gtest/gtest.h>

namespace quickmemes {
class Server;
}
extern std::unique_ptr<quickmemes::Server> g_server;

namespace quickmemes { namespace testing {

/**
 * @brief Mock HTTP 客户端，供 Vision 模块测试使用
 *
 * 通过依赖注入替代 Boost.Beast，断开外部网络依赖。
 */
class MockHttpClient : public HttpClientInterface {
public:
	MOCK_METHOD(std::string, post, (const std::string &, const std::string &, const std::string &, int), (override));
	MOCK_METHOD(std::string, get, (const std::string &, const std::string &, int), (override));
};

/**
 * @brief Meme 数据库集成测试环境基类
 *
 * 在内存模式 (`:memory:`) 中初始化 SQLite，测试间互相隔离。
 */
class MemeDbTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		db       = &Database::get();
		ASSERT_TRUE(db->initialize(":memory:")); // 使用内存数据库
	}

	void TearDown() override {
		db->shutdown();
		tempDir_.reset();
	}

	std::string getSubPath(const std::string &name) const {
		return tempDir_->getSubPath(name);
	}

	Database                      *db;
	std::unique_ptr<TestDirectory> tempDir_;
};

}} // namespace quickmemes::testing
