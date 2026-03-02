# QuickMemes 后续优化清单

> 本文件记录当前架构中已识别但暂不实施的优化项，后续开发中按需处理。

---

## 性能优化

### `recommendMemes` 索引表构建优化

**现状**：每次调用 `handleRecommendMemes` 时从数据库查询所有未软删除的 Meme 构建 `MemeIndexItem[]` 列表，全表扫描 + 序列化开销随数据量增长。

**优化方案**：

---

### FTS5 触发器批量导入性能

**现状**：`memes` 表有 3 个 FTS5 同步触发器（INSERT / UPDATE / DELETE），批量导入时每条记录都会触发索引更新。

**优化方案**：在批量导入期间禁用触发器，导入完成后执行一次批量 FTS5 rebuild。

---

## 功能完善

### AI 端点速率限制 / 并发控制

**现状**：C++ HTTP 服务器对所有请求无速率限制，前端 bug 可能导致重复请求风暴触发 API 限额。

**优化方案**：
- 对 AI 相关端点（`/api/ai/generate-image`、`/api/ai/recommend`、`/api/admin/rebuild-embeddings`）增加并发限制（如同时只允许 1 个 `rebuild-embeddings` 任务）
- 前端搜索增加 debounce（搜索框输入 300ms debounce）

---
