#pragma once
/**
 * @file api_types.hpp
 * @brief QuickMemes 通信协议专用数据结构
 *
 * 严格对应 docs/arch/ipc_protocol.md「模块独有数据结构」章节。
 * 定义 HTTP REST 请求/响应体格式和 WebSocket 事件格式。
 */

#include "types.hpp"
#include "error_codes.hpp"
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace quickmemes {

// ─────────────────────────────────────────────────────────────
// ApiResponse<T> — 统一 HTTP 响应体格式
// ─────────────────────────────────────────────────────────────

/**
 * @brief 统一 HTTP 响应体模板
 *
 * 所有 HTTP REST 端点的响应均使用此格式包装。
 * @tparam T 响应数据类型
 */
template<typename T>
struct ApiResponse {
    bool        success = true;   ///< 请求是否成功
    T           data{};           ///< 响应数据（success=true 时有效）
    std::string error;            ///< 错误描述（success=false 时有效）
    int         code = ERR_OK;    ///< 业务错误码（0 表示无错误）
};

// ─────────────────────────────────────────────────────────────
// ImportRequest / ImportOptions — 导入请求体
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导入选项
 */
struct ImportOptions {
    bool        autoOcr       = true;  ///< 是否自动执行 OCR
    bool        autoAiAnalyze = true;  ///< 是否自动 AI 分析
    std::string sourceName;            ///< 来源名称（可为空）
    std::string sourceUrl;             ///< 来源 URL（可为空）
};

/**
 * @brief 导入请求体
 *
 * 前端通过 POST /api/import 提交的导入任务请求。
 */
struct ImportRequest {
    ImportSource source = ImportSource::LOCAL_FILE;  ///< 导入来源
    std::vector<std::string> inputs;                ///< 输入内容列表
    ImportOptions options;                          ///< 导入选项
};

// ─────────────────────────────────────────────────────────────
// MemePatch — Meme 更新请求体
// ─────────────────────────────────────────────────────────────

/**
 * @brief Meme 局部更新数据
 *
 * PUT /api/meme/:id 请求体，仅含需要更新的字段（optional 语义）。
 */
struct MemePatch {
    std::optional<std::string> name;          ///< 新名称
    std::optional<std::string> description;   ///< 新描述
    std::optional<std::string> sourceName;    ///< 新来源名称
    std::optional<std::string> sourceUrl;     ///< 新来源 URL
};

// ─────────────────────────────────────────────────────────────
// ExportRequest / ExportResult — 导出
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导出请求体
 */
struct ExportRequest {
    std::vector<int64_t> memeIds;  ///< 要导出的 Meme ID 列表
    std::string destDir;           ///< 导出目标目录路径
    bool        keepNames = true;  ///< 是否保留原文件名
};

/**
 * @brief 导出结果
 */
struct ExportResult {
    int32_t succeeded = 0;                 ///< 成功导出数量
    int32_t failed    = 0;                 ///< 失败数量
    std::vector<std::string> errors;       ///< 各失败项的描述
};

// ─────────────────────────────────────────────────────────────
// SearchResult / SearchResultItem — 搜索结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 搜索结果条目
 */
struct SearchResultItem {
    MemeEntry meme;                  ///< Meme 数据（不含 embedding）
    float     similarityScore = -1;  ///< 向量搜索相似度分数（-1 表示非向量搜索）
};

/**
 * @brief 搜索响应结果
 */
struct SearchResult {
    std::vector<SearchResultItem> items;  ///< 结果条目列表
    int32_t total = 0;                    ///< 匹配总数（用于分页）
};

// ─────────────────────────────────────────────────────────────
// BatchResult — 批量操作结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 批量操作结果
 */
struct BatchResult {
    int32_t succeeded = 0;                 ///< 成功数量
    int32_t failed    = 0;                 ///< 失败数量
    std::vector<std::string> errors;       ///< 各失败项描述
};

// ─────────────────────────────────────────────────────────────
// HealthStatus — 健康检查结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 健康检查结果
 *
 * GET /api/health 返回的子模块状态信息。
 */
struct HealthStatus {
    std::string status;  ///< "ok" | "degraded"
    bool visionOk = false;  ///< Vision 模块是否可用
    bool dbOk     = false;  ///< 数据库是否正常
};

// ─────────────────────────────────────────────────────────────
// RuntimeConfigPatch — 运行时配置热更新
// ─────────────────────────────────────────────────────────────

/**
 * @brief 运行时配置热更新补丁
 *
 * PATCH /api/config 请求体，仅含需要变更的可热更新字段。
 */
struct RuntimeConfigPatch {
    std::optional<std::string> aiApiKey;         ///< AI API 密钥
    std::optional<std::string> aiApiBaseUrl;      ///< AI API 基础 URL
    std::optional<std::string> aiVisionModel;     ///< VLM 模型名称
    std::optional<std::string> aiEmbeddingModel;  ///< Embedding 模型名称
    std::optional<int>         aiTimeoutSeconds;  ///< AI API 请求超时秒数
    std::optional<int>         aiMaxRetries;      ///< AI API 失败重试次数
    std::optional<std::string> ocrApiKey;         ///< 云端 OCR API 密钥
    std::optional<std::string> ocrApiUrl;         ///< 云端 OCR API 地址
    std::optional<std::string> ocrProvider;       ///< 云端 OCR 提供商
    std::optional<std::string> logMinLevel;       ///< 最低日志输出等级
};

// ─────────────────────────────────────────────────────────────
// WsEvent — WebSocket 推送事件
// ─────────────────────────────────────────────────────────────

/**
 * @brief WebSocket 推送事件
 *
 * C++ 后端通过 WebSocket 向前端推送的事件格式。
 */
struct WsEvent {
    std::string     event;    ///< 事件名称，如 "meme:added"、"task:progress"
    nlohmann::json  payload;  ///< 事件负载（JSON 对象）
};

}  // namespace quickmemes
