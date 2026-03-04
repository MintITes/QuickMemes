#pragma once
/**
 * @file types.hpp
 * @brief QuickMemes 全局共享数据结构定义
 *
 * 严格对应 docs/Arch.md「全局共享数据结构」章节的定义。
 * 各模块间通过 nlohmann/json 序列化后跨进程 (HTTP/WebSocket) 传输。
 */

#include <cstdint>
#include <string>
#include <vector>

namespace quickmemes {

// ─────────────────────────────────────────────────────────────
// ProcessingStatus — OCR / AI 处理状态枚举
// ─────────────────────────────────────────────────────────────

/**
 * @brief Meme 的 OCR / AI 处理状态
 *
 * 取值：PENDING → PROCESSING → DONE / FAILED / SKIPPED
 */
enum class ProcessingStatus {
    PENDING,     ///< 等待处理
    PROCESSING,  ///< 处理中
    DONE,        ///< 处理完成
    FAILED,      ///< 处理失败
    SKIPPED      ///< 跳过（如 AI 不可用时）
};

/**
 * @brief 将 ProcessingStatus 枚举转换为字符串
 * @param status ProcessingStatus 枚举值
 * @return 对应的字符串表示，如 "PENDING"、"DONE"
 */
[[nodiscard]] inline std::string processingStatusToString(ProcessingStatus status) {
    switch (status) {
        case ProcessingStatus::PENDING:    return "PENDING";
        case ProcessingStatus::PROCESSING: return "PROCESSING";
        case ProcessingStatus::DONE:       return "DONE";
        case ProcessingStatus::FAILED:     return "FAILED";
        case ProcessingStatus::SKIPPED:    return "SKIPPED";
    }
    return "UNKNOWN";
}

/**
 * @brief 将字符串解析为 ProcessingStatus 枚举
 * @param str 字符串值，如 "PENDING"
 * @return 对应的 ProcessingStatus 枚举值，未识别时返回 PENDING
 */
[[nodiscard]] inline ProcessingStatus processingStatusFromString(const std::string& str) {
    if (str == "PROCESSING") return ProcessingStatus::PROCESSING;
    if (str == "DONE")       return ProcessingStatus::DONE;
    if (str == "FAILED")     return ProcessingStatus::FAILED;
    if (str == "SKIPPED")    return ProcessingStatus::SKIPPED;
    return ProcessingStatus::PENDING;
}

// ─────────────────────────────────────────────────────────────
// MemeEntry — Meme 条目
// ─────────────────────────────────────────────────────────────

/**
 * @brief Meme 条目数据结构
 *
 * 对应数据库 `memes` 表的完整记录。
 * 不含 embedding 向量字段，向量独立存储在 `vec_memes` 虚拟表中。
 */
struct MemeEntry {
    int64_t     id          = 0;    ///< 数据库自增主键
    std::string filePath;           ///< 本地文件绝对路径
    std::string fileHash;           ///< SHA-256 文件哈希（去重用）
    std::string mimeType;           ///< 文件 MIME 类型，如 "image/png"
    int64_t     fileSize    = 0;    ///< 文件大小（字节）
    int32_t     width       = 0;    ///< 图像宽度（像素）
    int32_t     height      = 0;    ///< 图像高度（像素）
    std::string sourceName;         ///< 来源名称，如 "Twitter"（可为空）
    std::string sourceUrl;          ///< 来源 URL（可为空）
    std::string name;               ///< 用户自定义名称（可为空，默认文件名）
    std::string description;        ///< 用户自定义描述（可为空）
    std::string ocrText;            ///< OCR 识别出的全文（可为空）
    ProcessingStatus ocrStatus = ProcessingStatus::PENDING;  ///< OCR 处理状态
    ProcessingStatus aiStatus  = ProcessingStatus::PENDING;  ///< AI 分析处理状态
    std::vector<int64_t> tagIds;    ///< 关联标签 ID 列表
    int64_t     createdAt   = 0;    ///< Unix 时间戳（毫秒）
    int64_t     updatedAt   = 0;    ///< Unix 时间戳（毫秒）
    int64_t     deletedAt   = 0;    ///< 软删除时间戳（毫秒，0 表示未删除）
};

// ─────────────────────────────────────────────────────────────
// Tag — 标签
// ─────────────────────────────────────────────────────────────

/**
 * @brief 标签数据结构
 *
 * 标签名称全局唯一，用于对 Meme 进行分类管理。
 */
struct Tag {
    int64_t     id        = 0;  ///< 数据库自增主键
    std::string name;           ///< 标签名称，全局唯一
    std::string color;          ///< 显示颜色，HEX 格式，如 "#FF5733"（可为空）
    int64_t     createdAt = 0;  ///< Unix 时间戳（毫秒）
};

// ─────────────────────────────────────────────────────────────
// SearchQuery — 搜索查询参数
// ─────────────────────────────────────────────────────────────

/**
 * @brief 搜索查询参数
 *
 * 前端通过 POST /api/memes/search 传递的搜索条件。
 * 未设置的字段表示不过滤该维度。
 */
struct SearchQuery {
    std::string keyword;                ///< 关键词，模糊匹配名称/描述/OCR 文本（可为空）
    std::vector<int64_t> tagIds;        ///< 按标签过滤（空表示不过滤）
    std::string source;                 ///< 按来源名称过滤（可为空）
    int64_t     timeFrom    = 0;        ///< 时间范围起始（毫秒，0 = 不限）
    int64_t     timeTo      = 0;        ///< 时间范围结束（毫秒，0 = 不限）
    std::vector<std::string> formats;   ///< 文件格式过滤，如 ["image/gif"]
    int64_t     sizeMin     = 0;        ///< 最小文件大小（字节，0 = 不限）
    int64_t     sizeMax     = 0;        ///< 最大文件大小（字节，0 = 不限）
    std::string regex;                  ///< 正则表达式匹配（可为空）
    bool        useVector   = false;    ///< 是否启用语义向量搜索
    std::string sortBy      = "createdAt";  ///< 排序字段
    std::string sortOrder   = "DESC";   ///< 排序方向 "ASC" / "DESC"
    int32_t     limit       = 50;       ///< 每页结果数量（默认 50，最大 200）
    int32_t     offset      = 0;        ///< 分页偏移量
};

// ─────────────────────────────────────────────────────────────
// ImportSource / TaskStatus 枚举
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导入来源枚举
 */
enum class ImportSource {
    URL,         ///< 从 URL 下载
    CLIPBOARD,   ///< 从剪贴板获取
    LOCAL_FILE,  ///< 本地文件
    SCREENSHOT,  ///< 截图
    DRAG_DROP    ///< 拖放
};

/**
 * @brief 导入任务状态枚举
 */
enum class TaskStatus {
    PENDING,     ///< 等待开始
    PROCESSING,  ///< 处理中
    DONE,        ///< 已完成
    FAILED,      ///< 失败
    CANCELLED    ///< 已取消
};

// ─────────────────────────────────────────────────────────────
// ImportTask — 导入任务
// ─────────────────────────────────────────────────────────────

/**
 * @brief 导入任务数据结构
 *
 * 记录一次批量导入操作的整体状态和进度。
 */
struct ImportTask {
    std::string  taskId;         ///< UUID，唯一任务标识
    ImportSource source = ImportSource::LOCAL_FILE;  ///< 导入来源
    std::vector<std::string> inputs;   ///< 输入内容列表（URL / 文件路径）
    TaskStatus   status = TaskStatus::PENDING;  ///< 当前状态
    int32_t      total      = 0;   ///< 总任务数
    int32_t      processed  = 0;   ///< 已处理数
    int32_t      succeeded  = 0;   ///< 成功数
    int32_t      failed     = 0;   ///< 失败数
    std::vector<std::string> errors;   ///< 各失败项的错误描述
    int64_t      createdAt  = 0;   ///< 任务创建时间戳（毫秒）
};

// ─────────────────────────────────────────────────────────────
// AiAnalysisResult — AI 分析结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief AI 分析结果数据结构
 *
 * Vision 模块 analyzeImage() 返回的分析结果。
 * embedding 字段由 C++ 核心模块在拼接文本后单独调用 generateEmbedding() 生成。
 */
struct AiAnalysisResult {
    std::vector<std::string> suggestedTags;  ///< AI 建议的标签列表
    std::string  description;                ///< AI 生成的描述文本
    std::vector<float> embedding;            ///< 语义向量（由调用方填充）
    bool         success = false;            ///< 是否成功
    std::string  error;                      ///< 失败时的错误描述（可为空）
};

// ─────────────────────────────────────────────────────────────
// OcrResult — OCR 识别结果
// ─────────────────────────────────────────────────────────────

/**
 * @brief OCR 识别结果数据结构
 *
 * Vision 模块 recognize() 返回的文字识别结果。
 */
struct OcrResult {
    std::string fullText;       ///< 识别出的完整文本
    bool        success = false; ///< 是否成功
    std::string error;          ///< 失败时的错误描述（可为空）
};

// ─────────────────────────────────────────────────────────────
// PipelineStage — 导入管线阶段
// ─────────────────────────────────────────────────────────────

/**
 * @brief 单个文件导入处理管线中的当前阶段
 */
enum class PipelineStage {
    DOWNLOAD,  ///< 下载阶段（仅 URL 来源）
    HASH,      ///< 计算文件哈希
    COPY,      ///< 复制到存储目录
    INSERT,    ///< 插入数据库
    DONE,      ///< 入库完成
    FAILED     ///< 管线失败
};

/**
 * @brief 单个文件的导入处理管线状态
 *
 * 内部使用，跟踪单个文件在导入流程中的处理进度。
 */
struct ImportPipeline {
    std::string   taskId;       ///< 所属任务 ID
    std::string   inputPath;    ///< 原始输入路径
    std::string   destPath;     ///< 最终存储路径
    std::string   fileHash;     ///< SHA-256 哈希
    std::string   mimeType;     ///< 检测到的 MIME 类型
    int32_t       width  = 0;   ///< 图像宽度
    int32_t       height = 0;   ///< 图像高度
    MemeEntry     memeEntry;    ///< 构建的 Meme 对象
    PipelineStage stage = PipelineStage::DOWNLOAD;  ///< 当前阶段
    std::string   error;        ///< 失败描述（可为空）
};

}  // namespace quickmemes
