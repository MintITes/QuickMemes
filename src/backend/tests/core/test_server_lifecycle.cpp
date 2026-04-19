/**
 * @file test_server_lifecycle.cpp
 * @brief Server lifecycle tests.
 */

#include "../test_utils.hpp"
#include "core/server.hpp"
#include "db/database.hpp"
#include "utils/config_parser.hpp"

#include <chrono>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>

#include <memory>
#include <string>

namespace quickmemes::testing {

class ServerLifecycleTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		tempDir_->createSubDirs("storage");
		tempDir_->createSubDirs("db");
		tempDir_->createSubDirs("logs");
	}

	void TearDown() override {
		tempDir_.reset();
	}

	ServerConfig makeConfig() const {
		ServerConfig cfg;
		cfg.bindAddress = "127.0.0.1";
		cfg.port = 0;
		cfg.storagePath = tempDir_->getSubPath("storage");
		cfg.dbPath = tempDir_->getSubPath("db/server.db");
		cfg.logDir = tempDir_->getSubPath("logs");
		cfg.logLevel = "info";
		cfg.workerCount = 1;
		cfg.maxQueueSize = 32;
		cfg.backupEnabled = false;
		cfg.logRetentionEnabled = false;
		return cfg;
	}

	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(ServerLifecycleTest, StartStopWait_Idempotent) {
	Server server;
	auto cfg = makeConfig();

	ASSERT_TRUE(server.start(cfg));
	server.stop();
	server.stop();
	server.waitForStop();
}

class ServerMaintenanceTest : public ::testing::Test {
protected:
	void SetUp() override {
		tempDir_ = std::make_unique<TestDirectory>();
		tempDir_->createSubDirs("db");
		tempDir_->createSubDirs("logs");
		ASSERT_TRUE(Database::get().initialize(tempDir_->getSubPath("db/maintenance.db")));
	}

	void TearDown() override {
		Database::get().shutdown();
		tempDir_.reset();
	}

	void createOldFile(const std::string &path, std::chrono::hours age) {
		std::ofstream ofs(path, std::ios::binary);
		ofs << "backup";
		ofs.close();
		std::filesystem::last_write_time(path, std::filesystem::file_time_type::clock::now() - age);
	}

	std::unique_ptr<TestDirectory> tempDir_;
};

TEST_F(ServerMaintenanceTest, RunMaintenanceTasks_RemovesExpiredBackupFiles) {
	Server server;
	ServerConfig cfg;
	cfg.dbPath                  = tempDir_->getSubPath("db/maintenance.db");
	cfg.logDir                  = tempDir_->getSubPath("logs");
	cfg.logRetentionEnabled     = false;
	cfg.backupEnabled           = true;
	cfg.backupRetentionDays     = 1;
	cfg.recycleBinRetentionDays = 0;
	server.updateConfig(cfg);

	const auto backupPath = tempDir_->getSubPath("db/maintenance.db.bak.20240101");
	createOldFile(backupPath, std::chrono::hours(72));

	server.runMaintenanceTasks();

	EXPECT_FALSE(std::filesystem::exists(backupPath));
}

} // namespace quickmemes::testing
