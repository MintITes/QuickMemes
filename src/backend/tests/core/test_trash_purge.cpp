#include "../mocks.hpp"
#include "core/handlers.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <gtest/gtest.h>
#include <nlohmann/json.hpp>

namespace quickmemes {
namespace testing {

class TrashPurgeTest : public MemeDbTest {};

TEST_F(TrashPurgeTest, PurgeTrash_SpecificDays_Success) {
	// 1. Setup Data
	MemeEntry m1;
	m1.fileHash = "h1";
	m1.filePath = "p1";
	int64_t mid = db->insertMeme(m1);
	db->softDeleteMeme(mid);
	// 强制把 deleted_at 改小一点，确保在阈值内
	db->getRawDatabase()->exec("UPDATE memes SET deleted_at = 1 WHERE id = " + std::to_string(mid));

	// 2. Request Purge
	HttpRequestProxy req;
	req.path   = "/api/memes/trash/purge";
	req.method = "DELETE";
	req.query  = "olderThanDays=0";
	HttpResponseProxy res;

	handleDeleteTrashPurge(req, res);

	// 3. Verify
	EXPECT_EQ(res.status, 200);
	auto j = nlohmann::json::parse(res.body);
	EXPECT_EQ(j["data"]["purged"].get<int>(), 1);
}

TEST_F(TrashPurgeTest, PurgeTrash_Empty_ReturnsZero) {
	HttpRequestProxy req;
	req.path   = "/api/memes/trash/purge";
	req.method = "DELETE";
	req.query  = "olderThanDays=30";
	HttpResponseProxy res;

	handleDeleteTrashPurge(req, res);

	EXPECT_EQ(res.status, 200);
	auto j = nlohmann::json::parse(res.body);
	EXPECT_EQ(j["data"]["purged"].get<int>(), 0);
}

} // namespace testing
} // namespace quickmemes
