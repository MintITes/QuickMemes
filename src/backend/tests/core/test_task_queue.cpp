/**
 * @file test_task_queue.cpp
 * @brief TaskQueue 模块单元测试
 */

#include "core/task_queue.hpp"
#include "error_codes.hpp"
#include <gtest/gtest.h>

namespace quickmemes {
namespace testing {

class TaskQueueTest : public ::testing::Test {
protected:
    void SetUp() override {
        // 使用单例初始化，较少的 worker 不阻塞真实进度
        TaskQueue::get().initialize(2, 5); 
    }
    
    void TearDown() override {
        TaskQueue::get().shutdown();
    }
};

TEST_F(TaskQueueTest, SubmitTask_ValidRequest_ReturnsTaskId) {
    // TODO: implement
}

TEST_F(TaskQueueTest, SubmitTask_QueueFull_ThrowsQuotaExceeded) {
    // TODO: implement — 填满队列，期待抛出 ApiException(ERR_QUOTA_EXCEEDED)
}

TEST_F(TaskQueueTest, CancelTask_ExistingTask_ReturnsTrue) {
    // TODO: implement
}

}  // namespace testing
}  // namespace quickmemes
