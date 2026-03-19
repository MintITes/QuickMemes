# Free OCR API 技术文档

> 本文档基于 OCR.Space 免费 OCR 接口说明整理，目标是把 `POST /parse/image` 与 `GET /parse/imageurl` 的能力、参数、响应结构和调用注意事项完整沉淀为一份可直接用于开发接入的中文技术说明。

---

## 目录

- [1. 概述](#1-概述)
- [2. 接口总览](#2-接口总览)
- [3. 认证与请求方式](#3-认证与请求方式)
- [4. POST `/parse/image` 参数详解](#4-post-parseimage-参数详解)
- [5. GET `/parse/imageurl` 参数详解](#5-get-parseimageurl-参数详解)
- [6. OCR 引擎选择建议](#6-ocr-引擎选择建议)
- [7. 响应结构详解](#7-响应结构详解)
- [8. 错误码与处理策略](#8-错误码与处理策略)
- [9. 调用示例](#9-调用示例)
- [10. 工程接入建议](#10-工程接入建议)
- [11. 关键限制与最佳实践](#11-关键限制与最佳实践)

---

## 1. 概述

Free OCR API 是 OCR.Space 提供的免费文字识别接口，支持通过图片或 PDF 文件提取文本内容。它同时提供：

- **POST 接口**：`https://api.ocr.space/parse/image`
  - 支持 `url`、`file`、`base64Image` 三种输入方式
  - 能力最完整，适合生产接入
- **GET 接口**：`https://api.ocr.space/parse/imageurl`
  - 仅支持通过 URL 传入远程图片或 PDF
  - 更适合快速测试和轻量集成

接口返回统一的 JSON 结构，便于程序直接解析 OCR 结果、错误信息以及可选的文字坐标信息。

---

## 2. 接口总览

### 2.1 POST OCR API

- **接口地址**：`https://api.ocr.space/parse/image`
- **请求方法**：`POST`
- **主要用途**：
  - 本地文件上传识别
  - Base64 字符串识别
  - 远程 URL 识别
  - 需要附加更多参数时的标准调用方式

### 2.2 GET OCR API

- **接口地址**：`https://api.ocr.space/parse/imageurl`
- **请求方法**：`GET`
- **主要用途**：
  - 直接在 URL 中组合参数完成 OCR
  - 适合浏览器点击测试或快速调试

### 2.3 支持的输入类型

| 输入方式 | POST 支持 | GET 支持 | 说明 |
| --- | --- | --- | --- |
| `url` | 支持 | 支持 | 传入远程图片或 PDF 地址 |
| `file` | 支持 | 不支持 | 表单上传文件，仅 POST 可用 |
| `base64Image` | 支持 | 不支持 | 以 Base64 编码字符串提交图片或 PDF，仅 POST 可用 |

---

## 3. 认证与请求方式

### 3.1 API Key

请求必须携带 `apikey`。

- 免费测试常见示例：`helloworld`
- 实际接入时应使用你自己的 API Key

OCR.Space 文档中说明：

- `apikey` 建议放在请求头中发送
- 也可通过表单字段或 URL 参数传入，具体方式以调用方式为准

### 3.2 HTTPS 与 HTTP

该 API 支持：

- `https://`
- `http://`

但在实际工程中，**优先使用 HTTPS**，以避免请求被明文嗅探或篡改。

### 3.3 Content-Type 注意事项

当通过 `url` 输入远程资源时，OCR.Space 会根据资源的 `Content-Type` 自动识别文件类型。

需要特别注意：

- 图片应返回正确的图片 MIME 类型，如 `image/png`、`image/jpeg`
- PDF 应返回 `application/pdf`
- 某些对象存储默认可能返回错误的类型，如 `application/x-www-form-urlencoded`

如果上游服务无法修改 Content-Type，可以使用 `filetype` 参数显式覆盖。

---

## 4. POST `/parse/image` 参数详解

### 4.1 参数总表

| 参数 | 是否必需 | 类型 | 说明 |
| --- | --- | --- | --- |
| `apikey` | 是 | string | API Key，建议通过请求头传递 |
| `url` | 否 | string | 远程图片或 PDF 地址 |
| `file` | 否 | file | Multipart 上传的本地文件 |
| `base64Image` | 否 | string | Base64 编码的图片或 PDF 数据 |
| `language` | 否 | string | OCR 语言，默认 `eng` |
| `isOverlayRequired` | 否 | boolean | 是否返回单词坐标信息 |
| `filetype` | 否 | string | 显式指定文件类型 |
| `detectOrientation` | 否 | boolean | 是否自动旋转并返回方向信息 |
| `isCreateSearchablePdf` | 否 | boolean | 是否生成可搜索 PDF |
| `isSearchablePdfHideTextLayer` | 否 | boolean | 是否隐藏 PDF 文本层 |
| `scale` | 否 | boolean | 是否进行内部放大处理 |
| `isTable` | 否 | boolean | 是否按表格/票据场景优化输出 |
| `OCREngine` | 否 | number | OCR 引擎选择，`1` / `2` / `3` |

### 4.2 输入方式说明

#### 4.2.1 `url`

适用于远程资源：

- 远程图片
- 远程 PDF

特点：

- 传输成本低
- 适合较大文件，官方建议文件大于 `10 MB` 时优先使用 URL 方式
- 依赖远程资源可访问性与正确的 MIME 类型

#### 4.2.2 `file`

通过 Multipart 方式上传本地文件。

特点：

- 适合本地图片和 PDF
- 是最通用的 POST 上传方式
- 适合桌面端、后端服务、本地脚本

#### 4.2.3 `base64Image`

将图片或 PDF 编码为 Base64 字符串后提交。

要求：

- 字符串必须带上数据头
- 图片示例：
  - `data:image/jpeg;base64,...`
  - `data:image/png;base64,...`
- PDF 示例：
  - `data:application/pdf;base64,...`

适用场景：

- 文件已在内存中，无需落盘
- 需要把二进制内容直接嵌入请求体

### 4.3 语言参数 `language`

OCR.Space 使用 **三字母语言代码**，不是两字母代码。

例如：

- `eng` 表示英语
- `chs` 表示简体中文
- `jpn` 表示日语

如果未指定，默认使用 `eng`。

#### 支持语言示例

| 语言 | 代码 |
| --- | --- |
| Arabic | `ara` |
| Bulgarian | `bul` |
| Chinese(Simplified) | `chs` |
| Chinese(Traditional) | `cht` |
| English | `eng` |
| French | `fre` |
| German | `ger` |
| Japanese | `jpn` |
| Korean | `kor` |
| Russian | `rus` |
| Spanish | `spa` |
| Vietnamese | `vnm` |

#### 自动语言检测

`language=auto` 可开启自动语言检测，但官方说明其依赖于 **Engine 2 / 3**。

### 4.4 结构化输出参数

#### `isOverlayRequired`

- 默认：`false`
- 作用：
  - 如果为 `true`，返回每个单词的坐标、宽高等信息
  - 如果为 `false`，只返回纯文本块

适合场景：

- 文字高亮
- 原位文本覆盖
- 版面还原
- 坐标级后处理

#### `detectOrientation`

- 默认：`false`
- 作用：
  - 启用图像方向检测
  - API 会尝试自动旋转图像
  - 响应中会返回 `TextOrientation`

适合场景：

- 手机拍照图片
- 扫描件
- 存在横竖翻转风险的输入

### 4.5 PDF 相关参数

#### `isCreateSearchablePdf`

- 默认：`false`
- 如果为 `true`，API 会生成可搜索 PDF
- 该参数会自动把 `isOverlayRequired` 设为 `true`

#### `isSearchablePdfHideTextLayer`

- 默认：`false`
- 如果为 `true`，则生成 PDF 的文本层不可见

#### `filetype`

用于覆盖自动类型识别，支持：

- `PDF`
- `GIF`
- `PNG`
- `JPG`
- `TIF`
- `BMP`

### 4.6 图像质量与表格场景优化

#### `scale`

- 默认：`false`
- 如果为 `true`，API 会进行内部放大处理
- 对低分辨率扫描图尤其有帮助

#### `isTable`

- 默认：`false`
- 如果为 `true`，OCR 会尽量保持按行返回
- 适合：
  - 表格识别
  - 收据识别
  - 发票识别
  - 结构化票据

### 4.7 OCR 引擎 `OCREngine`

可选值：

- `1`
- `2`
- `3`

不同引擎适配不同场景，建议根据目标文档类型进行逐一评估，选择实际效果最佳的引擎。

---

## 5. GET `/parse/imageurl` 参数详解

GET 接口适合快速调用，所有参数都放在 URL 中。

### 5.1 基本形式

```text
https://api.ocr.space/parse/imageurl?apikey=YOUR_KEY&url=IMAGE_URL
```

### 5.2 示例

```text
https://api.ocr.space/parse/imageurl?apikey=helloworld&url=https://dl.a9t9.com/ocr/solarcell.jpg
```

### 5.3 常用扩展参数

```text
https://api.ocr.space/parse/imageurl?apikey=helloworld&url=https://dl.a9t9.com/ocr/solarcell.jpg&language=chs&isOverlayRequired=true
```

### 5.4 GET 的关键限制

GET 接口只适合：

- 远程图片 URL
- 远程 PDF URL

GET 接口**不支持**：

- `file` 上传
- `base64Image`

原因很直接：GET 请求没有消息体，所有内容都必须出现在 URL 中。

### 5.5 使用注意

由于 `apikey` 会出现在 URL 中，浏览器历史记录里可能会保存完整链接。

官方解释认为这不是严重安全问题，因为：

- OCR.Space 不保留用户文档内容
- 泄露 API Key 的直接风险主要是别人消耗掉你的免费额度

如果你对 API Key 暴露敏感，建议继续使用 **HTTPS POST**。

---

## 6. OCR 引擎选择建议

OCR.Space 提供三个 OCR 引擎，适用于不同任务。

### 6.1 Engine 1

特点：

- 支持较多语言，包括中日韩等亚洲语言
- 速度最快
- 支持较大图片
- 支持多页 TIFF

适合：

- 通用 OCR
- 体积较大的图片
- 希望获得更快响应的场景

### 6.2 Engine 2

特点：

- 支持自动语言检测
- 对特殊字符识别较好，例如：
  - `§`
  - `$`
  - `@`
  - `€`
  - `()[]{}` 等
- 对复杂背景文本表现更好
- 对旋转文本、单字符、数字、字母数字混合识别更友好

适合：

- 图片中的文字
- 路牌
- 车牌
- 验证码类图像
- 单字符/单数字识别

### 6.3 Engine 3

特点：

- 更强调原始格式保留
- 支持 200+ 语言
- 支持自动语言检测
- 支持手写识别
- 支持表格与版式识别
- 支持复选框识别：
  - `☐`
  - `☑`

限制：

- 大图或 PDF 处理更慢
- 不返回 overlay 数据
- 不支持生成 searchable PDF
- 引擎本身仍处于开发中，稳定性可能不如前两个引擎

适合：

- 需要保留排版的文本
- 表格
- 手写内容
- checkbox/表单识别

### 6.4 实践建议

建议采用以下策略：

1. 先用目标数据集做小规模对比测试
2. 分别测试 `OCREngine=1/2/3`
3. 对比以下指标：
   - 准确率
   - 速度
   - 是否保留版式
   - 是否支持目标语言
4. 选择综合效果最好的引擎作为默认值

---

## 7. 响应结构详解

OCR.Space 返回 JSON 格式响应，结构分为两层：

- 顶层：表示整体处理状态
- `ParsedResults`：表示每个文件或每个页面的识别结果

### 7.1 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ParsedResults` | array | 识别结果数组，每个文件或 PDF 页面一个对象 |
| `OCRExitCode` | integer / string | 整体识别状态码 |
| `IsErroredOnProcessing` | boolean | 是否发生处理错误 |
| `ErrorMessage` | string / null | 顶层错误消息 |
| `ErrorDetails` | string / null | 顶层错误详情 |
| `SearchablePDFURL` | string / null | 若生成 searchable PDF，则返回下载链接 |
| `ProcessingTimeInMilliseconds` | string | 总耗时 |

### 7.2 `OCRExitCode` 含义

| 值 | 含义 |
| --- | --- |
| `1` | 解析成功 |
| `2` | 部分解析成功 |
| `3` | 图像或 PDF 全部解析失败 |
| `4` | 解析时发生致命错误 |

### 7.3 `ParsedResults` 中的单页/单图结果

每个元素通常包含：

| 字段 | 说明 |
| --- | --- |
| `TextOverlay` | 文字覆盖层信息，仅在请求 overlay 时可能存在 |
| `FileParseExitCode` | 单图或单页的处理状态码 |
| `ParsedText` | 识别出的纯文本 |
| `ErrorMessage` | 当前页/图错误信息 |
| `ErrorDetails` | 当前页/图详细错误信息 |

### 7.4 `TextOverlay` 结构

当 `isOverlayRequired=true` 时，可能返回文字坐标信息：

```json
{
  "TextOverlay": {
    "Lines": [
      {
        "Words": [
          {
            "WordText": "Word 1",
            "Left": 106,
            "Top": 91,
            "Height": 9,
            "Width": 11
          }
        ],
        "MaxHeight": 13,
        "MinTop": 90
      }
    ],
    "HasOverlay": true,
    "Message": null
  }
}
```

### 7.5 字段解释

| 字段 | 说明 |
| --- | --- |
| `Lines` | 按行组织的数组 |
| `Words` | 每行里的单词数组 |
| `WordText` | 单词文本 |
| `Left` | 单词距离左边缘的像素值 |
| `Top` | 单词距离上边缘的像素值 |
| `Height` | 单词高度 |
| `Width` | 单词宽度 |
| `MaxHeight` | 当前行最大高度 |
| `MinTop` | 当前行最小顶部偏移 |
| `HasOverlay` | 是否存在 overlay 信息 |

### 7.6 PDF 场景

对于 PDF：

- `ParsedResults` 的每个元素通常对应一页
- 一页成功，另一页失败时，整体可能返回 `OCRExitCode = 2`
- 单页错误信息会写在对应元素内，便于定位失败页面

---

## 8. 错误码与处理策略

### 8.1 `FileParseExitCode`

| 值 | 说明 | 建议处理方式 |
| --- | --- | --- |
| `0` | 文件未找到 | 检查 `url` 是否可访问，或 `file` 是否正确上传 |
| `1` | 成功 | 正常读取 `ParsedText` |
| `-10` | OCR 引擎解析错误 | 可能是图像质量、引擎不匹配或格式问题，建议重试或切换引擎 |
| `-20` | 超时 | 适当提高超时或优化输入文件大小 |
| `-30` | 校验错误 | 检查参数、文件格式、Base64 头部、语言代码等 |
| `-99` | 未知错误 | 记录完整错误信息并做兜底降级 |

### 8.2 处理建议

建议在业务代码中分层处理：

1. **网络层失败**
   - DNS、连接超时、TLS 失败、HTTP 5xx
2. **API 层失败**
   - 顶层 `IsErroredOnProcessing = true`
   - `OCRExitCode` 非预期
3. **页/文件层失败**
   - 某一页 `FileParseExitCode != 1`
   - 保留其它成功页面的结果
4. **文本层空结果**
   - 返回成功，但 `ParsedText` 为空
   - 需要结合实际场景决定是否视为失败

### 8.3 推荐降级策略

如果 OCR 不可用或识别失败，可考虑：

- 返回空文本但保留原文件
- 只记录文件元信息，跳过全文索引
- 把失败原因写入日志，便于后续排查
- 对同一文件尝试不同引擎或不同语言

---

## 9. 调用示例

### 9.1 GET 示例

```text
https://api.ocr.space/parse/imageurl?apikey=helloworld&url=https://dl.a9t9.com/ocr/solarcell.jpg
```

启用中文和 overlay：

```text
https://api.ocr.space/parse/imageurl?apikey=helloworld&url=https://dl.a9t9.com/ocr/solarcell.jpg&language=chs&isOverlayRequired=true
```

### 9.2 POST URL 方式示例

```bash
curl https://api.ocr.space/Parse/Image \
  -H "apikey:helloworld" \
  --data "isOverlayRequired=true&url=http://dl.a9t9.com/blog/ocr-online/screenshot.jpg&language=eng"
```

### 9.3 POST 文件上传示例

```bash
curl -H "apikey:helloworld" \
  --form "file=@screenshot.jpg" \
  --form "language=eng" \
  --form "isOverlayRequired=true" \
  https://api.ocr.space/Parse/Image
```

### 9.4 POST Base64 示例

```bash
curl -H "apikey:helloworld" \
  --form "base64Image=data:image/jpeg;base64,/9j/AAQSk..." \
  --form "language=eng" \
  --form "isOverlayRequired=false" \
  https://api.ocr.space/parse/image
```

### 9.5 工程中建议的请求参数组合

#### 场景一：通用图片 OCR

- `OCREngine=1`
- `language=eng`
- `isOverlayRequired=false`
- `detectOrientation=true`

#### 场景二：复杂背景、旋转文本

- `OCREngine=2`
- `language=auto`
- `isOverlayRequired=true`
- `detectOrientation=true`

#### 场景三：表格、票据、结构化文档

- `OCREngine=3`
- `language=auto`
- `isTable=true`
- `isOverlayRequired=false`

---

## 10. 工程接入建议

### 10.1 与业务模块的解耦

建议把 OCR 调用封装成独立服务层，而不要散落在业务逻辑里。理想分层如下：

- 上层：业务流程、任务调度、搜索索引
- 中层：OCR Service 封装请求、重试、结果归一化
- 下层：HTTP 客户端、响应解析、错误映射

### 10.2 统一结果模型

建议在工程内部把 OCR 返回值规整成统一结构，例如：

```ts
interface OcrResult {
  success: boolean
  fullText: string
  rawResponse?: unknown
  engine?: number
  language?: string
  error?: string
}
```

这样做的好处：

- 上层不用关心不同引擎的细节
- 便于后续替换其他 OCR 提供商
- 便于统一做日志和失败重试

### 10.3 请求重试

建议只对以下情况做有限重试：

- 网络超时
- 连接重置
- 临时性 5xx 错误

不建议盲目重试：

- 参数错误
- Base64 格式错误
- 不支持的文件类型
- 明确的校验失败

### 10.4 日志记录建议

建议记录以下信息：

- 请求时间
- 输入来源类型：`url` / `file` / `base64Image`
- 目标语言
- 选择的引擎
- 是否请求 overlay
- 顶层 `OCRExitCode`
- 单页 `FileParseExitCode`
- 失败时的 `ErrorMessage` / `ErrorDetails`

注意：

- 不要在日志中直接输出完整 API Key
- 对 Base64 原文做脱敏或截断
- 对用户隐私文件内容保持最小化记录

### 10.5 搜索场景使用建议

如果 OCR 结果会用于全文检索，建议：

1. 先做文本清洗
2. 再做语言分词或规范化
3. 对中文场景考虑额外的空白、换行、标点整理
4. 将 OCR 原文和清洗后文本分开保存，避免信息丢失

---

## 11. 关键限制与最佳实践

### 11.1 关键限制

- GET 仅支持 URL 输入，不能上传文件或 Base64
- Base64 字符串必须带数据头
- 语言代码必须是三字母，不是两字母
- Engine 3 不提供 overlay 和 searchable PDF
- 大文件建议优先走 URL 或高效的 Multipart 上传

### 11.2 最佳实践

#### 优先级建议

1. 优先使用 HTTPS
2. 优先使用 POST 作为正式接入
3. 目标语言明确时显式传 `language`
4. 对旋转图片开启 `detectOrientation`
5. 对低分辨率图片考虑 `scale=true`
6. 对表格/票据考虑 `isTable=true`
7. 复杂识别场景多做引擎对比测试

#### 资源与性能建议

- 大图片先压缩到合理分辨率
- 多页 PDF 可能产生更高耗时，要设置超时与进度反馈
- 如果只需要纯文本，关闭 overlay 可减少响应体积
- 如果只需要快速试用，GET 接口最方便；但生产环境仍建议 POST

#### 安全建议

- 不要把 API Key 硬编码到前端静态资源中
- 不要在 URL 中长期暴露敏感 Key
- 服务器侧做统一代理转发时，应为 Key 提供最小可见范围

---

## 附：推荐落地流程

如果将该 OCR API 用到项目中，推荐按以下步骤落地：

1. 先确定输入来源：本地文件、远程 URL，还是内存中的 Base64
2. 再确定识别目标：纯文本、overlay 坐标、可搜索 PDF
3. 选择合适的语言与 OCR 引擎
4. 定义统一的内部结果结构
5. 实现 HTTP 请求、超时、重试与错误映射
6. 对返回文本做清洗与索引
7. 为失败场景提供降级与日志追踪
