#pragma once
/**
 * @file error_codes.hpp
 * @brief QuickMemes 业务错误码定义
 *
 * 严格对应 docs/arch/ipc_protocol.md「业务错误码」章节。
 * 用于 ApiResponse 中的 code 字段以及 ApiException 异常。
 */

#include <stdexcept>
#include <string>

namespace quickmemes {

// ─────────────────────────────────────────────────────────────
// 业务错误码常量
// ─────────────────────────────────────────────────────────────

constexpr int ERR_OK             = 0;    ///< 无错误
constexpr int ERR_INVALID_PARAMS = 1001; ///< 请求参数校验失败
constexpr int ERR_NOT_FOUND      = 1002; ///< 目标资源不存在
constexpr int ERR_DUPLICATE      = 1003; ///< 资源已存在（如 hash 重复）
constexpr int ERR_IO             = 1004; ///< 文件读写失败
constexpr int ERR_INTERNAL       = 1099; ///< 后端内部未预期错误

constexpr int ERR_OCR_NOT_READY = 2001; ///< OCR 服务未配置
constexpr int ERR_OCR_FAILED    = 2002; ///< OCR 识别失败

constexpr int ERR_AI_UNAVAILABLE    = 3001; ///< AI 服务不可用
constexpr int ERR_AI_REQUEST_FAILED = 3002; ///< AI API 调用失败

constexpr int ERR_QUOTA_EXCEEDED = 4001; ///< API 配额超限（AI / OCR 共用）

// ─────────────────────────────────────────────────────────────
// ApiException — 业务异常
// ─────────────────────────────────────────────────────────────

/**
 * @brief QuickMemes 业务异常
 *
 * 各模块在遇到可预期的业务错误时抛出此异常，
 * 由路由层捕获后包装为 ApiResponse 返回给前端。
 */
class ApiException : public std::runtime_error {
public:
	/**
	 * @brief 构造业务异常
	 * @param code   int 业务错误码（ERR_* 常量之一）
	 * @param message std::string 人类可读的错误描述
	 */
	ApiException(int code, const std::string &message) : std::runtime_error(message), code_(code) {}

	/**
	 * @brief 获取业务错误码
	 * @return int 错误码
	 */
	[[nodiscard]] int code() const noexcept { return code_; }

private:
	int code_; ///< 业务错误码
};

} // namespace quickmemes
