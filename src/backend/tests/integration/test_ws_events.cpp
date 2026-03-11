#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"

#include <atomic>
#include <fstream>
#include <gtest/gtest.h>

namespace quickmemes {
using testing::TestDirectory;

class WsEventTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(2, 50, tempDir_->getSubPath("storage"));

		imagePath_ = tempDir_->getSubPath("test_ws.jpg");
		std::ofstream ofs(imagePath_, std::ios::binary);
		unsigned char data[] = {0xFF, 0xD8, 0xFF, 0xD9};
		ofs.write(reinterpret_cast<const char *>(data), 4);
		ofs.close();
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

} // namespace quickmemes
