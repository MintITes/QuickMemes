#pragma once
/**
 * @file database.hpp
 * @brief 持久化模块接口声明
 *
 * 严格对应 docs/arch/persistence.md 全部函数规范。
 * 封装所有 SQLite 数据库读写操作，通过 SQLiteCpp 管理
 * Meme 条目、标签及关联关系，并通过 sqlite-vec 支持向量搜索。
 */

#include "types.hpp"
#include "api_types.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

// 前向声明 SQLiteCpp 类型
namespace SQLite { class Database; }

namespace quickmemes {

/**
 * @brief 数据库查询构建内部结构
 *
 * buildSearchSql() 的输出，包含动态拼接的 WHERE 子句和绑定参数。
 */
struct SearchSql {
    std::vector<std::string> whereClauses;  ///< WHERE 条件片段（AND 拼接）
    std::vector<std::string> params;        ///< 绑定参数值
    std::string orderBy;                    ///< ORDER BY 子句
    std::string limitOffset;                ///< LIMIT/OFFSET 子句
};

/**
 * @brief 数据库迁移步骤
 */
struct MigrationStep {
    int         version;  ///< 目标 Schema 版本号
    std::string sql;      ///< 迁移 DDL SQL 语句
};

/**
 * @brief 持久化模块
 *
 * 单例类，封装 SQLite 数据库的初始化、CRUD、全文搜索、向量搜索、
 * 备份恢复等全部操作。
 */
class Database {
public:
    Database();
    ~Database();

    // ── 初始化与关闭 ──

    /**
     * @brief 打开数据库连接并执行 Schema 迁移
     *
     * 1. 使用 SQLiteCpp 打开（不存在则创建）指定路径的数据库文件
     * 2. 启用 WAL 模式和外键约束
     * 3. 加载 sqlite-vec 扩展
     * 4. 调用 runMigrations() 执行 Schema 迁移
     *
     * @param dbPath std::string SQLite 数据库文件绝对路径
     * @return bool 成功返回 true；失败返回 false
     */
    bool initialize(const std::string& dbPath);

    /**
     * @brief 关闭数据库连接并释放资源
     *
     * 执行 PRAGMA optimize 后关闭 Database 对象。
     */
    void shutdown();

    // ── Meme CRUD ──

    /**
     * @brief 插入新 Meme 记录
     *
     * 开启事务，插入 memes 表后返回自增 ID。
     * 哈希重复时抛出 ERR_DUPLICATE。
     *
     * @param meme MemeEntry 完整数据对象（id 字段忽略）
     * @return int64_t 新记录的自增 ID
     * @throws ApiException(ERR_DUPLICATE) 文件哈希已存在
     */
    int64_t insertMeme(const MemeEntry& meme);

    /**
     * @brief 按 ID 查询单个 Meme
     *
     * 同时通过 JOIN meme_tags 查询关联的 tagIds 列表。
     *
     * @param id int64_t Meme ID
     * @return MemeEntry 完整数据（含 tagIds）
     * @throws ApiException(ERR_NOT_FOUND) 不存在
     */
    MemeEntry getMeme(int64_t id);

    /**
     * @brief 按条件搜索 Meme 列表
     *
     * 调用 buildSearchSql() 动态构建 SQL，默认过滤已软删除记录。
     *
     * @param query SearchQuery 搜索参数
     * @return std::vector<MemeEntry> 匹配结果列表
     */
    std::vector<MemeEntry> searchMemes(const SearchQuery& query);

    /**
     * @brief 按语义向量相似度查询 Meme
     *
     * 对 vec_memes 虚拟表执行 KNN 余弦相似度查询。
     *
     * @param embedding std::vector<float> 查询向量
     * @param limit int 返回数量上限
     * @return std::vector<MemeEntry> 按相似度排序的结果
     */
    std::vector<MemeEntry> vectorSearch(const std::vector<float>& embedding, int limit);

    /**
     * @brief 更新 Meme 字段
     *
     * 根据 patch 中存在的字段动态构建 UPDATE SQL。
     *
     * @param id int64_t Meme ID
     * @param patch MemePatch 仅含变更字段
     * @return bool 更新成功返回 true；ID 不存在返回 false
     */
    bool updateMeme(int64_t id, const MemePatch& patch);

    /**
     * @brief 软删除 Meme（设置 deleted_at）
     * @param id int64_t Meme ID
     * @return bool 操作成功返回 true；ID 不存在返回 false
     */
    bool softDeleteMeme(int64_t id);

    /**
     * @brief 从回收站恢复 Meme
     * @param id int64_t Meme ID
     * @return bool 恢复成功返回 true
     */
    bool restoreMeme(int64_t id);

    /**
     * @brief 彻底清理过期软删除记录
     * @param olderThanDays int 超过该天数的记录被清理
     * @return int 清理的记录数
     */
    int purgeDeletedMemes(int olderThanDays);

    /**
     * @brief 彻底删除 Meme 数据库记录
     *
     * 仅由内部清理任务调用，级联删除关联和向量。
     *
     * @param id int64_t Meme ID
     * @return bool 删除成功返回 true
     */
    bool deleteMeme(int64_t id);

    // ── 标签操作 ──

    /**
     * @brief 插入新标签
     * @param tag Tag 标签数据（id 忽略）
     * @return int64_t 新标签的自增 ID
     * @throws ApiException(ERR_DUPLICATE) 名称已存在
     */
    int64_t insertTag(const Tag& tag);

    /**
     * @brief 获取全部标签列表
     * @return std::vector<Tag> 按名称字典序排序
     */
    std::vector<Tag> getTags();

    /**
     * @brief 获取指定 Meme 的所有标签
     * @param memeId int64_t Meme ID
     * @return std::vector<Tag> 标签列表
     */
    std::vector<Tag> getMemeTags(int64_t memeId);

    /**
     * @brief 为 Meme 添加标签关联
     * @param memeId int64_t Meme ID
     * @param tagId int64_t Tag ID
     * @return bool 操作成功返回 true
     */
    bool addMemeTag(int64_t memeId, int64_t tagId);

    /**
     * @brief 移除 Meme 的标签关联
     * @param memeId int64_t Meme ID
     * @param tagId int64_t Tag ID
     * @return bool 删除成功返回 true；关联不存在返回 false
     */
    bool removeMemeTag(int64_t memeId, int64_t tagId);

    // ── 向量操作 ──

    /**
     * @brief 插入或更新 Meme 的 embedding 向量
     * @param memeId int64_t Meme ID
     * @param embedding std::vector<float> 语义向量
     */
    void upsertEmbedding(int64_t memeId, const std::vector<float>& embedding);

    /**
     * @brief 重建 vec_memes 虚拟表
     *
     * 当 Embedding 模型切换导致维度变化时调用。
     *
     * @param newDimension int 新的向量维度
     */
    void rebuildVecTable(int newDimension);

    // ── 备份与完整性 ──

    /**
     * @brief 创建数据库备份
     *
     * 使用 VACUUM INTO 创建备份文件到 {dbPath}.bak.{timestamp}。
     *
     * @return std::string 备份文件绝对路径
     */
    std::string backupDatabase();

    /**
     * @brief 从备份恢复数据库
     * @param backupPath std::string 备份文件绝对路径
     * @return bool 恢复成功返回 true
     */
    bool restoreDatabase(const std::string& backupPath);

    /**
     * @brief 检查数据库完整性
     *
     * 执行 PRAGMA integrity_check。
     *
     * @return bool 数据库完整返回 true
     */
    bool checkIntegrity();

private:
    /**
     * @brief 执行 Schema 迁移
     *
     * 依次执行所有版本号大于当前版本的迁移步骤。
     * 迁移前自动调用 backupDatabase()。
     */
    void runMigrations();

    /**
     * @brief 动态构建搜索 SQL
     * @param query SearchQuery 搜索参数
     * @return SearchSql 包含 WHERE 子句和绑定参数
     */
    SearchSql buildSearchSql(const SearchQuery& query);

    std::unique_ptr<SQLite::Database> db_;  ///< SQLiteCpp 数据库实例
    std::string dbPath_;                    ///< 数据库文件路径
};

}  // namespace quickmemes
