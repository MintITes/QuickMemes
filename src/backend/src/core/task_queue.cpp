/**
 * @file task_queue.cpp
 * @brief 后台任务队列占位实现
 */

#include "core/task_queue.hpp"
#include "utils/logger.hpp"

namespace quickmemes {

class TaskQueueImpl {};

TaskQueue::TaskQueue() = default;
TaskQueue::~TaskQueue() = default;

TaskQueue& TaskQueue::get() {
    static TaskQueue instance;
    return instance;
}

void TaskQueue::initialize(int workerCount, int maxQueueSize) {
    // TODO: implement — 启动 Boost::Asio 线程池
    (void)workerCount;
    (void)maxQueueSize;
    LOG_INFO("queue", "TaskQueue::initialize() — TODO: implement");
}

void TaskQueue::shutdown() {
    // TODO: implement — 停止线程池接单、join 等待
    LOG_INFO("queue", "TaskQueue::shutdown() — TODO: implement");
}

std::string TaskQueue::submitImportTask(const ImportRequest& request) {
    // TODO: implement — 生成 UUID，拆解 inputs 为独立 pipeline 闭包压入线程池
    // TODO: implement — 检测队列满则抛出异常
    (void)request;
    LOG_INFO("queue", "TaskQueue::submitImportTask() — TODO: implement");
    return "mock-task-id-001";
}

bool TaskQueue::cancelTask(const std::string& taskId) {
    // TODO: implement — 从等待队列移除或标记进行中状态为退出
    (void)taskId;
    LOG_INFO("queue", "TaskQueue::cancelTask() — TODO: implement");
    return true;
}

void TaskQueue::runProcessingPipeline(ImportPipeline pipeline) {
    // TODO: implement — 执行单文件下载/OCR/AI/入库流水线
    (void)pipeline;
}

}  // namespace quickmemes
