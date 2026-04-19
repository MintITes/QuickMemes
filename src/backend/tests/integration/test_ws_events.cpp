#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"

#include <atomic>
#include <fstream>
#include <gtest/gtest.h>

namespace quickmemes {
using testing::TestDirectory;

namespace {

void writeMinimalPng(const std::string &path) {
	static constexpr unsigned char kPngData[] = {
	    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
	    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
	    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0xF0,
	    0x1F, 0x00, 0x05, 0x00, 0x01, 0xFF, 0x89, 0x99, 0x3D, 0x1D, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
	    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82};

	std::ofstream ofs(path, std::ios::binary);
	ofs.write(reinterpret_cast<const char *>(kPngData), static_cast<std::streamsize>(sizeof(kPngData)));
}

} // namespace

class WsEventTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(2, 50, tempDir_->getSubPath("storage"));

		imagePath_ = tempDir_->getSubPath("test_ws.png");
		writeMinimalPng(imagePath_);
	}
	void TearDown() override {
		TaskQueue::get().shutdown();
		Database::get().shutdown();
		tempDir_.reset();
	}
	std::unique_ptr<TestDirectory> tempDir_;
	std::string                    imagePath_;
};

TEST_F(WsEventTest, MemeAdded_Event_Broadcast) {
	std::atomic<bool> addedEventReceived{false};
	WsPusher::get().setTestListener([&](const WsEvent &ev) {
		if (ev.event == "meme:added") { addedEventReceived = true; }
	});

	ImportRequest req;
	req.inputs = {imagePath_};
	TaskQueue::get().submitImportTask(req);

	int checks = 0;
	while (!addedEventReceived && checks < 50) {
		std::this_thread::sleep_for(std::chrono::milliseconds(100));
		checks++;
	}

	WsPusher::get().setTestListener(nullptr);
	EXPECT_TRUE(addedEventReceived);
}

TEST_F(WsEventTest, SessionRegistration_Reset_StopsFurtherBroadcasts) {
	std::atomic<int> receivedCount{0};
	auto             subscription = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});

	WsPusher::get().broadcast({"test:event", {{"value", 1}}});
	EXPECT_EQ(receivedCount.load(), 1);

	subscription.reset();
	WsPusher::get().broadcast({"test:event", {{"value", 2}}});
	EXPECT_EQ(receivedCount.load(), 1);
}

TEST_F(WsEventTest, ClearSessions_RemovesAllCallbacks) {
	std::atomic<int> receivedCount{0};
	auto s1 = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});
	auto s2 = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});

	WsPusher::get().clearSessions();
	WsPusher::get().broadcast({"test:event", {{"value", 3}}});
	EXPECT_EQ(receivedCount.load(), 0);

	s1->reset();
	s2->reset();
}

TEST_F(WsEventTest, MultipleSessions_BroadcastsToAll) {
	std::atomic<int> receivedCount{0};
	auto s1 = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});
	auto s2 = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});

	WsPusher::get().broadcast({"test:event", {{"value", 4}}});
	EXPECT_EQ(receivedCount.load(), 2);

	s1->reset();
	s2->reset();
}

TEST_F(WsEventTest, SessionRegistration_ResetIsIdempotent) {
	std::atomic<int> receivedCount{0};
	auto registration = WsPusher::get().addSession([&](std::shared_ptr<std::string> msg) {
		(void)msg;
		receivedCount.fetch_add(1);
	});

	registration->reset();
	registration->reset();
	WsPusher::get().broadcast({"test:event", {{"value", 5}}});
	EXPECT_EQ(receivedCount.load(), 0);
}

} // namespace quickmemes
