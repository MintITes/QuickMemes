#include "../test_utils.hpp"
#include "core/task_queue.hpp"
#include "db/database.hpp"

#include <atomic>
#include <gtest/gtest.h>
#include <thread>
#include <vector>

namespace quickmemes {

class ConcurrencyRaceTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<testing::TestDirectory>();
		Database::get().initialize(tempDir_->getSubPath("test_race.db"));
	}
	void TearDown() override {
		Database::get().shutdown();
		tempDir_.reset();
	}
	std::unique_ptr<testing::TestDirectory> tempDir_;
};

TEST_F(ConcurrencyRaceTest, Import_vs_Rebuild_Race) {
	std::atomic<bool> start{false};
	std::atomic<int>  completed{0};

	// Thread 1: Keep inserting memes
	std::thread t1([&]() {
		while (!start)
			std::this_thread::yield();
		for (int i = 0; i < 100; ++i) {
			MemeEntry meme;
			meme.fileHash = "hash_" + std::to_string(i);
			meme.filePath = "path_" + std::to_string(i);
			meme.mimeType = "image/jpeg";
			try {
				Database::get().insertMeme(meme);
			} catch (...) {}
		}
		completed++;
	});

	// Thread 2: Keep rebuilding vector table
	std::thread t2([&]() {
		while (!start)
			std::this_thread::yield();
		for (int i = 0; i < 10; ++i) {
			try {
				Database::get().rebuildEmbeddingTables(512);
			} catch (...) {}
		}
		completed++;
	});

	// Thread 3: Keep upserting embeddings
	std::thread t3([&]() {
		while (!start)
			std::this_thread::yield();
		for (int i = 0; i < 100; ++i) {
			try {
				std::vector<float> vec(512, 1.0f);
				Database::get().upsertDescriptionEmbedding(i + 1, vec);
				Database::get().upsertOcrEmbedding(i + 1, vec);
			} catch (...) {}
		}
		completed++;
	});

	start = true;
	t1.join();
	t2.join();
	t3.join();

	EXPECT_EQ(completed, 3);
}

} // namespace quickmemes
