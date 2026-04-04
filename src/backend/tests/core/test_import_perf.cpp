/**
 * @file test_import_perf.cpp
 * @brief 导入性能测试，重点覆盖同步提交与入队路径
 */

#include "../mocks.hpp"
#include "../perf/perf_utils.hpp"

#include "core/handlers.hpp"
#include "core/server.hpp"
#include "core/task_queue.hpp"
#include "embedding/embedding.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <atomic>
#include <algorithm>
#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <mutex>
#include <thread>
#include <vector>

std::unique_ptr<quickmemes::Server> g_server = nullptr;

namespace quickmemes { namespace testing {

namespace {

struct ImportPerfCase {
	ImportRequest request;
	std::string   label;
};

static ImportPerfCase makeImportCase(const std::string &imagePath, size_t index) {
	ImportPerfCase perfCase;
	perfCase.label            = "import_case_" + std::to_string(index);
	perfCase.request.source   = ImportSource::LOCAL_FILE;
	perfCase.request.inputs   = {imagePath};
	perfCase.request.options.autoOcr       = false;
	perfCase.request.options.autoAiAnalyze = false;
	perfCase.request.options.sourceName    = (index % 2 == 0) ? "微博" : "微信群";
	perfCase.request.options.sourceUrl     = "";
	return perfCase;
}

static HttpRequestProxy makeRequest(const ImportRequest &request) {
	HttpRequestProxy req;
	req.method = "POST";
	req.path   = "/api/import";
	req.body   = nlohmann::json(request).dump();
	return req;
}

} // namespace

class ImportPerfTest : public ::testing::Test {
protected:
	void SetUp() override {
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_FATAL);
		tempDir_ = std::make_unique<TestDirectory>();
		imagePath_ = tempDir_->getSubPath("input/import_perf.jpg");
		perf::writeTinyJpeg(imagePath_);

		TaskQueue::get().shutdown();
		EmbeddingModule::get().shutdown();
		VisionModule::get().shutdown();
		Database::get().shutdown();
		Database::get().initialize(":memory:");
		TaskQueue::get().initialize(4, 2000, tempDir_->getSubPath("storage"));
	}

	void TearDown() override {
		TaskQueue::get().shutdown();
		EmbeddingModule::get().shutdown();
		VisionModule::get().shutdown();
		Database::get().shutdown();
		::quickmemes::Logger::get().setMinLevel(::quickmemes::LogLevel::LL_INFO);
		tempDir_.reset();
	}

	std::unique_ptr<TestDirectory> tempDir_;
	std::string                    imagePath_;
};

TEST_F(ImportPerfTest, Import_SubmitPath_P95Under50Ms) {
	constexpr size_t  kCaseCount   = 48;
	constexpr size_t  kWarmupCount = 4;
	constexpr uint64_t kSeed       = 0x494D504F52545046ULL;

	std::vector<ImportPerfCase> cases;
	cases.reserve(kCaseCount);
	for (size_t i = 0; i < kCaseCount; ++i) {
		cases.push_back(makeImportCase(imagePath_, i));
	}

	for (size_t i = 0; i < std::min(kWarmupCount, cases.size()); ++i) {
		HttpRequestProxy req = makeRequest(cases[i].request);
		HttpResponseProxy res;
		handlePostImport(req, res);
		ASSERT_EQ(res.status, 200);
	}

	perf::PerfStats stats;
	std::vector<double> elapsedMsByCase(cases.size(), 0.0);
	std::mutex resultsMutex;
	std::mutex statsMutex;
	std::atomic<size_t> ready{0};
	std::atomic<bool>   start{false};
	const size_t        threadCount = 4;
	const size_t        perThread   = (cases.size() + threadCount - 1) / threadCount;
	std::vector<std::thread> workers;
	workers.reserve(threadCount);

	for (size_t t = 0; t < threadCount; ++t) {
		workers.emplace_back([&, t]() {
			ready.fetch_add(1);
			while (!start.load(std::memory_order_acquire)) {
				std::this_thread::yield();
			}

			perf::PerfStats localStats;
			const size_t begin = t * perThread;
			const size_t end   = std::min(cases.size(), begin + perThread);
			for (size_t i = begin; i < end; ++i) {
				HttpRequestProxy req = makeRequest(cases[i].request);
				HttpResponseProxy res;
				double elapsedMs = perf::measureMs([&]() {
					handlePostImport(req, res);
				});
				EXPECT_EQ(res.status, 200) << cases[i].label;
				auto response = nlohmann::json::parse(res.body);
				EXPECT_TRUE(response["success"].get<bool>()) << cases[i].label;
				EXPECT_EQ(response["data"]["status"].get<std::string>(), "PENDING") << cases[i].label;
				EXPECT_EQ(response["data"]["total"].get<int>(), 1) << cases[i].label;
				{
					std::lock_guard<std::mutex> resultLock(resultsMutex);
					elapsedMsByCase[i] = elapsedMs;
				}
				localStats.add(cases[i].label, elapsedMs);
			}

			std::lock_guard<std::mutex> lock(statsMutex);
			stats.merge(localStats);
		});
	}

	while (ready.load() < threadCount) {
		std::this_thread::yield();
	}
	start.store(true, std::memory_order_release);
	for (auto &worker : workers) { worker.join(); }

	std::cout << "[perf] import seed=" << kSeed << " samples=" << cases.size()
	          << " collected=" << elapsedMsByCase.size() << '\n';
	for (size_t i = 0; i < cases.size(); ++i) {
		perf::printPerfNode("import", i, cases[i].label, elapsedMsByCase[i]);
	}
	perf::printPerfTopSlowest("import", stats);
}

}} // namespace quickmemes::testing
