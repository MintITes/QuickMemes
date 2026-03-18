# QuickMemes 技术架构总索引

> 本文件为 QuickMemes 项目技术规划主索引，包含全局架构图、全局共享数据结构，以及各模块的职责描述与对外接口摘要。  
> 各模块详细规划请通过各节末尾链接跳转至对应 B 文件查阅。

---

## 目录

- [QuickMemes 技术架构总索引](#quickmemes-技术架构总索引)
  - [目录](#目录)
  - [全局架构图](#全局架构图)
  - [全局共享数据结构](#全局共享数据结构)
    - [`MemeEntry` — Meme 条目](#memeentry--meme-条目)
    - [`Category` — 分类](#category--分类)
    - [`Tag` — 标签](#tag--标签)
    - [`SearchQuery` — 搜索查询参数](#searchquery--搜索查询参数)
    - [`ImportTask` — 导入任务](#importtask--导入任务)
    - [`AiAnalysisResult` — AI 分析结果](#aianalysisresult--ai-分析结果)
  - [模块索引](#模块索引)
    - [前端模块](#前端模块)
    - [通信协议模块](#通信协议模块)
    - [C++ 核心模块](#c-核心模块)
    - [Vision 模块](#vision-模块)
    - [持久化模块](#持久化模块)
    - [日志模块](#日志模块)
    - [配置文件模块](#配置文件模块)

---

## 全局架构图

> 此图描述各层次之间的进程拓扑、数据流向以及各模块对外暴露的核心接口函数。

```mermaid
graph TD
    %% ── 前端层 ──
    subgraph FRONT ["前端层（Electron + TypeScript + React + Tailwind CSS）"]
        direction TB
        ELECTRON["前端 Electron 主进程
        ──────────────────
        launchBackend()
        killBackend()
        onBackendExit()"]
        REACT["React 渲染进程
        ──────────────────
        sendHttpRequest()
        connectWebSocket()
        disconnectWebSocket()"]
        ELECTRON <-->|"contextBridge / IPC"| REACT
    end

    %% ── 通信层 ──
    subgraph COMM ["通信层（Boost.Beast HTTP REST + WebSocket）"]
        direction TB
        HTTP_API["HTTP REST 接口
        ──────────────────
        GET    /api/health
        POST   /api/import
        POST   /api/import/cancel
        POST   /api/memes/search
        GET    /api/meme/:id
        GET    /api/meme/:id/file
        GET    /api/meme/:id/thumbnail
        PUT    /api/meme/:id
        POST   /api/meme/:id/use
        DELETE /api/meme/:id
        GET    /api/tags
        POST   /api/tags
        DELETE /api/tags/:id
        POST   /api/meme/:id/tags
        DELETE /api/meme/:id/tags/:tagId
        POST   /api/export
        DELETE /api/memes/batch
        POST   /api/memes/batch/tags
        PATCH  /api/config
        POST   /api/admin/rebuild-embeddings
        POST   /api/meme/:id/restore
        GET    /api/memes/trash
        DELETE /api/memes/trash/purge
        GET    /api/categories
        POST   /api/categories
        PUT    /api/categories/:id
        DELETE /api/categories/:id
        POST   /api/memes/batch/category"]
        WS["WebSocket 推送事件
        ──────────────────
        task:progress
        task:complete
        task:error
        meme:added
        meme:updated
        meme:deleted
        meme:processing
        meme:used
        tag:created
        tag:deleted
        category:created
        category:updated
        category:deleted
        ping（心跳）"]
    end

    %% ── C++ 后端层 ──
    subgraph BACKEND ["C++ 后端层"]
        direction TB
        CORE["C++ 核心模块
        ──────────────────
        startServer(bindAddress, port)
        stopServer()
        handleHealth()
        handleImport()
        handleSearch()
        handleMemeGet()
        handleMemeFile()
        handleMemeThumbnail()
        handleMemeUpdate()
        handleMemeUse()
        handleMemeDelete()
        handleBatchDelete()
        handleBatchTags()
        handleExport()
        handleConfigUpdate()
        handleRebuildEmbeddings()
        handleGetCategories()
        handleCreateCategory()
        handleUpdateCategory()
        handleDeleteCategory()
        handleBatchCategory()
        pushEvent()"]

        VISION_MOD["Vision 模块
        ──────────────────
        recognize()
        analyzeImage()
        generateEmbedding()
        isAvailable()"]

        DB_MOD["持久化模块
        ──────────────────
        insertMeme()
        getMeme()
        searchMemes()
        vectorSearch()
        updateMeme()
        softDeleteMeme()
        purgeDeletedMemes()
        insertTag()
        getTags()
        getMemeTags()
        addMemeTag()
        removeMemeTag()
        backupDatabase()
        restoreDatabase()
        insertCategory()
        updateCategory()
        deleteCategory()
        getCategories()
        updateMemeCategory()"]

        CORE --> VISION_MOD
        CORE --> DB_MOD
    end

    %% ── 横切模块 ──
    subgraph CROSS ["横切模块"]
        direction TB
        CONFIG_MOD["配置文件模块
        ──────────────────
        loadConfig()
        saveConfig()
        getConfig()
        setConfig()
        validateConfig()"]

        LOGGER_MOD["日志模块
        ──────────────────
        前端: logInfo() / logError() ...
        C++: LOG_INFO() / LOG_ERROR() ...
        写入 logs/{module}-{date}.log"]
    end

    %% ── 外部服务 ──
    CLOUD(("云端 OCR / LLM / VLM API"))

    %% ── 连接关系 ──
    ELECTRON -->|"spawn with CLI args"| CORE
    CONFIG_MOD -->|"buildBackendArgs()"| ELECTRON
    REACT <-->|"HTTP 请求 / 响应（携带 Auth Token）"| HTTP_API
    WS -->|"推送事件"| REACT
    HTTP_API <-->|"路由调度（校验 Token）"| CORE
    CORE -->|"推送"| WS
    VISION_MOD -.->|"HTTPS REST"| CLOUD
    FRONT -.->|"log()"| LOGGER_MOD
    BACKEND -.->|"LOG_XXX()"| LOGGER_MOD
```

---

## 全局共享数据结构

> 以下数据结构在多个模块间共享传递，采用 `nlohmann/json` 序列化后通过 HTTP/WebSocket 跨进程传输。  
> C++ 端以 `struct` 定义，前端以 `TypeScript interface` 对应映射。

---

### `MemeEntry` — Meme 条目

```
MemeEntry {
    id          : int64            // 数据库自增主键
    filePath    : string           // 本地文件相对路径
    fileHash    : string           // SHA-256 文件哈希（用于去重）
    mimeType    : string           // 文件 MIME 类型，如 "image/png"
    fileSize    : int64            // 文件大小，单位字节
    width       : int32            // 图像宽度（像素）
    height      : int32            // 图像高度（像素）
    sourceName  : string           // 来源名称，如 "Twitter"（可为空）
    sourceUrl   : string           // 来源 URL（可为空）
    name        : string           // 用户自定义名称（可为空，默认文件名）
    description : string           // 用户自定义描述（可为空）
    ocrText     : string           // OCR 识别出的全文（可为空）
    ocrStatus   : ProcessingStatus // OCR 处理状态
    aiStatus    : ProcessingStatus // AI 分析处理状态
    tagIds      : int64[]          // 关联标签 ID 列表
    tags        : Tag[]            // 关联标签完整对象列表（可选）
    createdAt   : int64            // Unix 时间戳（毫秒）
    updatedAt   : int64            // Unix 时间戳（毫秒）
    lastUsedAt  : int64            // 最后使用时间戳（毫秒，0 表示未使用）
    deletedAt   : int64            // 软删除时间戳（毫秒，0 表示未删除）
    categoryId  : int64            // 所属分类 ID（0 表示未分类）
}

// ProcessingStatus 枚举
ProcessingStatus : "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "SKIPPED"

// 注意：MemeEntry 结构体不含 embedding 向量字段。
// embedding 仅在 AiAnalysisResult 中携带并通过持久化模块的 upsertEmbedding() 独立写入 vec_memes 表，
// HTTP 响应中不包含向量数据，以减少网络传输开销。
// 向量搜索时，结果中会包含 similarityScore 字段。
```

---

### `Category` — 分类

```
Category {
    id        : int64    // 数据库自增主键
    uuid      : string   // UUID v4
    name      : string   // 分类名称（可重名）
    color     : string   // 显示颜色，HEX 格式
    position  : int64    // 自定义排序位置，值越小越靠前
    createdAt : int64    // Unix 时间戳（毫秒）
    updatedAt : int64    // Unix 时间戳（毫秒）
}
```

---

### `Tag` — 标签

```
Tag {
    id        : int64    // 数据库自增主键
    name      : string   // 标签名称，全局唯一
    color     : string   // 显示颜色，HEX 格式，如 "#FF5733"（可为空）
    createdAt : int64    // Unix 时间戳（毫秒）
}
```

---

### `SearchQuery` — 搜索查询参数

```
SearchQuery {
    keyword    : string    // 关键词，用于模糊匹配名称/描述/OCR 文本（可为空）
    tagIds     : int64[]   // 按标签过滤（空表示不过滤）
    categoryId : int64     // 按分类过滤（0 表示不过滤，-1 表示未分类，正数为具体分类 ID）
    source     : string    // 按来源名称过滤（可为空）
    timeFrom   : int64     // 时间范围起始时间戳（毫秒，0 表示不限）
    timeTo     : int64     // 时间范围结束时间戳（毫秒，0 表示不限）
    formats    : string[]  // 文件格式过滤，如 ["image/gif"]（空表示不过滤）
    sizeMin    : int64     // 最小文件大小（字节，0 表示不限）
    sizeMax    : int64     // 最大文件大小（字节，0 表示不限）
    regex        : string    // 正则表达式，匹配名称/描述/OCR 文本（可为空）
    useVector    : bool      // 是否启用语义向量搜索
    sortBy       : string    // 排序字段："createdAt" | "name" | "fileSize" | "updatedAt" | "lastUsedAt"
    sortOrder    : string    // 排序方向："ASC" | "DESC"
    limit        : int32     // 每页结果数量（默认 50，最大 200）
    offset       : int32     // 分页偏移量（默认 0）
}
```

---

### `ImportTask` — 导入任务

```
ImportTask {
    taskId     : string        // UUID，唯一任务标识
    source     : ImportSource  // 导入来源枚举
    inputs     : string[]      // 输入内容列表（URL 列表 / 文件路径列表）
    status     : TaskStatus    // 当前状态枚举
    total      : int32         // 总任务数
    processed  : int32         // 已处理数
    succeeded  : int32         // 成功数
    failed     : int32         // 失败数
    errors     : string[]      // 各失败项的错误描述
    createdAt  : int64         // 任务创建时间戳（毫秒）
}

// ImportSource 枚举
ImportSource : "URL" | "CLIPBOARD" | "LOCAL_FILE" | "SCREENSHOT" | "DRAG_DROP"

// TaskStatus 枚举
TaskStatus : "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "CANCELLED"
```

---

### `AiAnalysisResult` — AI 分析结果

```
AiAnalysisResult {
    suggestedTags : string[]  // AI 建议的标签列表
    description   : string    // AI 生成的描述文本
    embedding     : float[]   // 语义向量（维度由配置的模型决定）
    success       : bool      // 是否成功
    error         : string    // 失败时的错误描述（可为空）
}
```

---

> 其余协议专用数据结构（`ImportRequest`、`MemePatch`、`ExportRequest`、`ExportResult`、`RuntimeConfigPatch` 等）定义于 [ipc_protocol.md](../03-Modules/ipc_protocol.md#模块独有数据结构)。
> 云端 OCR 识别结果数据结构 `OcrResult` 定义于 [vision.md](../03-Modules/vision.md#ocrresult--ocr-识别结果)。

---

## 模块索引

---

### 前端模块

**职责**：管理 Electron 主进程生命周期（包括 C++ 后端子进程的启动与销毁），提供 React 渲染进程的 UI 展示、用户交互响应、全局快捷键绑定及剪贴板操作。

**对外接口（Electron 主进程，暴露给渲染进程）**

| 函数签名                                                              | 说明                       | 参数                                      | 返回值                                     |
| --------------------------------------------------------------------- | -------------------------- | ----------------------------------------- | ------------------------------------------ |
| `launchBackend(): Promise<void>`                                      | 启动 C++ 后端子进程        | 无                                        | 启动成功后 resolve                         |
| `killBackend(): Promise<void>`                                        | 终止 C++ 后端子进程        | 无                                        | 终止完成后 resolve                         |
| `onBackendExit(callback: (code: number) => void): void`               | 监听后端进程退出事件       | `callback`：退出回调函数                  | 无                                         |
| `readClipboardImage(): Promise<string \| null>`                       | 读取剪贴板中的图像数据     | 无                                        | Base64 编码图像字符串，无图像时返回 `null` |
| `writeClipboardImage(filePath: string): Promise<void>`                | 将图像写入剪贴板           | `filePath`：本地文件路径                  | 无                                         |
| `registerGlobalShortcut(key: string, callback: () => void): void`     | 注册全局快捷键             | `key`：快捷键字符串；`callback`：触发回调 | 无                                         |
| `unregisterGlobalShortcut(key: string): void`                         | 注销全局快捷键             | `key`：快捷键字符串                       | 无                                         |
| `showMemePanel(): void`                                               | 显示 Meme 快速取用面板窗口 | 无                                        | 无                                         |
| `hideMemePanel(): void`                                               | 隐藏 Meme 快速取用面板窗口 | 无                                        | 无                                         |
| `openFileDialog(options: FileDialogOptions): Promise<string[]>`       | 打开系统文件选择对话框     | `options`：过滤器等配置                   | 用户选择的文件路径列表                     |
| `saveFileDialog(options: SaveDialogOptions): Promise<string \| null>` | 打开系统文件保存对话框     | `options`：默认文件名等配置               | 用户选择的保存路径                         |

> 📄 详细规划 → [docs/arch/frontend.md](../03-Modules/frontend.md)

---

### 通信协议模块

**职责**：定义前端 React 与 C++ 后端之间通信的完整协议，包括 HTTP REST 端点规范和 WebSocket 推送事件规范。前端通过启动时生成的随机 Auth Token 校验请求来源。本模块不包含业务逻辑，仅作协议契约。

**对外接口（HTTP REST，由 C++ 后端暴露）**

| 端点                            | 方法     | 说明                                 |
| ------------------------------- | -------- | ------------------------------------ |
| `/api/health`                   | `GET`    | 健康检查（各子模块就绪状态）         |
| `/api/import`                   | `POST`   | 提交导入任务                         |
| `/api/import/cancel`            | `POST`   | 取消当前正在处理的导入任务           |
| `/api/memes/search`             | `POST`   | 搜索 Meme 列表                       |
| `/api/meme/:id`                 | `GET`    | 获取单个 Meme                        |
| `/api/meme/:id/file`            | `GET`    | 获取 Meme 原始图像文件（二进制流）   |
| `/api/meme/:id/thumbnail`       | `GET`    | 获取 Meme 缩略图（二进制流）         |
| `/api/meme/:id`                 | `PUT`    | 更新 Meme 元数据                     |
| `/api/meme/:id/use`             | `POST`   | 记录 Meme 使用（复制到剪贴板时调用） |
| `/api/meme/:id`                 | `DELETE` | 软删除 Meme（移入回收站）            |
| `/api/meme/:id/restore`         | `POST`   | 从回收站恢复 Meme                    |
| `/api/memes/trash`              | `GET`    | 获取回收站中的 Meme 列表             |
| `/api/memes/trash/purge`        | `DELETE` | 手动清空回收站                       |
| `/api/tags`                     | `GET`    | 获取全部标签                         |
| `/api/tags`                     | `POST`   | 创建新标签                           |
| `/api/tags/:id`                 | `DELETE` | 删除标签                             |
| `/api/meme/:id/tags`            | `POST`   | 为 Meme 添加标签                     |
| `/api/meme/:id/tags/:tagId`     | `DELETE` | 移除 Meme 的标签                     |
| `/api/export`                   | `POST`   | 导出 Meme 到本地文件                 |
| `/api/memes/batch`              | `DELETE` | 批量软删除 Meme                      |
| `/api/memes/batch/tags`         | `POST`   | 批量为 Meme 添加标签                 |
| `/api/config`                   | `PATCH`  | 运行时配置热更新                     |
| `/api/admin/rebuild-embeddings` | `POST`   | 重建所有 Meme 的语义向量（异步任务） |

**WebSocket 推送事件（C++ 后端 → 前端）**

| 事件名            | 说明                                       |
| ----------------- | ------------------------------------------ |
| `task:progress`   | 导入/处理任务进度更新                      |
| `task:complete`   | 任务完成通知                               |
| `task:error`      | 任务失败通知                               |
| `meme:added`      | 新 Meme 已入库通知                         |
| `meme:updated`    | Meme 元数据更新通知                        |
| `meme:deleted`    | Meme 已删除通知                            |
| `meme:processing` | Meme OCR/AI 处理状态变更通知               |
| `meme:used`       | Meme 使用记录更新通知（含 id, lastUsedAt） |
| `tag:created`     | 新标签已创建通知                           |
| `tag:deleted`     | 标签已删除通知                             |
| `ping`            | 心跳帧（每 30 秒，客户端回复 pong）        |

> 📄 详细规划 → [docs/arch/ipc_protocol.md](../03-Modules/ipc_protocol.md)

---

### C++ 核心模块

**职责**：作为整个后端的调度中枢，启动 HTTP 服务器和 WebSocket 服务器，将前端的请求路由到对应处理逻辑，并协调 Vision、持久化两个子模块完成业务处理，通过 WebSocket 向前端推送异步事件。

**对外接口（HTTP 路由处理函数）**

| 函数签名                                                       | 说明                                | 参数                             | 返回值               |
| -------------------------------------------------------------- | ----------------------------------- | -------------------------------- | -------------------- |
| `startServer(config: ServerConfig): bool`                      | 启动 HTTP + WebSocket 服务器        | `config`：服务器配置             | 启动成功返回 `true`  |
| `stopServer(): void`                                           | 停止服务器并释放资源                | 无                               | 无                   |
| `handleHealth(): HealthStatus`                                 | 返回各子模块就绪状态                | 无                               | 健康状态对象         |
| `handleImport(req: ImportRequest): ImportTask`                 | 处理导入请求，先入库后异步 OCR/AI   | `req`：导入请求参数              | 创建的 `ImportTask`  |
| `handlePostImportCancel(req: HttpRequestProxy): bool`          | 取消正在进行的导入任务              | `req`：包含 taskId 的请求体      | 操作成功返回 `true`  |
| `handleSearch(query: SearchQuery): SearchResult`               | 处理搜索请求                        | `query`：搜索参数                | 带分数的 Meme 列表   |
| `handleMemeGet(id: int64): MemeEntry`                          | 获取单个 Meme                       | `id`：Meme ID                    | 对应 `MemeEntry`     |
| `handleMemeFile(id: int64): BinaryStream`                      | 返回 Meme 原始图像二进制流          | `id`：Meme ID                    | 图像二进制流         |
| `handleMemeThumbnail(id: int64): BinaryStream`                 | 返回 Meme 缩略图二进制流            | `id`：Meme ID                    | 缩略图二进制流       |
| `handleMemeUpdate(id: int64, patch: MemePatch): MemeEntry`     | 更新 Meme 元数据                    | `id`：Meme ID；`patch`：变更字段 | 更新后的 `MemeEntry` |
| `handleMemeUse(id: int64): bool`                               | 记录 Meme 使用                      | `id`：Meme ID                    | 操作成功返回 `true`  |
| `handleMemeDelete(id: int64): bool`                            | 软删除 Meme（移入回收站）           | `id`：Meme ID                    | 操作成功返回 `true`  |
| `handleMemeRestore(id: int64): MemeEntry`                      | 从回收站恢复 Meme                   | `id`：Meme ID                    | 恢复后的 `MemeEntry` |
| `handleGetTrash(limit, offset): SearchResult`                  | 获取回收站 Meme 列表                | `limit`/`offset`：分页参数       | 回收站 Meme 列表     |
| `handlePurgeTrash(): int`                                      | 手动清空回收站                      | 无                               | 清理的记录数         |
| `handleBatchDelete(ids: int64[]): BatchResult`                 | 批量软删除 Meme                     | `ids`：Meme ID 列表              | 批量操作结果         |
| `handleBatchTags(memeIds: int64[], tagId: int64): BatchResult` | 批量为 Meme 添加标签                | `memeIds`：Meme ID 列表；`tagId` | 批量操作结果         |
| `handleGetTags(): Tag[]`                                       | 获取全部标签                        | 无                               | 标签列表             |
| `handleCreateTag(name, color): Tag`                            | 创建新标签                          | `name`/`color`                   | 新创建的 `Tag`       |
| `handleDeleteTag(id: int64): bool`                             | 删除标签（级联移除关联）            | `id`：Tag ID                     | 操作成功返回 `true`  |
| `handleAddMemeTag(memeId, tagId): bool`                        | 为 Meme 添加标签                    | `memeId`/`tagId`                 | 操作成功返回 `true`  |
| `handleRemoveMemeTag(memeId, tagId): bool`                     | 移除 Meme 的标签                    | `memeId`/`tagId`                 | 操作成功返回 `true`  |
| `handleExport(req: ExportRequest): ExportResult`               | 导出 Meme 到本地路径                | `req`：导出目标路径等参数        | 导出结果             |
| `handleConfigUpdate(patch: RuntimeConfigPatch): bool`          | 运行时配置热更新                    | `patch`：变更字段                | 更新成功返回 `true`  |
| `handleRebuildEmbeddings(): ImportTask`                        | 重建所有 Meme 语义向量（异步）      | 无                               | 重建任务对象         |
| `pushEvent(event: WsEvent): void`                              | 向所有已连接前端推送 WebSocket 事件 | `event`：事件对象                | 无                   |

> 📄 详细规划 → [docs/arch/cpp_core.md](../03-Modules/cpp_core.md)

---

### Vision 模块

**职责**：封装对云端第三方 OCR API 和 LLM / VLM API 的调用，提供三项核心能力：OCR 文字识别（云端 OCR API，占位接口）、图像内容分析（打标签/描述生成）、文本转语义向量（用于 sqlite-vec 相似度搜索）。包含网络不可用时的降级策略。

**对外接口**

| 函数签名                                            | 说明                                            | 参数                   | 返回值                |
| --------------------------------------------------- | ----------------------------------------------- | ---------------------- | --------------------- |
| `initialize(config: VisionConfig): bool`            | 初始化 Vision 模块，配置 API Key 和模型参数     | `config`：API 配置对象 | 初始化成功返回 `true` |
| `recognize(imagePath: string): OcrResult`           | 通过云端 OCR API 识别图像文字（占位接口）       | `imagePath`：图像路径  | `OcrResult`           |
| `analyzeImage(imagePath: string): AiAnalysisResult` | 对图像进行多模态分析，返回标签和描述            | `imagePath`：图像路径  | `AiAnalysisResult`    |
| `generateEmbedding(text: string): float[]`          | 将文本转换为语义向量                            | `text`：输入文本       | 浮点数向量            |
| `isAvailable(): bool`                               | 检查 AI 服务当前是否可用（网络连通 + 配置有效） | 无                     | 可用返回 `true`       |
| `isOcrAvailable(): bool`                            | 检查云端 OCR 服务是否可用                       | 无                     | 可用返回 `true`       |
| `shutdown(): void`                                  | 释放 HTTP 客户端资源                            | 无                     | 无                    |

> 📄 详细规划 → [docs/arch/vision.md](../03-Modules/vision.md)

---

### 持久化模块

**职责**：封装所有 SQLite 数据库读写操作，通过 SQLiteCpp 管理 Meme 条目、标签及其关联关系；通过 sqlite-vec 扩展支持语义向量的存储与相似度查询；提供软删除回收站机制和数据库自动备份/恢复功能。

**对外接口**

| 函数签名                                                    | 说明                             | 参数                                     | 返回值                |
| ----------------------------------------------------------- | -------------------------------- | ---------------------------------------- | --------------------- |
| `initialize(dbPath: string): bool`                          | 打开数据库连接，执行建表迁移     | `dbPath`：数据库文件路径                 | 初始化成功返回 `true` |
| `insertMeme(meme: MemeEntry): int64`                        | 插入新 Meme 记录                 | `meme`：Meme 数据对象                    | 新记录的 ID           |
| `getMeme(id: int64): MemeEntry`                             | 按 ID 查询单个 Meme              | `id`：Meme ID                            | `MemeEntry`           |
| `searchMemes(query: SearchQuery): MemeEntry[]`              | 按条件搜索 Meme 列表             | `query`：搜索参数                        | 匹配结果列表          |
| `vectorSearch(embedding: float[], limit: int): MemeEntry[]` | 按语义向量相似度查询 Meme        | `embedding`：查询向量；`limit`：返回数量 | 相似度排序结果列表    |
| `updateMeme(id: int64, patch: MemePatch): bool`             | 更新 Meme 字段                   | `id`：Meme ID；`patch`：变更字段集合     | 更新成功返回 `true`   |
| `updateMemeLastUsed(id: int64): bool`                       | 更新 Meme 最后使用时间           | `id`：Meme ID                            | 更新成功返回 `true`   |
| `softDeleteMeme(id: int64): bool`                           | 软删除 Meme（设置 `deleted_at`） | `id`：Meme ID                            | 操作成功返回 `true`   |
| `restoreMeme(id: int64): bool`                              | 从回收站恢复 Meme                | `id`：Meme ID                            | 恢复成功返回 `true`   |
| `purgeDeletedMemes(olderThanDays: int): int`                | 彻底清理过期软删除记录           | `olderThanDays`：超过天数                | 清理的记录数          |
| `insertTag(tag: Tag): int64`                                | 插入新标签记录                   | `tag`：标签数据对象                      | 新标签 ID             |
| `getTags(): Tag[]`                                          | 获取全部标签列表                 | 无                                       | 标签列表              |
| `getMemeTags(memeId: int64): Tag[]`                         | 获取指定 Meme 的所有标签         | `memeId`：Meme ID                        | 标签列表              |
| `addMemeTag(memeId: int64, tagId: int64): bool`             | 为 Meme 添加标签关联             | `memeId`：Meme ID；`tagId`：Tag ID       | 操作成功返回 `true`   |
| `removeMemeTag(memeId: int64, tagId: int64): bool`          | 移除 Meme 的标签关联             | `memeId`：Meme ID；`tagId`：Tag ID       | 操作成功返回 `true`   |
| `backupDatabase(): string`                                  | 创建数据库备份文件               | 无                                       | 备份文件路径          |
| `restoreDatabase(backupPath: string): bool`                 | 从备份恢复数据库                 | `backupPath`：备份文件路径               | 恢复成功返回 `true`   |
| `shutdown(): void`                                          | 关闭数据库连接，释放资源         | 无                                       | 无                    |

> 📄 详细规划 → [docs/arch/persistence.md](../03-Modules/persistence.md)

---

### 日志模块

**职责**：横切关注点模块，覆盖前端 Electron 层和 C++ 后端层。提供统一的结构化日志接口，输出至控制台和文件（`logs/{module}-{YYYY-MM-DD}.log`）。支持五个等级（`DEBUG / INFO / WARN / ERROR / FATAL`），C++ 端线程安全，`FATAL` 级自动终止进程。支持日志文件自动清理（可配置保留天数和开关）。

**对外接口**

| 函数签名                                                                       | 适用层               | 说明                                                        |
| ------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------- |
| `logDebug(module, msg) / logInfo / logWarn / logError / logFatal`              | TypeScript（前端）   | 各等级日志输出快捷函数，渲染进程通过 IPC 转发至主进程写文件 |
| `setMinLevel(level: LogLevel): void`                                           | TypeScript（主进程） | 设置最低输出等级                                            |
| `LOG_DEBUG(module, msg)` / `LOG_INFO` / `LOG_WARN` / `LOG_ERROR` / `LOG_FATAL` | C++（宏）            | 各等级日志宏，调用全局 Logger 单例写入文件和 stderr         |
| `Logger::initialize(logDir: string, minLevel: LogLevel): void`                 | C++                  | 初始化 Logger，设置日志目录和最低等级                       |

> 📄 详细规划 → [docs/arch/logger.md](../03-Modules/logger.md)

---

### 配置文件模块

**职责**：管理 `{app_dir}/config.json` 配置文件的读写和校验（由 Electron 主进程负责）。C++ 后端通过启动时的命令行参数接收所有配置项，不直接读写配置文件。提供 React 设置页面读取和修改配置的接口。

**对外接口（TypeScript，暴露给渲染进程）**

| 函数签名                                      | 说明                                          | 参数                 | 返回值           |
| --------------------------------------------- | --------------------------------------------- | -------------------- | ---------------- |
| `loadConfig(): AppConfig`                     | 从 `config.json` 加载配置，不存在则创建默认值 | 无                   | `AppConfig`      |
| `saveConfig(config: AppConfig): void`         | 将配置序列化写入 `config.json`                | `config`：完整配置   | 无               |
| `getConfig(): AppConfig`                      | 返回内存缓存中的当前配置                      | 无                   | `AppConfig`      |
| `setConfig(patch: Partial<AppConfig>): void`  | 合并变更并持久化，检测是否需要重启            | `patch`：变更字段    | 无               |
| `validateConfig(config: AppConfig): string[]` | 校验配置合法性，返回错误列表                  | `config`：待校验配置 | 错误描述列表     |
| `resetToDefaults(): AppConfig`                | 重置为默认值并写入磁盘                        | 无                   | 默认 `AppConfig` |

**C++ 命令行参数（Electron 启动时传入）**

```
--bind-address --port --auth-token --storage-path --db-path --log-dir --log-level
--log-retention-enabled --log-retention-days
--api-key --api-base-url --vision-model --embedding-model
--api-timeout --api-retries
--ocr-api-key --ocr-api-url --ocr-provider
--thumbnail-enabled --thumbnail-max-size
--backup-enabled --backup-retention-days
--max-queue-size --worker-count --recycle-bin-retention-days
```

> 📄 详细规划 → [docs/arch/config.md](../03-Modules/config.md)
