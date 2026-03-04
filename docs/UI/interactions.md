# 用户交互流程

> **所属层级**：前端 UI 设计 — 交互规范  
> **索引**：[UI.md](UI.md) · [布局规格](layout.md) · [组件规格](components.md) · [弹窗规格](dialogs.md)

---

## 目录

- [导入流程](#导入流程)
- [搜索流程](#搜索流程)
- [浏览与选择](#浏览与选择)
- [拖拽归类](#拖拽归类)
- [删除与回收站](#删除与回收站)
- [导出流程](#导出流程)
- [右键上下文菜单](#右键上下文菜单)
- [快捷键映射](#快捷键映射)

---

## 导入流程

QuickMemes 提供 4 种导入方式，全部通过顶栏搜索框内的 **⊕ 按钮**下拉菜单触发：

### 方式 1：快捷导入（拖拽文件）

```mermaid
sequenceDiagram
    participant 用户
    participant 导入窗口
    participant React
    participant 后端

    用户->>导入窗口: 点击"快捷导入"或拖拽文件到窗口
    Note over 导入窗口: 居中弹出拖拽放置区
    用户->>导入窗口: 拖拽文件到放置区
    导入窗口->>React: 提取文件路径列表
    React->>后端: POST /api/import { source: "DRAG_DROP", inputs: [paths] }
    后端-->>React: ImportTask { taskId, status: "PENDING" }
    React->>React: 底部状态栏显示进度条
    loop 处理每个文件
        后端->>React: WS 推送 task:progress
        React->>React: 更新进度条
    end
    后端->>React: WS 推送 task:complete
    React->>React: 弹出 Toast "导入完成"，刷新画廊
```

> **全局拖拽感知**：在任何时候，只要用户从系统文件管理器拖拽图片文件到 QuickMemes 窗口上方，快捷导入窗口会**自动弹出**并高亮放置区域。

### 方式 2：从剪贴板导入

```mermaid
sequenceDiagram
    participant 用户
    participant React
    participant Electron主进程
    participant 后端

    用户->>React: 选择"从剪贴板导入"
    React->>Electron主进程: readClipboardImage()
    alt 剪贴板有图片
        Electron主进程-->>React: Base64 PNG 数据
        React->>后端: POST /api/import { source: "CLIPBOARD", inputs: [base64Data] }
        后端-->>React: ImportTask
        React->>React: 弹出 Toast "导入成功"
    else 剪贴板无图片
        Electron主进程-->>React: null
        React->>React: 弹出 Toast "剪贴板无图片内容"
    end
```

### 方式 3：从文件导入

```mermaid
sequenceDiagram
    participant 用户
    participant React
    participant Electron主进程
    participant 后端

    用户->>React: 选择"从文件导入"
    React->>Electron主进程: openFileDialog({ multiSelect: true })
    Electron主进程->>用户: 弹出系统文件选择器
    用户->>Electron主进程: 选择文件
    Electron主进程-->>React: [文件路径列表]
    React->>后端: POST /api/import { source: "FILE_PICKER", inputs: [paths] }
    后端-->>React: ImportTask
    React->>React: 底部状态栏显示进度
```

### 方式 4：从 URL 导入

```mermaid
sequenceDiagram
    participant 用户
    participant URL对话框
    participant React
    participant 后端

    用户->>React: 选择"从 URL 导入"
    React->>URL对话框: 弹出 URL 输入对话框
    用户->>URL对话框: 输入图片 URL
    URL对话框->>React: 确认提交
    React->>后端: POST /api/import { source: "URL", inputs: [url] }
    后端-->>React: ImportTask
    React->>React: 底部状态栏显示进度
```

---

## 搜索流程

```mermaid
flowchart TD
    A[用户点击搜索框] --> B[搜索框聚焦]
    B --> C[向下展开历史记录区域]
    C --> D{用户操作}
    D -->|点击历史记录| E[填入历史关键词]
    D -->|输入新关键词| F[文字输入]
    D -->|点击「高级搜索」| G[弹出高级搜索对话框]
    E --> H[自动触发搜索]
    F --> H[Debounce 自动触发搜索]
    G --> I[配置搜索条件]
    I --> J[实时预览或点击搜索]
    H --> K[向后端发送搜索请求]
    J --> K
    K --> L[主区域展示搜索结果]
    L --> M{有结果?}
    M -->|是| N[画廊展示匹配的梗图]
    M -->|否| O[显示空状态 - 无搜索结果]
```

### 搜索范围

搜索请求会查询以下字段：

| 字段         | 搜索方式   |
| ------------ | ---------- |
| 文件名       | 关键词匹配 |
| 标签         | 精确匹配   |
| OCR 识别文本 | 全文搜索   |

### 高级搜索

高级搜索对话框提供的匹配模式选项：

| 模式     | 说明               |
| -------- | ------------------ |
| 词匹配   | 按完整词语匹配     |
| 模糊匹配 | 包含即匹配（默认） |
| 正则搜索 | 使用正则表达式匹配 |

---

## 浏览与选择

### 单击操作（效率复制）

```mermaid
flowchart LR
    A[单击左键梗图] --> B[直接复制到系统剪贴板]
    B --> C[右下角弹出 Toast]
    C --> D["已复制到剪贴板 ✓"]
```

### 唤出属性面板（编辑模式）

> 属性面板默认隐藏，专注视觉浏览。

```mermaid
flowchart LR
    A[右键或点击卡片 ···] --> B[选择“编辑详细信息 / 标签”]
    B --> C[右侧属性面板从边缘滑出]
    C --> D[进行属性或标签编辑]
```

### 多选操作

| 操作方式               | 行为                                               |
| ---------------------- | -------------------------------------------------- |
| `Ctrl` + 左键          | 在已选集合中追加或取消该梗图                       |
| `Shift` + 左键         | 选中从上一个选中项到当前点击项之间的所有梗图       |
| 鼠标框选 (Rubber Band) | 在空白区域按住左键拖动，画出矩形，框内梗图全部选中 |

### 多选后的右侧面板

```mermaid
flowchart TD
    A[选中多张梗图] --> B[右侧面板切换为批量模式]
    B --> C["显示 '已选中 N 张图片'"]
    B --> D[批量添加标签]
    B --> E[批量删除]
    B --> F[批量导出]
```

---

## 拖拽归类

将梗图从中间主区域拖拽到左侧导航栏的分类项上，实现快速归类。

```mermaid
sequenceDiagram
    participant 用户
    participant 主区域
    participant 左侧栏
    participant React
    participant 后端

    用户->>主区域: 按住梗图开始拖拽
    Note over 主区域: 原位卡片半透明化
    Note over 用户: 鼠标旁显示半透明缩略图副本
    用户->>左侧栏: 拖拽到某分类项上方
    Note over 左侧栏: 目标分类项高亮发光
    用户->>左侧栏: 释放鼠标（Drop）
    左侧栏->>React: 触发归类操作
    React->>后端: PUT /api/meme/{id} MemePatch { sourceName: "目标分类名" }
    后端-->>React: ApiResponse<MemeEntry> 更新后的完整数据
    React->>React: 刷新画廊 + 弹出 Toast "已移动到 [分类名]"
```

### 拖拽视觉反馈

| 阶段         | 视觉效果                                 |
| ------------ | ---------------------------------------- |
| 开始拖拽     | 原位卡片变为半透明，鼠标旁出现缩略图跟随 |
| 悬停有效目标 | 目标分类项高亮发光边框                   |
| 悬停无效目标 | 无特殊视觉提示                           |
| 释放成功     | 高亮消失，弹出成功 Toast                 |
| 释放到空白   | 取消拖拽，恢复原状                       |

---

## 删除与回收站

### 删除流程

```mermaid
flowchart TD
    A[用户选择 - 移动到回收站] --> B[梗图立即从当前视图移除]
    B --> C[底部弹出带撤销按钮的 Toast]
    C --> D{用户操作}
    D -->|点击「撤销」| E[梗图恢复到原位置]
    D -->|Toast 超时消失| F[梗图留在回收站]
    F --> G[回收站计数 +1]
```

### 回收站内操作

```mermaid
flowchart TD
    A[用户进入回收站视图] --> B[查看已删除的梗图]
    B --> C[悬停显示剩余自动删除天数]
    B --> D{用户操作}
    D -->|右键 → 恢复| E[梗图恢复到原分类]
    D -->|右键 → 永久删除| F[弹出二次确认对话框]
    F -->|确认| G[从数据库和文件系统中彻底删除]
    F -->|取消| B
    D -->|点击「清空回收站」| H[弹出二次确认对话框]
    H -->|确认| I[所有回收站内容永久删除]
    H -->|取消| B
```

### 回收站特殊排序

| 排序选项           | 说明                     |
| ------------------ | ------------------------ |
| 按删除时间排序     | 最近删除的排在前面       |
| 按剩余生命周期排序 | 即将被自动删除的排在前面 |

---

## 导出流程

```mermaid
sequenceDiagram
    participant 用户
    participant React
    participant Electron主进程
    participant 后端

    用户->>React: 右键 → 导出 / 批量导出
    React->>Electron主进程: saveFileDialog({ filters, defaultName })
    Electron主进程->>用户: 弹出系统另存为对话框
    Note over 用户: 可选择导出格式和文件名
    用户->>Electron主进程: 确认保存路径
    Electron主进程-->>React: 保存路径
    React->>后端: POST /api/export { memeIds, format, outputPath }
    后端-->>React: 导出成功
    React->>React: 弹出 Toast "导出完成"
```

### 支持的导出格式

| 格式   | 说明                 |
| ------ | -------------------- |
| 原格式 | 保持导入时的原始格式 |
| PNG    | 转换为 PNG           |
| JPG    | 转换为 JPG           |

---

## 右键上下文菜单

### 菜单项列表

| 菜单项        | 快捷键   | 行为                        |
| ------------- | -------- | --------------------------- |
| 复制到剪贴板  | `Ctrl+C` | 将梗图写入系统剪贴板        |
| 导出          | `Ctrl+S` | 弹出另存为对话框            |
| 编辑详情/标签 | —        | 唤出并聚焦右侧面板          |
| 查看原图      | `Enter`  | 打开灯箱预览                |
| 移动到        | —        | 展开子菜单列出所有分类      |
| 移动到回收站  | `Delete` | 移入回收站 + 弹出撤销 Toast |

---

## 快捷键映射

### 全局快捷键（应用窗口内随时可用）

| 快捷键   | 操作                    |
| -------- | ----------------------- |
| `Ctrl+F` | 聚焦顶栏搜索框          |
| `Ctrl+V` | 从剪贴板导入梗图        |
| `Ctrl+,` | 打开设置对话框          |
| `Esc`    | 关闭当前弹窗 / 取消操作 |

### 画廊区域快捷键（焦点在主区域时）

| 快捷键          | 操作                       |
| --------------- | -------------------------- |
| `←` `→` `↑` `↓` | 在画廊梗图之间移动选中焦点 |
| `Enter`         | 打开灯箱预览               |
| `Ctrl+C`        | 复制选中梗图到剪贴板       |
| `Ctrl+S`        | 导出选中梗图               |
| `Delete`        | 移动选中梗图到回收站       |
| `Ctrl+A`        | 全选当前视图内所有梗图     |
| `Ctrl+D`        | 取消所有选择               |

### 灯箱预览快捷键

| 快捷键    | 操作                 |
| --------- | -------------------- |
| `←` / `→` | 切换上一张 / 下一张  |
| `+` / `-` | 放大 / 缩小          |
| `0`       | 恢复原始尺寸         |
| `Ctrl+C`  | 复制当前梗图到剪贴板 |
| `Esc`     | 关闭灯箱             |
