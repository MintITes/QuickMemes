/**
 * @file test_task_queue.cpp
 * @brief TaskQueue 模块单元测试
 */

#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"
#include "error_codes.hpp"

#include <chrono>
#include <fstream>
#include <gtest/gtest.h>
#include <thread>
#include <vector>

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
		createSlowInput(imagePath2_);
		createTestImage(imagePath3_);

		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(2, 1, tempDir_->getSubPath("storage"));
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

	void createSlowInput(const std::string &path) {
		std::ofstream ofs(path, std::ios::binary);
		std::vector<char> chunk(1024 * 1024, '\0');
		for (int i = 0; i < 64; ++i) {
			ofs.write(chunk.data(), static_cast<std::streamsize>(chunk.size()));
		}
	}

	bool waitForProcessing(const std::string &taskId) {
		for (int i = 0; i < 100; ++i) {
			auto task = TaskQueue::get().getTask(taskId);
			if (task.status == TaskStatus::PROCESSING) { return true; }
			if (task.status == TaskStatus::DONE || task.status == TaskStatus::FAILED || task.status == TaskStatus::CANCELLED) {
				return false;
			}
			std::this_thread::sleep_for(std::chrono::milliseconds(5));
		}
		return false;
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
	// Use a blocking input so the first task keeps the only pending slot occupied
	// long enough for the quota check to run deterministically in CI.
	ImportRequest req;
	req.inputs = {imagePath2_};

	TaskQueue::get().submitImportTask(req);

	ImportRequest req2;
	req2.inputs = {"extra.jpg"};
	EXPECT_THROW(TaskQueue::get().submitImportTask(req2), ApiException);
}

TEST_F(TaskQueueTest, SubmitTask_EmptyInputs_ThrowsInvalidParams) {
	ImportRequest req;
	EXPECT_THROW(TaskQueue::get().submitImportTask(req), ApiException);
}

TEST_F(TaskQueueTest, SubmitTask_BatchTooLarge_DoesNotPoisonQueueState) {
	ImportRequest oversized;
	for (int i = 0; i < 6; ++i) {
		oversized.inputs.push_back(imagePath1_);
	}
	EXPECT_THROW(TaskQueue::get().submitImportTask(oversized), ApiException);

	ImportRequest valid;
	valid.inputs = {imagePath1_};
	EXPECT_NO_THROW({
		auto taskId = TaskQueue::get().submitImportTask(valid);
		EXPECT_FALSE(taskId.empty());
	});
}

TEST_F(TaskQueueTest, CancelTask_ExistingTask_ReturnsTrue) {
	ImportRequest req;
	// Use the slower input so the task stays active long enough across platforms.
	req.inputs         = {imagePath2_};
	std::string taskId = TaskQueue::get().submitImportTask(req);

	EXPECT_TRUE(waitForProcessing(taskId));
	EXPECT_TRUE(TaskQueue::get().cancelTask(taskId));
}

}} // namespace quickmemes::testing
