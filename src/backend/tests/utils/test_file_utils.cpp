/**
 * @file test_file_utils.cpp
 * @brief 文件工具函数测试
 */

#include "error_codes.hpp"
#include "utils/file_utils.hpp"

#include <gtest/gtest.h>

#include <chrono>
#include <filesystem>
#include <fstream>
#include <string>

namespace quickmemes { namespace testing {

namespace {

class TempDirGuard {
public:
	TempDirGuard() {
		const auto nonce = std::chrono::steady_clock::now().time_since_epoch().count();
		path_            = std::filesystem::temp_directory_path() /
		                   std::filesystem::path("quickmemes-file-utils-test-" + std::to_string(nonce));
		std::filesystem::remove_all(path_);
		std::filesystem::create_directories(path_);
	}

	~TempDirGuard() {
		std::error_code ec;
		std::filesystem::remove_all(path_, ec);
	}

	[[nodiscard]] const std::filesystem::path &path() const {
		return path_;
	}

private:
	std::filesystem::path path_;
};

void writeMinimalPng(const std::filesystem::path &path) {
	static constexpr unsigned char kPngData[] = {
	    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
	    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
	    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0xF0,
	    0x1F, 0x00, 0x05, 0x00, 0x01, 0xFF, 0x89, 0x99, 0x3D, 0x1D, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
	    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82};

	std::ofstream out(path, std::ios::binary);
	ASSERT_TRUE(out.is_open());
	out.write(reinterpret_cast<const char *>(kPngData), static_cast<std::streamsize>(sizeof(kPngData)));
	ASSERT_TRUE(out.good());
}

} // namespace

TEST(FileUtilsTest, ComputeHash_MissingFile_ThrowsIoError) {
	EXPECT_THROW(
	    {
		    try {
			    (void)computeHash("/definitely/not/exist.bin");
		    } catch (const ApiException &e) {
			    EXPECT_EQ(e.code(), ERR_IO);
			    throw;
		    }
	    },
	    ApiException);
}

TEST(FileUtilsTest, GenerateThumbnail_InvalidMaxSize_ReturnsFalse) {
	TempDirGuard guard;
	auto         src  = guard.path() / "input.png";
	auto         dest = guard.path() / "thumbs" / "thumb.jpg";
	writeMinimalPng(src);

	EXPECT_FALSE(generateThumbnail(src.string(), dest.string(), 0));
	EXPECT_FALSE(std::filesystem::exists(dest));
}

TEST(FileUtilsTest, GenerateThumbnail_ValidImage_CreatesFile) {
	TempDirGuard guard;
	auto         src  = guard.path() / "input.png";
	auto         dest = guard.path() / "thumbs" / "thumb.jpg";
	writeMinimalPng(src);

	EXPECT_TRUE(generateThumbnail(src.string(), dest.string(), 32));
	EXPECT_TRUE(std::filesystem::exists(dest));
	EXPECT_GT(std::filesystem::file_size(dest), 0);
}

TEST(FileUtilsTest, ReadImageSize_InvalidPath_ReturnsNullopt) {
	auto size = readImageSize("/definitely/not/exist.png");
	EXPECT_FALSE(size.has_value());
}

TEST(FileUtilsTest, ReadImageSize_ValidPng_ReturnsSize) {
	TempDirGuard guard;
	auto         src = guard.path() / "input.png";
	writeMinimalPng(src);

	auto size = readImageSize(src.string());
	ASSERT_TRUE(size.has_value());
	EXPECT_EQ(size->width, 1);
	EXPECT_EQ(size->height, 1);
}

}} // namespace quickmemes::testing
