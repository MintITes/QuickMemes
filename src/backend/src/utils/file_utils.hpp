#pragma once
/**
 * @file file_utils.hpp
 * @brief 文件工具函数声明
 *
 * 严格对应 docs/arch/cpp_core.md 中的内部工具函数定义。
 * 提供 SHA-256 哈希、MIME 检测、图像尺寸读取、缩略图生成等能力。
 */

#include <cstdint>
#include <string>

namespace quickmemes {

/**
 * @brief 图像尺寸结构
 */
struct ImageSize {
	int32_t width  = 0; ///< 图像宽度（像素）
	int32_t height = 0; ///< 图像高度（像素）
};

/**
 * @brief 计算文件的 SHA-256 哈希
 *
 * 读取完整文件内容，使用 OpenSSL 计算 SHA-256 哈希。
 *
 * @param filePath std::string 文件绝对路径
 * @return std::string 64 位十六进制 SHA-256 哈希字符串
 * @throws ApiException(ERR_IO) 文件不存在或读取失败时
 */
[[nodiscard]] std::string computeHash(const std::string &filePath);

/**
 * @brief 检测文件的 MIME 类型
 *
 * 读取文件头部魔数 (Magic Bytes) 识别实际 MIME 类型，
 * 支持 image/png、image/jpeg、image/gif、image/webp、image/avif。
 *
 * @param filePath std::string 文件绝对路径
 * @return std::string MIME 类型字符串；无法识别时返回 "application/octet-stream"
 */
[[nodiscard]] std::string detectMimeType(const std::string &filePath);

/**
 * @brief 读取图像宽高
 *
 * 通过 stb_image 读取文件头部元数据获取图像尺寸。
 *
 * @param filePath std::string 图像文件绝对路径
 * @return ImageSize 包含 width 和 height 的结构体
 */
[[nodiscard]] ImageSize readImageSize(const std::string &filePath);

/**
 * @brief 生成缩略图
 *
 * 使用 stb_image 读取图像，stb_image_resize2 按比例缩放至长边不超过 maxSize，
 * 以 JPEG 格式通过 stb_image_write 保存。
 *
 * @param srcPath std::string 原始图像路径
 * @param destPath std::string 缩略图目标路径（.jpg）
 * @param maxSize int 最大边长像素
 * @return bool 生成成功返回 true；失败记录日志返回 false
 */
bool generateThumbnail(const std::string &srcPath, const std::string &destPath, int maxSize);

/**
 * @brief 复制文件到目标路径
 *
 * 若目标目录不存在则自动创建。
 *
 * @param srcPath std::string 源文件路径
 * @param destPath std::string 目标文件路径
 * @return bool 复制成功返回 true
 */
bool copyFile(const std::string &srcPath, const std::string &destPath);

} // namespace quickmemes
