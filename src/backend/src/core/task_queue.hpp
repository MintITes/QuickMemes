#pragma once
/**
 * @file task_queue.hpp
 * @brief 后台任务队列与线程池管理
 *
 * 管理耗时的导入(Import)和处理(OCR/AI/Embedding)管线。
 */

#include "api_types.hpp"
#include <memory>
#include <string>

namespace quickmemes {

class TaskQueueImpl;

/**
 * @brief 任务队列单例管理器
 *
 * 初始化时创建固定大小的线程池，接受 ImportRequest 拆分为独立文件处理管线。
 */
class TaskQueue {
public:
    /**
     * @brief 获取 TaskQueue 单例实例
     * @return TaskQueue& 单例引用
     */
    static TaskQueue& get();

    /**
     * @brief 初始化线程池
     * @param workerCount int 工作线程数
     * @param maxQueueSize int 最大等待队列长度
     */
    void initialize(int workerCount, int maxQueueSize);

    /**
     * @brief 关闭线程池
     *
     * 拒绝新任务，等待（或取消）执行中任务，回收线程。
     */
    void shutdown();

    /**
     * @brief 提交导入任务流水线
     *
     * 生成任务 ID 并立即返回。后台线程负责并行拉取/解析每个输入项，
     * 最终通过 WebSocket 推送进度的改变。
     *
     * @param request ImportRequest 包含来源和目标列表
     * @return std::string 任务的 UUID 标识
     * @throws ApiException(ERR_QUOTA_EXCEEDED) 队列已满时
     */
    std::string submitImportTask(const ImportRequest& request);

    /**
     * @brief 取消进行中的导入任务
     *
     * @param taskId std::string 任务的 UUID
     * @return bool 成功取消（或部分取消）返回 true
     */
    bool cancelTask(const std::string& taskId);

    // 禁止拷贝和移动
    TaskQueue(const TaskQueue&) = delete;
    TaskQueue& operator=(const TaskQueue&) = delete;

private:
    TaskQueue();
    ~TaskQueue();

    /**
     * @brief 执行单文件完整的处理流水线（内部工作函数）
     *
     * 下载 -> 哈希 -> 复制 -> OCR -> AI -> Embedding -> 数据库
     * 成功或失败均触发 WebSocket 增量通知。
     *
     * @param pipeline ImportPipeline 单个文件的流水线上下文
     */
    void runProcessingPipeline(ImportPipeline pipeline);

    std::unique_ptr<TaskQueueImpl> impl_;  ///< Pimpl 隐藏 asio::thread_pool 等细节
};

}  // namespace quickmemes
