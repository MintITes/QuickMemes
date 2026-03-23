# 后端数据库结构与 CRUD 总览

> **所属层级**：后端持久化层  
> **对应实现**：[src/backend/src/db/database.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/src/db/database.cpp)  
> **对应接口声明**：[src/backend/src/db/database.hpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/src/db/database.hpp)

---

## 目录

- [范围说明](#范围说明)
- [数据库对象总览](#数据库对象总览)
- [各表结构与操作](#各表结构与操作)
- [搜索与迁移逻辑](#搜索与迁移逻辑)
- [测试里直接触碰的 SQL](#测试里直接触碰的-sql)

---

## 范围说明

本文只整理后端数据库相关内容，包括：

- 真实表、虚拟表、触发器
- 查询、插入、更新、删除入口
- Schema 迁移和版本管理
- 测试里直接使用的 SQL

当前数据库 schema 的有效版本是 **v4**；`vec_memes` 属于历史旧表，已在 v4 迁移中移除。

---

## 数据库对象总览

| 对象 | 类型 | 作用 |
|---|---|---|
| `schema_version` | 普通表 | 记录已应用的迁移版本与时间 |
| `memes` | 普通表 | Meme 主数据表 |
| `memes_fts` | FTS5 虚拟表 | Meme 关键词全文索引 |
| `vec_meme_desc` | vec0 虚拟表 | 描述文本向量 |
| `vec_meme_ocr` | vec0 虚拟表 | OCR 文本向量 |
| `tags` | 普通表 | 标签字典表 |
| `meme_tags` | 关联表 | Meme 与 Tag 的多对多关系 |
| `categories` | 普通表 | 分类字典表 |
| `vec_memes` | 旧对象 | v4 已删除，仅保留迁移兼容痕迹 |

---

## 各表结构与操作

### `schema_version`

**结构**

- `version INTEGER PRIMARY KEY`
- `applied_at INTEGER NOT NULL`

**操作**

- 初始化时创建：`CREATE TABLE IF NOT EXISTS schema_version ...`
- 读取当前版本：`SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
- 写入迁移记录：v1 到 v4 都会插入一条版本记录

---

### `memes`

**结构**

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `file_path TEXT NOT NULL UNIQUE`
- `file_hash TEXT NOT NULL UNIQUE`
- `mime_type TEXT NOT NULL`
- `file_size INTEGER NOT NULL`
- `width INTEGER NOT NULL DEFAULT 0`
- `height INTEGER NOT NULL DEFAULT 0`
- `source_name TEXT NOT NULL DEFAULT ''`
- `source_url TEXT NOT NULL DEFAULT ''`
- `name TEXT NOT NULL DEFAULT ''`
- `description TEXT NOT NULL DEFAULT ''`
- `ocr_text TEXT NOT NULL DEFAULT ''`
- `ocr_status INTEGER NOT NULL DEFAULT 0`
- `ai_status INTEGER NOT NULL DEFAULT 0`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `last_used_at INTEGER NOT NULL DEFAULT 0`
- `deleted_at INTEGER NOT NULL DEFAULT 0`
- `category_id INTEGER DEFAULT 0`，由 v2 迁移追加

**索引**

- `idx_memes_file_hash`
- `idx_memes_created_at`
- `idx_memes_deleted_at`
- `idx_memes_category`

**操作**

- 插入：`insertMeme()`
- 单条查询：`getMeme()`
- 条件查询：`searchMemes()`
- 统计查询：`countMemes()`
- 回收站查询：`getDeletedMemes()`
- 回收站数量：`getDeletedMemesCount()`
- 更新：`updateMeme()`
- 处理状态更新：`updateMemeProcessing()`
- 最后使用时间更新：`updateMemeLastUsed()`
- 分类更新：`updateMemeCategory()`
- 软删除：`softDeleteMeme()`
- 恢复：`restoreMeme()`
- 永久删除：`deleteMeme()`
- 崩溃恢复：`recoverFromCrash()`

---

### `memes_fts`

**结构**

- FTS5 表字段：`name`、`description`、`ocr_text`
- 关联内容表：`content='memes'`
- 关联主键：`content_rowid='id'`

**操作**

- 关键词搜索：`searchMemes()` 中使用 `MATCH`
- 混合搜索：`searchMemes()` 会先用 FTS5 产生文本候选，再与 tag/category/vector 候选合并打分
- 自动同步：由 `memes_ai`、`memes_au`、`memes_ad` 三个触发器维护

---

### `vec_meme_desc`

**结构**

- `meme_id INTEGER PRIMARY KEY`
- `embedding float[维度]`

**操作**

- 插入或更新：`upsertDescriptionEmbedding()`
- 删除：`deleteDescriptionEmbedding()`
- 向量检索：`vectorSearch()` 查询该表；`searchMemes()` 在 `useVector=true` 时会将其作为混合打分的一部分
- 重建：`rebuildEmbeddingTables()`

---

### `vec_meme_ocr`

**结构**

- `meme_id INTEGER PRIMARY KEY`
- `embedding float[维度]`

**操作**

- 插入或更新：`upsertOcrEmbedding()`
- 删除：`deleteOcrEmbedding()`
- 重建：`rebuildEmbeddingTables()`

---

### `tags`

**结构**

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `name TEXT NOT NULL UNIQUE`
- `color TEXT NOT NULL DEFAULT ''`
- `created_at INTEGER NOT NULL`

**操作**

- 插入：`insertTag()`
- 查询：`getTags()`
- 删除：`deleteTag()`
- 关联查询：`getMemeTags()`
- 关键词搜索：`searchMemes()` 会把 `tags.name` 纳入匹配

---

### `meme_tags`

**结构**

- `meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE`
- `tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE`
- 联合主键：`PRIMARY KEY (meme_id, tag_id)`

**操作**

- 关联新增：`addMemeTag()`
- 关联删除：`removeMemeTag()`
- 关联查询：`getMemeTags()`
- 级联删除：删除 meme 或 tag 时由外键自动清理

---

### `categories`

**结构**

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `uuid TEXT NOT NULL UNIQUE`
- `name TEXT NOT NULL`
- `color TEXT NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `position INTEGER NOT NULL DEFAULT 0`，由 v3 迁移追加

**操作**

- 插入：`insertCategory()`
- 查询：`getCategories()`
- 更新：`updateCategory()`
- 删除：`deleteCategory()`
- Meme 分类更新：`updateMemeCategory()`

**删除行为**

- 删除分类时，会先把 `memes.category_id` 置回 `0`
- 然后再删除 `categories` 记录

---

## 搜索与迁移逻辑

### 关键词搜索实际覆盖范围

`searchMemes()` 的关键词阶段会先基于硬过滤缩小候选集，再分别计算：

- `nameScore`
- `descriptionScore`
- `ocrScore`
- `tagNameScore`
- `categoryNameScore`
- `vectorDescriptionScore`
- `vectorOcrScore`

最终通过 `search.weights.*` 做归一化加权，得到 `relevanceScore`。

### 分类过滤

- `categoryId = 0`：不加分类过滤
- `categoryId > 0`：过滤具体分类
- `categoryId = -1`：过滤“无分类、无 tag、无 OCR”的条目

### 迁移阶段

- v1：创建 `memes`、`memes_fts`、`vec_meme_desc`、`vec_meme_ocr`、`tags`、`meme_tags`
- v2：新增 `categories`，并给 `memes` 加 `category_id`
- v3：给 `categories` 加 `position`
- v4：拆分向量表，废弃旧的 `vec_memes`

---

## 测试里直接触碰的 SQL

- [src/backend/tests/db/test_search.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/tests/db/test_search.cpp) 会直接查 `vec_meme_desc` 和 `vec_meme_ocr`
- [src/backend/tests/core/test_core_fixes.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/tests/core/test_core_fixes.cpp) 会直接查 `schema_version` 和 `sqlite_master`
- [src/backend/tests/db/test_soft_delete.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/tests/db/test_soft_delete.cpp) 会直接更新 `memes.deleted_at`
- [src/backend/tests/core/test_trash_purge.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/tests/core/test_trash_purge.cpp) 会直接更新 `memes.deleted_at`

---

## 代码入口

- 表结构和迁移逻辑：`runMigrations()`，见 [database.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/src/db/database.cpp#L1077)
- 查询构建：`buildSearchSql()`，见 [database.cpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/src/db/database.cpp#L1300)
- 接口声明：见 [database.hpp](/home/NekoType/Code/Projects/QuickMemes/QuickMemes/src/backend/src/db/database.hpp#L62)
