#pragma once

#include <filesystem>
#include <iomanip>
#include <random>
#include <sstream>
#include <string>

namespace quickmemes::testing {

/**
 * @brief RAII class to manage a unique temporary directory for a test.
 */
class TestDirectory {
public:
	TestDirectory() {
		std::random_device              rd;
		std::mt19937                    gen(rd());
		std::uniform_int_distribution<> dis(0, 0xFFFFFF);

		std::stringstream ss;
		ss << "qm_test_" << std::hex << std::setw(6) << std::setfill('0') << dis(gen);

		path_ = std::filesystem::temp_directory_path() / ss.str();
		std::filesystem::create_directories(path_);
	}

	~TestDirectory() {
		try {
			std::filesystem::remove_all(path_);
		} catch (...) {
			// Ignore errors during cleanup
		}
	}

	[[nodiscard]] std::string getPath() const {
		return path_.string();
	}

	[[nodiscard]] std::string getSubPath(const std::string &name) const {
		return (path_ / name).string();
	}

	void createSubDirs(const std::string &relPath) const {
		std::filesystem::create_directories(path_ / relPath);
	}

private:
	std::filesystem::path path_;
};

} // namespace quickmemes::testing
