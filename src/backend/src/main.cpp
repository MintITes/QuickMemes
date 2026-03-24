/**
 * @file main.cpp
 * @brief QuickMemes C++ 后端入口点
 */

#include "core/server.hpp"
#include "utils/config_parser.hpp"
#include "utils/logger.hpp"

#include <chrono>
#include <csignal>
#include <iostream>
#include <memory>
#include <thread>

// 全局指针，用于信号处理
std::unique_ptr<quickmemes::Server> g_server = nullptr;
namespace {
volatile std::sig_atomic_t g_stopRequested = 0;
volatile std::sig_atomic_t g_lastSignal    = 0;
}

/**
 * @brief 捕获中断信号优雅停机
 */
void handleSignal(int sig) {
	g_lastSignal    = sig;
	g_stopRequested = 1;
}

/**
 * @brief 主函数
 *
 * 1. 解析参数
 * 2. 初始 Logger
 * 3. 注册信号
 * 4. 启动服务器并阻塞
 *
 * @param argc 参数个数
 * @param argv 参数数组
 * @return 退出码
 */
int main(int argc, char *argv[]) {
	try {
		auto config = quickmemes::parseArgs(argc, argv);

		quickmemes::Logger::get().initialize(config.logDir,
		                                     quickmemes::logLevelFromString(config.logLevel),
		                                     config.logRetentionEnabled,
		                                     config.logRetentionDays);

		LOG_INFO("main", "Starting QuickMemes Backend...");

		std::signal(SIGINT, handleSignal);
		std::signal(SIGTERM, handleSignal);

		g_server = std::make_unique<quickmemes::Server>();
		if (!g_server->start(config)) {
			LOG_ERROR("main", "Failed to start server");
			return 1;
		}

		while (!g_stopRequested) {
			std::this_thread::sleep_for(std::chrono::milliseconds(100));
		}

		LOG_INFO("main", "Caught signal " + std::to_string(static_cast<int>(g_lastSignal)) + ", stopping server.");
		g_server->stop();
		g_server->waitForStop();

	} catch (const std::exception &e) {
		std::cerr << "Fatal Error: " << e.what() << std::endl;
		return 1;
	}

	return 0;
}
