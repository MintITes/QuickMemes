#pragma once
/**
 * @file handlers.hpp
 * @brief REST API 路由处理函数声明
 *
 * 包装为独立函数以便注入到 Router。
 * 每个函数处理特定 API 端点的具体业务逻辑。
 */

namespace quickmemes {

struct HttpRequestProxy;
struct HttpResponseProxy;

/**
 * @brief Health Check API (GET /api/health)
 *
 * 不校验 Auth Token。返回各核心模块（Vision/DB）连接状态。
 *
 * @param req HttpRequestProxy 包含请求头的代理
 * @param res HttpResponseProxy 用于设置状态码和 JSON 响应
 */
void handleGetHealth(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 提交导入任务 API (POST /api/import)
 *
 * 解析 ImportRequest，将任务压入 TaskQueue。满载时返回 429。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostImport(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 取消导入任务 API (POST /api/import/cancel)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostImportCancel(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 分享到应用端点 API (POST /api/share)
 *
 * 处理来自浏览器或系统的单一实体拖拽/分享导入。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostShare(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 搜索 Meme 列表 API (POST /api/memes/search)
 *
 * 接收 SearchQuery，调用 db->searchMemes 执行全文或向量过滤，返回分页结果。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostMemesSearch(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 获取单个 Meme 详情 API (GET /api/memes/:id)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handleGetMeme(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 更新单个 Meme 字段 API (PUT /api/memes/:id)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePutMeme(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 获取 Meme 原始文件 API (GET /api/memes/:id/content)
 *
 * 返回二进制流。如果提供了 size 参数则返回压缩缩略图。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handleGetMemeContent(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 添加标签 API (POST /api/tags)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostTags(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 获取所有标签 API (GET /api/tags)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handleGetTags(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 为 Meme 绑定新标签 API (POST /api/memes/:id/tags)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostMemeTags(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 解绑 Meme 标签 API (DELETE /api/memes/:id/tags/:tag_id)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handleDeleteMemeTags(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 导出 Meme API (POST /api/export)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostExport(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 删除恢复备份 API (POST /api/restore)
 *
 * 撤销软删除，将回收站项目还原至正文列表。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostRestore(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 手动清空回收站 API (POST /api/trash/empty)
 *
 * 强制执行物理删除，清理所有软删除数据及相关文件。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePostTrashEmpty(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 软删除 Meme API (DELETE /api/memes/:id)
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handleDeleteMeme(const HttpRequestProxy& req, HttpResponseProxy& res);

/**
 * @brief 热更新配置 API (PATCH /api/config)
 *
 * 解析 RuntimeConfigPatch，仅允许修改运行时支持重载的部分参数。
 *
 * @param req HttpRequestProxy
 * @param res HttpResponseProxy
 */
void handlePatchConfig(const HttpRequestProxy& req, HttpResponseProxy& res);

}  // namespace quickmemes
