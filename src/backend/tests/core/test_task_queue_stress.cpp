/**
 * @file test_task_queue_stress.cpp
 * @brief TaskQueue 压力与并发测试
 */

#include "../perf/perf_utils.hpp"
#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"
#include "vision/vision.hpp"

#include <atomic>
#include <chrono>
#include <gtest/gtest.h>
#include <mutex>
#include <thread>
#include <vector>

namespace quickmemes { namespace testing {

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
	const int        numThreads     = 10;
	const int        tasksPerThread = 20;
	std::atomic<int> submitted{0};
	perf::PerfStats  stats;
	std::mutex       statsMutex;

	std::vector<std::thread> workers;
	for (int i = 0; i < numThreads; ++i) {
		workers.emplace_back([&, threadIndex = i]() {
			perf::PerfStats localStats;
			for (int j = 0; j < tasksPerThread; ++j) {
				ImportRequest req;
				req.inputs = {"/dev/null"}; // Dummy path
				try {
					double elapsedMs = perf::measureMs([&]() {
						TaskQueue::get().submitImportTask(req);
					});
					localStats.add("submit:t" + std::to_string(threadIndex) + "#" + std::to_string(j), elapsedMs);
					submitted++;
				} catch (...) {}
			}

			std::lock_guard<std::mutex> lock(statsMutex);
			stats.merge(localStats);
		});
	}

	for (auto &t : workers)
		t.join();
	EXPECT_GT(submitted, 0);
	stats.print("task_queue_submit", 0, stats.samplesMs.size());
}

TEST_F(TaskQueueStressTest, ConcurrentCancel_NoCrash) {
	const int  taskCount     = 40;
	const int  cancelThreads = 4;
	perf::PerfStats stats;
	std::mutex      statsMutex;

	std::vector<std::string> taskIds;
	taskIds.reserve(taskCount);
	ImportRequest req;
	req.inputs = {"/dev/null"};
	for (int i = 0; i < taskCount; ++i) {
		taskIds.push_back(TaskQueue::get().submitImportTask(req));
	}

	std::atomic<size_t> next{0};
	std::vector<std::thread> cancelers;
	cancelers.reserve(cancelThreads);
	for (int i = 0; i < cancelThreads; ++i) {
		cancelers.emplace_back([&, cancelIndex = i]() {
			perf::PerfStats localStats;
			while (true) {
				size_t index = next.fetch_add(1);
				if (index >= taskIds.size()) { break; }
				try {
					double elapsedMs = perf::measureMs([&]() {
						TaskQueue::get().cancelTask(taskIds[index]);
					});
					localStats.add("cancel:w" + std::to_string(cancelIndex) + "#" + std::to_string(index), elapsedMs);
				} catch (...) {}
			}
			std::lock_guard<std::mutex> lock(statsMutex);
			stats.merge(localStats);
		});
	}

	for (auto &canceler : cancelers) {
		canceler.join();
	}

	stats.print("task_queue_cancel", 0, stats.samplesMs.size());

	for (const auto &taskId : taskIds) {
		auto task = TaskQueue::get().getTask(taskId);
		EXPECT_TRUE(task.status == TaskStatus::CANCELLED || task.status == TaskStatus::PROCESSING ||
		            task.status == TaskStatus::DONE || task.status == TaskStatus::FAILED);
	}
}

}} // namespace quickmemes::testing
