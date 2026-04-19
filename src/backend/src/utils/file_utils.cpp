/**
 * @file file_utils.cpp
 * @brief 文件工具函数实现
 */

#include "utils/file_utils.hpp"

#include "error_codes.hpp"
#include "utils/logger.hpp"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <memory>
#include <openssl/evp.h>
#include <stb_image.h>
#include <stb_image_resize2.h>
#include <stb_image_write.h>
#include <vector>

namespace quickmemes {

std::string computeHash(const std::string &filePath) {
	std::ifstream file(filePath, std::ios::binary);
	if (!file.is_open()) { throw ApiException(ERR_IO, "Failed to open file for hashing: " + filePath); }

	using EvpCtxPtr = std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)>;
	EvpCtxPtr ctx(EVP_MD_CTX_new(), &EVP_MD_CTX_free);
	if (ctx == nullptr) { throw ApiException(ERR_INTERNAL, "Failed to create EVP_MD_CTX"); }

	if (EVP_DigestInit_ex(ctx.get(), EVP_sha256(), nullptr) != 1) {
		throw ApiException(ERR_INTERNAL, "Failed to init SHA256 digest");
	}

	// 增加缓冲区至 64KB，减少 read 系统调用次数
	constexpr size_t BUF_SIZE = 65536;
	char             buffer[BUF_SIZE];

	// 统一读取逻辑，消除冗余的 EOF 额外处理分支
	while (file) {
		file.read(buffer, BUF_SIZE);
		std::streamsize bytesRead = file.gcount();
		if (bytesRead > 0) {
			if (EVP_DigestUpdate(ctx.get(), buffer, static_cast<size_t>(bytesRead)) != 1) {
				throw ApiException(ERR_INTERNAL, "Failed to update SHA256 digest");
			}
		}
	}

	if (file.bad()) { throw ApiException(ERR_IO, "Failed to read file for hashing: " + filePath); }

	unsigned char hash[EVP_MAX_MD_SIZE];
	unsigned int  lengthOfHash = 0;

	if (EVP_DigestFinal_ex(ctx.get(), hash, &lengthOfHash) != 1) {
		throw ApiException(ERR_INTERNAL, "Failed to finalize SHA256 digest");
	}

	// 直接预分配固定长度字符串，避免动态扩容与虚函数开销
	std::string    result(lengthOfHash * 2, '0');
	constexpr char hexChars[] = "0123456789abcdef";
	for (unsigned int i = 0; i < lengthOfHash; ++i) {
		result[i * 2]     = hexChars[(hash[i] >> 4) & 0x0F];
		result[i * 2 + 1] = hexChars[hash[i] & 0x0F];
	}
	return result;
}

std::string detectMimeType(const std::string &filePath) {
	std::ifstream file(filePath, std::ios::binary);
	if (!file.is_open()) { return "application/octet-stream"; }

	unsigned char header[16]; // 移除多余的零初始化，紧接着由 read() 覆盖
	file.read(reinterpret_cast<char *>(header), sizeof(header));
	const std::streamsize bytesRead = file.gcount();

	// PNG: 89 50 4E 47
	if (bytesRead >= 4 && std::memcmp(header, "\x89\x50\x4E\x47", 4) == 0) { return "image/png"; }

	// JPEG: FF D8 FF
	if (bytesRead >= 3 && std::memcmp(header, "\xFF\xD8\xFF", 3) == 0) { return "image/jpeg"; }

	// GIF: 47 49 46 38 ("GIF8")
	if (bytesRead >= 4 && std::memcmp(header, "GIF8", 4) == 0) { return "image/gif"; }

	// WebP: RIFF....WEBP
	if (bytesRead >= 12 && std::memcmp(header, "RIFF", 4) == 0 &&
	    std::memcmp(header + 8, "WEBP", 4) == 0) {
		return "image/webp";
	}

	// AVIF: ....ftyp（偏移 4 处）
	if (bytesRead >= 8 && std::memcmp(header + 4, "ftyp", 4) == 0) { return "image/avif"; }

	return "application/octet-stream";
}

std::optional<ImageSize> readImageSize(const std::string &filePath) {
	ImageSize size;
	int       channels = 0;
	// stbi_info 仅读取头部元数据，不完整解码图像
	if (!stbi_info(filePath.c_str(), &size.width, &size.height, &channels)) {
		LOG_WARN("file_util", "Failed to read image size: " + filePath);
		return std::nullopt;
	}
	if (size.width <= 0 || size.height <= 0) {
		LOG_WARN("file_util", "Invalid image size metadata: " + filePath);
		return std::nullopt;
	}
	return size;
}

bool generateThumbnail(const std::string &srcPath, const std::string &destPath, int maxSize) {
	if (maxSize <= 0) {
		LOG_WARN("file_util", "Invalid thumbnail maxSize: " + std::to_string(maxSize));
		return false;
	}

	int            width = 0, height = 0, channels = 0;
	// 强制请求 4 通道 (RGBA) 以匹配 stbir_resize_uint8_linear 的安全枚举
	unsigned char *data = stbi_load(srcPath.c_str(), &width, &height, &channels, 4);
	if (!data) {
		LOG_WARN("file_util", "Failed to load image for thumbnail: " + srcPath);
		return false;
	}
	std::unique_ptr<unsigned char, decltype(&stbi_image_free)> scopedData(data, &stbi_image_free);
	channels = 4;
	if (width <= 0 || height <= 0) {
		LOG_WARN("file_util", "Invalid source image size for thumbnail: " + srcPath);
		return false;
	}

	// 计算缩放尺寸，保持比例
	int newWidth = width, newHeight = height;
	if (width > height) {
		if (width > maxSize) {
			newWidth  = maxSize;
			newHeight = std::max(1, static_cast<int>((static_cast<double>(height) * maxSize) / width));
		}
	} else {
		if (height > maxSize) {
			newHeight = maxSize;
			newWidth  = std::max(1, static_cast<int>((static_cast<double>(width) * maxSize) / height));
		}
	}
	newWidth  = std::max(1, newWidth);
	newHeight = std::max(1, newHeight);

	// 缩放
	std::vector<unsigned char> resized(newWidth * newHeight * 4);
	if (!stbir_resize_uint8_linear(scopedData.get(),
	                               width,
	                               height,
	                               0,
	                               resized.data(),
	                               newWidth,
	                               newHeight,
	                               0,
	                               static_cast<stbir_pixel_layout>(4))) {
		LOG_WARN("file_util", "Failed to resize image for thumbnail: " + srcPath);
		return false;
	}

	// 处理透明度：由于 JPEG 不支持 Alpha，我们将 RGBA 混合到白色背景并转换为 RGB (原地处理)
	const int numPixels = newWidth * newHeight;
	for (int i = 0; i < numPixels; ++i) {
		const int          srcIdx = i * 4;
		const int          dstIdx = i * 3;
		const unsigned int a      = resized[srcIdx + 3];

		// 纯整型运算混合到白色背景 (255)，避免 float 转换，利于自动向量化
		resized[dstIdx + 0] = static_cast<unsigned char>((resized[srcIdx + 0] * a + 255 * (255 - a)) / 255);
		resized[dstIdx + 1] = static_cast<unsigned char>((resized[srcIdx + 1] * a + 255 * (255 - a)) / 255);
		resized[dstIdx + 2] = static_cast<unsigned char>((resized[srcIdx + 2] * a + 255 * (255 - a)) / 255);
	}

	// 创建目标目录
	std::error_code ec;
	std::filesystem::create_directories(std::filesystem::path(destPath).parent_path(), ec);

	// 输出 JPEG (直接复用 resized 的前段内存作为 RGB 数据)
	int result = stbi_write_jpg(destPath.c_str(), newWidth, newHeight, 3, resized.data(), 85);
	if (!result) {
		LOG_WARN("file_util", "Failed to write thumbnail: " + destPath);
		return false;
	}

	return true;
}

bool copyFile(const std::string &srcPath, const std::string &destPath) {
	std::error_code ec;
	auto            destDir = std::filesystem::path(destPath).parent_path();
	std::filesystem::create_directories(destDir, ec);
	if (ec) {
		LOG_ERROR("file_util", "Failed to create directory: " + destDir.string());
		return false;
	}

	std::filesystem::copy_file(srcPath, destPath, std::filesystem::copy_options::overwrite_existing, ec);
	if (ec) {
		LOG_ERROR("file_util", "Failed to copy file: " + ec.message());
		return false;
	}
	return true;
}

} // namespace quickmemes
