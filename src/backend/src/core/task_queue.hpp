#pragma once
#include "api_types.hpp"

#include <memory>
#include <string>

namespace quickmemes {

class TaskQueueImpl;
struct TaskState;

class TaskQueue {
public:
	static TaskQueue &get();

	void initialize(int workerCount, int maxQueueSize, const std::string &storagePath);
	void shutdown();

	std::string        submitImportTask(const ImportRequest &request);
	std::string        submitRebuildTask();
	std::string        submitThumbnailTask(int64_t memeId);
	bool               cancelTask(const std::string &taskId);
	ImportTask         getTask(const std::string &taskId);
	const std::string &getStoragePath() const;

	TaskQueue(const TaskQueue &)            = delete;
	TaskQueue &operator=(const TaskQueue &) = delete;

private:
	TaskQueue();
	~TaskQueue();

	void runProcessingPipeline(ImportPipeline pipeline, std::shared_ptr<TaskState> state);
	void markItemDone(std::shared_ptr<TaskState> state,
	                  const std::string         &taskId,
	                  bool                       success  = true,
	                  const std::string         &errorMsg = "");

	std::unique_ptr<TaskQueueImpl> impl_;
};

} // namespace quickmemes
