#include "core/task_queue.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"
#include "core/router.hpp"
#include "core/handlers.hpp"
#include "error_codes.hpp"

#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iostream>
#include "../test_utils.hpp"

namespace quickmemes {

class SecurityTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<testing::TestDirectory>();
		TaskQueue::get().initialize(2, 50, tempDir_->getSubPath("storage"));
		Database::get().initialize(":memory:");
	}
	void TearDown() override {
		TaskQueue::get().shutdown();
		Database::get().shutdown();
		tempDir_.reset();
	}
	std::unique_ptr<testing::TestDirectory> tempDir_;
};

TEST_F(SecurityTest, SSRF_Interception_Localhost) {
	ImportRequest req;
	req.inputs             = {"http://127.0.0.1/test.jpg"};
	req.options.sourceName = "SSRF_TEST";

	std::atomic<bool> eventReceived{false};
	std::string receivedError;
	WsPusher::get().setTestListener([&](const WsEvent &ev) {
		if (ev.event == "task:error") {
			receivedError = ev.payload["error"];
			eventReceived = true;
		}
	});

	std::string taskId = TaskQueue::get().submitImportTask(req);

	// Wait for task or event
	int checks = 0;
	while (!eventReceived && checks < 50) {
		std::this_thread::sleep_for(std::chrono::milliseconds(100));
		checks++;
	}

	WsPusher::get().setTestListener(nullptr);

	EXPECT_TRUE(eventReceived);
	EXPECT_TRUE(receivedError.find("Failed to download image from URL") != std::string::npos);
}

TEST_F(SecurityTest, Export_PathTraversal_Blocked) {
	// Test exporting to a restricted directory
	HttpRequestProxy req;
	req.method = "POST";
	req.path   = "/api/export";
	ExportRequest exportReq;
	exportReq.memeIds = {1};
	exportReq.destDir = "/etc"; // Restricted
	req.body          = nlohmann::json(exportReq).dump();

	HttpResponseProxy res;
	handlePostExport(req, res);

	EXPECT_EQ(res.status, 403);
	EXPECT_TRUE(res.body.find("Export only allowed within home directory") != std::string::npos);

	// Test with path traversal that resolves to a restricted dir
	exportReq.destDir = "/tmp/../../etc";
	req.body          = nlohmann::json(exportReq).dump();
	handlePostExport(req, res);

	EXPECT_EQ(res.status, 403);
}

} // namespace quickmemes
