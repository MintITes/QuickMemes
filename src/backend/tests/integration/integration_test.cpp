#include "../mocks.hpp"
#include "core/router.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"

#include <chrono>
#include <gtest/gtest.h>
#include <thread>

namespace quickmemes { namespace testing {

class IntegrationTest : public MemeDbTest {
protected:
	void SetUp() override {
		MemeDbTest::SetUp();
	}

	void TearDown() override {
		MemeDbTest::TearDown();
	}
};

TEST_F(IntegrationTest, FullFlow_HandledRequest_TriggersWs) {
	// 1. Setup mock session in WsPusher
	std::string receivedPayload;
	auto        mockCb = [&](std::shared_ptr<std::string> msg) {
        receivedPayload = *msg;
	};
	WsSendCallback cb = mockCb;
	WsPusher::get().addSession(&cb);

	// 2. Setup Router
	Router router;

	// 3. Prepare Request
	HttpRequestProxy req;
	req.method = "POST";
	req.path   = "/api/tags";
	req.body   = R"({"name": "IPC_Tag", "color": "#112233"})";
	HttpResponseProxy res;

	// 4. Dispatch
	router.dispatch(req, res);

	// 5. Verifications
	EXPECT_EQ(res.status, 201);

	// Check DB
	auto tags    = db->getTags();
	bool dbFound = false;
	for (const auto &t : tags) {
		if (t.name == "IPC_Tag") dbFound = true;
	}
	EXPECT_TRUE(dbFound);

	// Check WS
	EXPECT_FALSE(receivedPayload.empty());
	auto j = nlohmann::json::parse(receivedPayload);
	EXPECT_EQ(j["event"], "tag:created");
	EXPECT_EQ(j["data"]["name"], "IPC_Tag");

	// Cleanup
	WsPusher::get().removeSession(&cb);
}

}} // namespace quickmemes::testing
