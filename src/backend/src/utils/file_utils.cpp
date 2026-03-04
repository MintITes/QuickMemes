/**
 * @file file_utils.cpp
 * @brief 文件工具函数实现
 */

#include "utils/file_utils.hpp"
#include "utils/logger.hpp"
#include "error_codes.hpp"

#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <vector>

#include <openssl/sha.h>
#include <stb_image.h>
#include <stb_image_resize2.h>
#include <stb_image_write.h>

namespace quickmemes {

std::string computeHash(const std::string& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        throw ApiException(ERR_IO, "Failed to open file for hashing: " + filePath);
    }

    SHA256_CTX ctx;
    SHA256_Init(&ctx);

    char buffer[8192];
    while (file.read(buffer, sizeof(buffer))) {
        SHA256_Update(&ctx, buffer, file.gcount());
    }
    SHA256_Update(&ctx, buffer, file.gcount());

    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_Final(hash, &ctx);

    std::ostringstream oss;
    for (unsigned char byte : hash) {
        oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(byte);
    }
    return oss.str();
}

std::string detectMimeType(const std::string& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        return "application/octet-stream";
    }

    unsigned char header[16] = {};
    file.read(reinterpret_cast<char*>(header), sizeof(header));

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (header[0] == 0x89 && header[1] == 0x50 &&
        header[2] == 0x4E && header[3] == 0x47) {
        return "image/png";
    }

    // JPEG: FF D8 FF
    if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) {
        return "image/jpeg";
    }

    // GIF: 47 49 46 38
    if (header[0] == 0x47 && header[1] == 0x49 &&
        header[2] == 0x46 && header[3] == 0x38) {
        return "image/gif";
    }

    // WebP: RIFF....WEBP
    if (header[0] == 0x52 && header[1] == 0x49 &&
        header[2] == 0x46 && header[3] == 0x46 &&
        header[8] == 0x57 && header[9] == 0x45 &&
        header[10] == 0x42 && header[11] == 0x50) {
        return "image/webp";
    }

    // AVIF: ....ftypavif
    if (header[4] == 0x66 && header[5] == 0x74 &&
        header[6] == 0x79 && header[7] == 0x70) {
        return "image/avif";
    }

    return "application/octet-stream";
}

ImageSize readImageSize(const std::string& filePath) {
    ImageSize size;
    int channels = 0;
    // stbi_info 仅读取头部元数据，不完整解码图像
    if (!stbi_info(filePath.c_str(), &size.width, &size.height, &channels)) {
        LOG_WARN("file_util", "Failed to read image size: " + filePath);
    }
    return size;
}

bool generateThumbnail(const std::string& srcPath,
                       const std::string& destPath,
                       int maxSize) {
    int width = 0, height = 0, channels = 0;
    unsigned char* data = stbi_load(srcPath.c_str(), &width, &height, &channels, 0);
    if (!data) {
        LOG_WARN("file_util", "Failed to load image for thumbnail: " + srcPath);
        return false;
    }

    // 计算缩放尺寸，保持比例
    int newWidth = width, newHeight = height;
    if (width > height) {
        if (width > maxSize) {
            newWidth = maxSize;
            newHeight = height * maxSize / width;
        }
    } else {
        if (height > maxSize) {
            newHeight = maxSize;
            newWidth = width * maxSize / height;
        }
    }

    // 缩放
    std::vector<unsigned char> resized(newWidth * newHeight * channels);
    stbir_resize_uint8_linear(
        data, width, height, 0,
        resized.data(), newWidth, newHeight, 0,
        static_cast<stbir_pixel_layout>(channels));
    stbi_image_free(data);

    // 创建目标目录
    std::error_code ec;
    std::filesystem::create_directories(
        std::filesystem::path(destPath).parent_path(), ec);

    // 输出 JPEG
    int result = stbi_write_jpg(destPath.c_str(), newWidth, newHeight,
                                 channels, resized.data(), 85);
    if (!result) {
        LOG_WARN("file_util", "Failed to write thumbnail: " + destPath);
        return false;
    }

    return true;
}

bool copyFile(const std::string& srcPath, const std::string& destPath) {
    std::error_code ec;
    auto destDir = std::filesystem::path(destPath).parent_path();
    std::filesystem::create_directories(destDir, ec);
    if (ec) {
        LOG_ERROR("file_util", "Failed to create directory: " + destDir.string());
        return false;
    }

    std::filesystem::copy_file(srcPath, destPath,
        std::filesystem::copy_options::overwrite_existing, ec);
    if (ec) {
        LOG_ERROR("file_util", "Failed to copy file: " + ec.message());
        return false;
    }
    return true;
}

}  // namespace quickmemes
