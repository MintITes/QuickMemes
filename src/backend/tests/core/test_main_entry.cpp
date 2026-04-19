/**
 * @file test_main_entry.cpp
 * @brief 后端入口 main.cpp 的可测行为
 */

#define g_server g_server_main_test
#define main qm_backend_main
#include "../../src/main.cpp"
#undef main
#undef g_server

#include <csignal>
#include <gtest/gtest.h>

namespace quickmemes::testing {

TEST(BackendMainTest, HandleSignal_RecordsSignalAndStopFlag) {
	g_stopRequested = 0;
	g_lastSignal    = 0;

	handleSignal(SIGINT);

	EXPECT_EQ(g_stopRequested, 1);
	EXPECT_EQ(g_lastSignal, SIGINT);
}

TEST(BackendMainTest, MissingRequiredArgs_ReturnsFailure) {
	char arg0[] = "quickmemes-backend";
	char *argv[] = {arg0};

	EXPECT_EQ(qm_backend_main(1, argv), 1);
}

} // namespace quickmemes::testing
