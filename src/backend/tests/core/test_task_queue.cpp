/**
 * @file test_task_queue.cpp
 * @brief TaskQueue 模块单元测试
 */

#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"
#include "error_codes.hpp"

#include <fstream>
#include <gtest/gtest.h>

namespace quickmemes { namespace testing {

class TaskQueueTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		tempDir_->createSubDirs("data");

		imagePath1_ = tempDir_->getSubPath("data/meme1.jpg");
		imagePath2_ = tempDir_->getSubPath("test.jpg");
		imagePath3_ = tempDir_->getSubPath("wait.jpg");

		createTestImage(imagePath1_);
		createTestImage(imagePath2_);
		createTestImage(imagePath3_);

		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(2, 5, tempDir_->getSubPath("storage"));
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		Database::get().shutdown();
		tempDir_.reset();
	}

	void createTestImage(const std::string &path) {
		std::ofstream ofs(path, std::ios::binary);
		unsigned char data[] = {0xFF, 0xD8, 0xFF, 0xEE, 0x00, 0x0E, 0x41, 0x64, 0x6F, 0x62,
		                        0x65, 0x00, 0x64, 0x80, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9};
		ofs.write(reinterpret_cast<const char *>(data), sizeof(data));
		ofs.close();
	}

	std::unique_ptr<TestDirectory> tempDir_;
	std::string                    imagePath1_;
	std::string                    imagePath2_;
	std::string                    imagePath3_;
};

TEST_F(TaskQueueTest, SubmitTask_ValidRequest_ReturnsTaskId) {
	ImportRequest req;
	req.inputs             = {imagePath1_};
	req.options.sourceName = "test_source";

	std::string taskId = TaskQueue::get().submitImportTask(req);
	EXPECT_FALSE(taskId.empty());
}

TEST_F(TaskQueueTest, SubmitTask_QueueFull_ThrowsQuotaExceeded) {
	// TaskQueue initialized with max size 5 in SetUp
	ImportRequest req;
	for (int i = 0; i < 5; ++i) {
		req.inputs.push_back(imagePath2_);
	}

	// First 5 should succeed (if currentPending starts at 0)
	TaskQueue::get().submitImportTask(req);

	// The 6th should fail
	ImportRequest req2;
	req2.inputs = {"extra.jpg"};
	EXPECT_THROW(TaskQueue::get().submitImportTask(req2), ApiException);
}

TEST_F(TaskQueueTest, CancelTask_ExistingTask_ReturnsTrue) {
	ImportRequest req;
	req.inputs         = {imagePath3_};
	std::string taskId = TaskQueue::get().submitImportTask(req);

	EXPECT_TRUE(TaskQueue::get().cancelTask(taskId));
}

}} // namespace quickmemes::testing
