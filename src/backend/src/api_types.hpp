#pragma once
/**
 * @file api_types.hpp
 * @brief QuickMemes 通信协议专用数据结构
 *
 * 严格对应 docs/arch/ipc_protocol.md「模块独有数据结构」章节。
 * 定义 HTTP REST 请求/响应体格式和 WebSocket 事件格式。
 */

#include "error_codes.hpp"
#include "types.hpp"

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
template <typename T> struct ApiResponse {
	bool        success = true; ///< 请求是否成功
	T           data{};         ///< 响应数据（success=true 时有效）
	std::string error;          ///< 错误描述（success=false 时有效）
	int         code = ERR_OK;  ///< 业务错误码（0 表示无错误）
};

// ─────────────────────────────────────────────────────────────
// ImportRequest / ImportOptions — 导入请求体
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导入选项
 */
struct ImportOptions {
	bool        autoOcr       = true; ///< 是否自动执行 OCR
	bool        autoAiAnalyze = true; ///< 是否自动 AI 分析
	std::string sourceName;           ///< 来源名称（可为空）
	std::string sourceUrl;            ///< 来源 URL（可为空）
};

/**
 * @brief 导入请求体
 *
 * 前端通过 POST /api/import 提交的导入任务请求。
 */
struct ImportRequest {
	ImportSource             source = ImportSource::LOCAL_FILE; ///< 导入来源
	std::vector<std::string> inputs;                            ///< 输入内容列表
	ImportOptions            options;                           ///< 导入选项
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
	std::optional<std::string> name;        ///< 新名称
	std::optional<std::string> description; ///< 新描述
	std::optional<std::string> sourceName;  ///< 新来源名称
	std::optional<std::string> sourceUrl;   ///< 新来源 URL
	std::optional<int64_t>     categoryId;  ///< 新分类 ID
};

/**
 * @brief 分类局部更新数据
 */
struct CategoryPatch {
	std::optional<std::string> name;     ///< 新名称
	std::optional<std::string> color;    ///< 新颜色
	std::optional<int64_t>     position; ///< 新排序位置
};

/**
 * @brief 批量移动到分类请求
 */
struct BatchCategoryRequest {
	std::vector<int64_t> memeIds;    ///< Meme ID 列表
	int64_t              categoryId; ///< 目标分类 ID
};

// ─────────────────────────────────────────────────────────────
// ExportRequest / ExportResult — 导出
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导出请求体
 */
struct ExportRequest {
	std::vector<int64_t> memeIds;          ///< 要导出的 Meme ID 列表
	std::string          destDir;          ///< 导出目标目录路径
	bool                 keepNames = true; ///< 是否保留原文件名
};

/**
 * @brief 导出结果
 */
struct ExportResult {
	int32_t                  succeeded = 0; ///< 成功导出数量
	int32_t                  failed    = 0; ///< 失败数量
	std::vector<std::string> errors;        ///< 各失败项的描述
};

// ─────────────────────────────────────────────────────────────
// SearchResult / SearchResultItem — 搜索结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 搜索结果条目
 */
struct SearchScoreBreakdown {
	float name              = 0.0f;
	float description       = 0.0f;
	float ocrText           = 0.0f;
	float tagName           = 0.0f;
	float categoryName      = 0.0f;
	float vectorDescription = 0.0f;
	float vectorOcr         = 0.0f;
	float final             = 0.0f;
};

/**
 * @brief 搜索结果条目
 */
struct SearchResultItem {
	MemeEntry            meme;                 ///< Meme 数据（不含 embedding）
	float                similarityScore = -1; ///< 向量搜索相似度分数（-1 表示非向量搜索）
	float                relevanceScore  = 0;  ///< 混合搜索相关性分数
	SearchScoreBreakdown scoreBreakdown;       ///< 搜索打分拆解
};

/**
 * @brief 搜索响应结果
 */
struct SearchResult {
	std::vector<SearchResultItem> items;     ///< 结果条目列表
	int32_t                       total = 0; ///< 匹配总数（用于分页）
};

// ─────────────────────────────────────────────────────────────
// BatchResult — 批量操作结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 批量操作结果
 */
struct BatchResult {
	int32_t                  succeeded = 0; ///< 成功数量
	int32_t                  failed    = 0; ///< 失败数量
	std::vector<std::string> errors;        ///< 各失败项描述
};

// ─────────────────────────────────────────────────────────────
// HealthStatus — 健康检查结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief 健康检查模块状态
 */
struct HealthModules {
	bool db     = false;
	bool vision = false;
};

/**
 * @brief 健康检查结果
 *
 * GET /api/health 返回的子模块状态信息。
 */
struct HealthStatus {
	std::string   status; ///< "ok" | "degraded"
	HealthModules modules;
};

// ─────────────────────────────────────────────────────────────
// RuntimeConfigPatch — 运行时配置热更新
// ─────────────────────────────────────────────────────────────

/**
 * @brief 运行时配置热更新补丁
 *
 * PATCH /api/config 请求体，仅含需要变更的可热更新字段。
 */
struct RuntimeSearchWeightsPatch {
	std::optional<double> name;
	std::optional<double> description;
	std::optional<double> ocrText;
	std::optional<double> tagName;
	std::optional<double> categoryName;
	std::optional<double> vectorDescription;
	std::optional<double> vectorOcr;
};

struct RuntimeSearchConfigPatch {
	std::optional<int>                     maxCandidatesPerScorer;
	std::optional<int>                     vectorTopK;
	std::optional<double>                  minScore;
	std::optional<RuntimeSearchWeightsPatch> weights;
};

struct RuntimeConfigPatch {
	std::optional<std::string> aiApiKey;         ///< AI API 密钥
	std::optional<std::string> aiApiBaseUrl;     ///< AI API 基础 URL
	std::optional<std::string> aiVisionModel;    ///< VLM 模型名称
	std::optional<int>         aiTimeoutSeconds; ///< AI API 请求超时秒数
	std::optional<int>         aiMaxRetries;     ///< AI API 失败重试次数
	std::optional<std::string> ocrApiKey;        ///< 云端 OCR API 密钥
	std::optional<std::string> ocrApiUrl;        ///< 云端 OCR API 地址
	std::optional<std::string> ocrProvider;      ///< 云端 OCR 提供商
	std::optional<std::string> embeddingProvider;       ///< Embedding 提供商
	std::optional<std::string> embeddingModel;          ///< Embedding 模型
	std::optional<std::string> embeddingApiUrl;         ///< Embedding API 地址
	std::optional<std::string> embeddingApiKey;         ///< Embedding API 密钥
	std::optional<int>         embeddingDimensions;     ///< Embedding 维度
	std::optional<int>         embeddingTimeoutSeconds; ///< Embedding API 超时秒数
	std::optional<int>         embeddingMaxRetries;     ///< Embedding API 最大重试次数
	std::optional<std::string> logMinLevel;      ///< 最低日志输出等级
	std::optional<RuntimeSearchConfigPatch> search;           ///< 搜索热更新配置
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
	std::string    event;   ///< 事件名称，如 "meme:added"、"task:progress"
	nlohmann::json payload; ///< 事件负载（JSON 对象）
};

// ─────────────────────────────────────────────────────────────
// JSON 序列化宏
// ─────────────────────────────────────────────────────────────

template <typename T> inline void to_json(nlohmann::json &j, const ApiResponse<T> &p) {
	j = nlohmann::json{
	    {"success", p.success},
	    {  "error",   p.error},
	    {   "code",    p.code}
    };
	if constexpr (std::is_same_v<T, std::nullptr_t>) {
		j["data"] = nullptr;
	} else {
		j["data"] = p.data;
	}
}

template <typename T> inline void from_json(const nlohmann::json &j, ApiResponse<T> &p) {
	if (j.contains("success")) j.at("success").get_to(p.success);
	if (j.contains("error")) j.at("error").get_to(p.error);
	if (j.contains("code")) j.at("code").get_to(p.code);
	if constexpr (!std::is_same_v<T, std::nullptr_t>) {
		if (j.contains("data") && !j.at("data").is_null()) { j.at("data").get_to(p.data); }
	}
}

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(HealthModules, db, vision)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(HealthStatus, status, modules)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(ImportOptions, autoOcr, autoAiAnalyze, sourceName, sourceUrl)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(ImportRequest, source, inputs, options)

inline void from_json(const nlohmann::json &j, MemePatch &p) {
	if (j.contains("name") && !j.at("name").is_null()) p.name = j.at("name").get<std::string>();
	if (j.contains("description") && !j.at("description").is_null())
		p.description = j.at("description").get<std::string>();
	if (j.contains("sourceName") && !j.at("sourceName").is_null()) p.sourceName = j.at("sourceName").get<std::string>();
	if (j.contains("sourceUrl") && !j.at("sourceUrl").is_null()) p.sourceUrl = j.at("sourceUrl").get<std::string>();
	if (j.contains("categoryId") && !j.at("categoryId").is_null()) p.categoryId = j.at("categoryId").get<int64_t>();
}
inline void to_json(nlohmann::json &j, const MemePatch &p) {
	j = nlohmann::json::object();
	if (p.name) j["name"] = *p.name;
	if (p.description) j["description"] = *p.description;
	if (p.sourceName) j["sourceName"] = *p.sourceName;
	if (p.sourceUrl) j["sourceUrl"] = *p.sourceUrl;
	if (p.categoryId) j["categoryId"] = *p.categoryId;
}

inline void from_json(const nlohmann::json &j, CategoryPatch &p) {
	if (j.contains("name") && !j.at("name").is_null()) p.name = j.at("name").get<std::string>();
	if (j.contains("color") && !j.at("color").is_null()) p.color = j.at("color").get<std::string>();
	if (j.contains("position") && !j.at("position").is_null()) p.position = j.at("position").get<int64_t>();
}
inline void to_json(nlohmann::json &j, const CategoryPatch &p) {
	j = nlohmann::json::object();
	if (p.name) j["name"] = *p.name;
	if (p.color) j["color"] = *p.color;
	if (p.position) j["position"] = *p.position;
}

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(BatchCategoryRequest, memeIds, categoryId)

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(ExportRequest, memeIds, destDir, keepNames)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(ExportResult, succeeded, failed, errors)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(SearchScoreBreakdown,
                                                name,
                                                description,
                                                ocrText,
                                                tagName,
                                                categoryName,
                                                vectorDescription,
                                                vectorOcr,
                                                final)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(SearchResultItem,
                                                meme,
                                                similarityScore,
                                                relevanceScore,
                                                scoreBreakdown)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(SearchResult, items, total)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(BatchResult, succeeded, failed, errors)

inline void from_json(const nlohmann::json &j, RuntimeSearchWeightsPatch &p) {
	if (j.contains("name") && !j.at("name").is_null()) p.name = j.at("name").get<double>();
	if (j.contains("description") && !j.at("description").is_null()) p.description = j.at("description").get<double>();
	if (j.contains("ocrText") && !j.at("ocrText").is_null()) p.ocrText = j.at("ocrText").get<double>();
	if (j.contains("tagName") && !j.at("tagName").is_null()) p.tagName = j.at("tagName").get<double>();
	if (j.contains("categoryName") && !j.at("categoryName").is_null()) p.categoryName = j.at("categoryName").get<double>();
	if (j.contains("vectorDescription") && !j.at("vectorDescription").is_null())
		p.vectorDescription = j.at("vectorDescription").get<double>();
	if (j.contains("vectorOcr") && !j.at("vectorOcr").is_null()) p.vectorOcr = j.at("vectorOcr").get<double>();
}

inline void to_json(nlohmann::json &j, const RuntimeSearchWeightsPatch &p) {
	j = nlohmann::json::object();
	if (p.name) j["name"] = *p.name;
	if (p.description) j["description"] = *p.description;
	if (p.ocrText) j["ocrText"] = *p.ocrText;
	if (p.tagName) j["tagName"] = *p.tagName;
	if (p.categoryName) j["categoryName"] = *p.categoryName;
	if (p.vectorDescription) j["vectorDescription"] = *p.vectorDescription;
	if (p.vectorOcr) j["vectorOcr"] = *p.vectorOcr;
}

inline void from_json(const nlohmann::json &j, RuntimeSearchConfigPatch &p) {
	if (j.contains("maxCandidatesPerScorer") && !j.at("maxCandidatesPerScorer").is_null())
		p.maxCandidatesPerScorer = j.at("maxCandidatesPerScorer").get<int>();
	if (j.contains("vectorTopK") && !j.at("vectorTopK").is_null()) p.vectorTopK = j.at("vectorTopK").get<int>();
	if (j.contains("minScore") && !j.at("minScore").is_null()) p.minScore = j.at("minScore").get<double>();
	if (j.contains("weights") && !j.at("weights").is_null()) p.weights = j.at("weights").get<RuntimeSearchWeightsPatch>();
}

inline void to_json(nlohmann::json &j, const RuntimeSearchConfigPatch &p) {
	j = nlohmann::json::object();
	if (p.maxCandidatesPerScorer) j["maxCandidatesPerScorer"] = *p.maxCandidatesPerScorer;
	if (p.vectorTopK) j["vectorTopK"] = *p.vectorTopK;
	if (p.minScore) j["minScore"] = *p.minScore;
	if (p.weights) j["weights"] = *p.weights;
}

inline void from_json(const nlohmann::json &j, RuntimeConfigPatch &p) {
	if (j.contains("aiApiKey") && !j.at("aiApiKey").is_null()) p.aiApiKey = j.at("aiApiKey").get<std::string>();
	if (j.contains("aiApiBaseUrl") && !j.at("aiApiBaseUrl").is_null())
		p.aiApiBaseUrl = j.at("aiApiBaseUrl").get<std::string>();
	if (j.contains("aiVisionModel") && !j.at("aiVisionModel").is_null())
		p.aiVisionModel = j.at("aiVisionModel").get<std::string>();
	if (j.contains("aiTimeoutSeconds") && !j.at("aiTimeoutSeconds").is_null())
		p.aiTimeoutSeconds = j.at("aiTimeoutSeconds").get<int>();
	if (j.contains("aiMaxRetries") && !j.at("aiMaxRetries").is_null()) p.aiMaxRetries = j.at("aiMaxRetries").get<int>();
	if (j.contains("ocrApiKey") && !j.at("ocrApiKey").is_null()) p.ocrApiKey = j.at("ocrApiKey").get<std::string>();
	if (j.contains("ocrApiUrl") && !j.at("ocrApiUrl").is_null()) p.ocrApiUrl = j.at("ocrApiUrl").get<std::string>();
	if (j.contains("ocrProvider") && !j.at("ocrProvider").is_null())
		p.ocrProvider = j.at("ocrProvider").get<std::string>();
	if (j.contains("embeddingProvider") && !j.at("embeddingProvider").is_null())
		p.embeddingProvider = j.at("embeddingProvider").get<std::string>();
	if (j.contains("embeddingModel") && !j.at("embeddingModel").is_null())
		p.embeddingModel = j.at("embeddingModel").get<std::string>();
	if (j.contains("embeddingApiUrl") && !j.at("embeddingApiUrl").is_null())
		p.embeddingApiUrl = j.at("embeddingApiUrl").get<std::string>();
	if (j.contains("embeddingApiKey") && !j.at("embeddingApiKey").is_null())
		p.embeddingApiKey = j.at("embeddingApiKey").get<std::string>();
	if (j.contains("embeddingDimensions") && !j.at("embeddingDimensions").is_null())
		p.embeddingDimensions = j.at("embeddingDimensions").get<int>();
	if (j.contains("embeddingTimeoutSeconds") && !j.at("embeddingTimeoutSeconds").is_null())
		p.embeddingTimeoutSeconds = j.at("embeddingTimeoutSeconds").get<int>();
	if (j.contains("embeddingMaxRetries") && !j.at("embeddingMaxRetries").is_null())
		p.embeddingMaxRetries = j.at("embeddingMaxRetries").get<int>();
	if (j.contains("logMinLevel") && !j.at("logMinLevel").is_null())
		p.logMinLevel = j.at("logMinLevel").get<std::string>();
	if (j.contains("search") && !j.at("search").is_null()) p.search = j.at("search").get<RuntimeSearchConfigPatch>();
}
inline void to_json(nlohmann::json &j, const RuntimeConfigPatch &p) {
	j = nlohmann::json::object();
	if (p.aiApiKey) j["aiApiKey"] = *p.aiApiKey;
	if (p.aiApiBaseUrl) j["aiApiBaseUrl"] = *p.aiApiBaseUrl;
	if (p.aiVisionModel) j["aiVisionModel"] = *p.aiVisionModel;
	if (p.aiTimeoutSeconds) j["aiTimeoutSeconds"] = *p.aiTimeoutSeconds;
	if (p.aiMaxRetries) j["aiMaxRetries"] = *p.aiMaxRetries;
	if (p.ocrApiKey) j["ocrApiKey"] = *p.ocrApiKey;
	if (p.ocrApiUrl) j["ocrApiUrl"] = *p.ocrApiUrl;
	if (p.ocrProvider) j["ocrProvider"] = *p.ocrProvider;
	if (p.embeddingProvider) j["embeddingProvider"] = *p.embeddingProvider;
	if (p.embeddingModel) j["embeddingModel"] = *p.embeddingModel;
	if (p.embeddingApiUrl) j["embeddingApiUrl"] = *p.embeddingApiUrl;
	if (p.embeddingApiKey) j["embeddingApiKey"] = *p.embeddingApiKey;
	if (p.embeddingDimensions) j["embeddingDimensions"] = *p.embeddingDimensions;
	if (p.embeddingTimeoutSeconds) j["embeddingTimeoutSeconds"] = *p.embeddingTimeoutSeconds;
	if (p.embeddingMaxRetries) j["embeddingMaxRetries"] = *p.embeddingMaxRetries;
	if (p.logMinLevel) j["logMinLevel"] = *p.logMinLevel;
	if (p.search) j["search"] = *p.search;
}

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE_WITH_DEFAULT(WsEvent, event, payload)

} // namespace quickmemes
