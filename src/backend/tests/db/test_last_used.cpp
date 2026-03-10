/**
 * @file test_last_used.cpp
 * @brief 测试 Meme 的 "最后使用时间" 功能
 */

#include "../mocks.hpp"
#include "utils/logger.hpp"

#include <chrono>
#include <thread>

namespace quickmemes {
namespace testing {

class LastUsedTest : public MemeDbTest {
protected:
	MemeEntry createTestMeme(const std::string &hash) {
		MemeEntry meme;
		meme.fileHash = hash;
		meme.filePath = getSubPath(hash + ".png");
		meme.mimeType = "image/png";
		meme.fileSize = 1024;
		meme.width    = 100;
		meme.height   = 100;
		meme.createdAt =
		    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
		        .count();
		return meme;
	}
};

TEST_F(LastUsedTest, UpdateMemeLastUsed_InitialIsZero_UpdatedIsNow) {
	MemeEntry meme = createTestMeme("lastused1");
	int64_t id     = db->insertMeme(meme);

	// Initial lastUsedAt should be 0
	MemeEntry loaded = db->getMeme(id);
	EXPECT_EQ(loaded.lastUsedAt, 0);

	// Update last used time
	bool ok = db->updateMemeLastUsed(id);
	EXPECT_TRUE(ok);

	// Verify updated time
	MemeEntry updated = db->getMeme(id);
	EXPECT_GT(updated.lastUsedAt, 0);
	EXPECT_GE(updated.lastUsedAt, meme.createdAt);
}

TEST_F(LastUsedTest, SortByLastUsed_ReturnsCorrectOrder) {
	// Insert 3 memes
	int64_t id1 = db->insertMeme(createTestMeme("hash1"));
	int64_t id2 = db->insertMeme(createTestMeme("hash2"));
	int64_t id3 = db->insertMeme(createTestMeme("hash3"));

	// Update last used in specific order: id2, id1, id3 (latest)
	db->updateMemeLastUsed(id2);
	std::this_thread::sleep_for(std::chrono::milliseconds(10));
	db->updateMemeLastUsed(id1);
	std::this_thread::sleep_for(std::chrono::milliseconds(10));
	db->updateMemeLastUsed(id3);

	// Search sorted by lastUsedAt DESC (default)
	SearchQuery query;
	query.sortBy    = "lastUsedAt";
	query.sortOrder = "DESC";

	auto resultsDesc = db->searchMemes(query);
	ASSERT_EQ(resultsDesc.items.size(), 3);
	EXPECT_EQ(resultsDesc.items[0].id, id3);
	EXPECT_EQ(resultsDesc.items[1].id, id1);
	EXPECT_EQ(resultsDesc.items[2].id, id2);

	// Search sorted by lastUsedAt ASC
	query.sortOrder = "ASC";
	auto resultsAsc = db->searchMemes(query);
	ASSERT_EQ(resultsAsc.items.size(), 3);
	EXPECT_EQ(resultsAsc.items[0].id, id2);
	EXPECT_EQ(resultsAsc.items[1].id, id1);
	EXPECT_EQ(resultsAsc.items[2].id, id3);
}

} // namespace testing
} // namespace quickmemes
