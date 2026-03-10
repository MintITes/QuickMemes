/**
 * @file test_task_queue_stress.cpp
 * @brief TaskQueue 压力与并发测试
 */

#include "core/task_queue.hpp"
#include "db/database.hpp"
#include "vision/vision.hpp"
#include "../test_utils.hpp"

#include <atomic>
#include <gtest/gtest.h>
#include <thread>
#include <vector>

namespace quickmemes {
namespace testing {

class TaskQueueStressTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(4, 100, tempDir_->getSubPath("storage"));
	}
	void TearDown() override {
		TaskQueue::get().shutdown();
		Database::get().shutdown();
		tempDir_.reset();
	}
	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(TaskQueueStressTest, ConcurrentSubmissions_Stability) {
	const int numThreads     = 10;
	const int tasksPerThread = 20;
	std::atomic<int> submitted{0};

	std::vector<std::thread> workers;
	for (int i = 0; i < numThreads; ++i) {
		workers.emplace_back([&]() {
			for (int j = 0; j < tasksPerThread; ++j) {
				ImportRequest req;
				req.inputs = {"/dev/null"}; // Dummy path
				try {
					TaskQueue::get().submitImportTask(req);
					submitted++;
				} catch (...) {
				}
			}
		});
	}

	for (auto &t : workers)
		t.join();
	EXPECT_GT(submitted, 0);
}

TEST_F(TaskQueueStressTest, ConcurrentCancel_NoCrash) {
	ImportRequest req;
	for (int i = 0; i < 50; ++i)
		req.inputs.push_back("/dev/null");

	std::string taskId = TaskQueue::get().submitImportTask(req);

	std::thread canceler([&]() {
		std::this_thread::sleep_for(std::chrono::milliseconds(5));
		TaskQueue::get().cancelTask(taskId);
	});

	canceler.join();
	// Verification is primarily that it doesn't crash
	auto task = TaskQueue::get().getTask(taskId);
	EXPECT_TRUE(task.status == TaskStatus::CANCELLED || task.status == TaskStatus::PROCESSING ||
	            task.status == TaskStatus::DONE || task.status == TaskStatus::FAILED);
}

} // namespace testing
} // namespace quickmemes
