# PP-OCRv5 服务化部署 API

> 本文档用于对接 PP-OCRv5 服务化部署接口，说明请求方式、参数、响应结构和错误码。
>
> 版本说明：
> - PaddleX：`3.3.12`
> - PaddlePaddle：`3.2.1`

## 1. 接口概述

- 服务用途：将图片或 PDF 中的文字识别为结构化结果
- 请求方法：`POST`
- 接口路径：`/ocr`
- 数据格式：请求体与响应体均为 JSON
- 鉴权方式：`Authorization: token <access token>`

支持输入：

- 图片文件
- PDF 文件

`file` 字段支持两种形式：

- 服务器可访问的 URL
- 文件内容的 Base64 编码字符串

默认情况下，PDF 仅处理前 10 页。若需放开限制，可在产线配置中设置：

```yaml
Serving:
  extra:
    max_num_input_imgs: null
```

## 2. 请求参数

### 必填参数

| 名称 | 参数 | 类型 | 说明 |
| --- | --- | --- | --- |
| 输入文件 | `file` | string | 图片或 PDF 的 URL，或对应文件的 Base64 编码 |

### 可选参数

| 名称 | 参数 | 类型 | 说明 |
| --- | --- | --- | --- |
| 文件类型 | `fileType` | integer \| null | `0` 表示 PDF，`1` 表示图像。未传时将根据 URL 推断 |
| 图片方向矫正 | `useDocOrientationClassify` | boolean \| null | 是否自动纠正 `0°`、`90°`、`180°`、`270°` 方向 |
| 图片扭曲矫正 | `useDocUnwarping` | boolean \| null | 是否启用文档扭曲矫正 |
| 文本行方向矫正 | `useTextlineOrientation` | boolean \| null | 是否自动纠正 `0°` 和 `180°` 的文本行 |
| 图像边长限制 | `textDetLimitSideLen` | integer \| null | 文本检测图像边长限制，默认 `64` |
| 边长限制类型 | `textDetLimitType` | string \| null | 取值 `min` 或 `max`，默认 `min` |
| 文本检测像素阈值 | `textDetThresh` | number \| null | 默认 `0.3` |
| 文本检测框阈值 | `textDetBoxThresh` | number \| null | 默认 `0.6` |
| 扩张系数 | `textDetUnclipRatio` | number \| null | 默认 `1.5` |
| 文本识别阈值 | `textRecScoreThresh` | number \| null | 默认 `0.0` |
| 可视化 | `visualize` | boolean \| null | 是否返回结果图和中间图；`null` 时遵循产线配置 |

## 3. 响应结构

### 成功响应

```json
{
  "logId": "string",
  "errorCode": 0,
  "errorMsg": "Success",
  "result": {
    "ocrResults": [],
    "dataInfo": {}
  }
}
```

### 失败响应

```json
{
  "logId": "string",
  "errorCode": 403,
  "errorMsg": "Token 错误"
}
```

### `result` 字段

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `ocrResults` | array | OCR 结果数组。图像输入时长度为 1，PDF 输入时按实际处理页数返回 |
| `dataInfo` | object | 输入数据信息 |

`ocrResults` 中每一项包含：

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `prunedResult` | object | 结构化 OCR 结果，已去除 `input_path` 和 `page_index` |
| `ocrImage` | string \| null | 标注文本位置的结果图，JPEG Base64 |
| `docPreprocessingImage` | string \| null | 处理过程中的可视化图，JPEG Base64 |
| `inputImage` | string \| null | 输入图，JPEG Base64 |

### 示例输出

以下为单页图像识别时 `prunedResult` 的典型结构示例。实际返回内容会随图片内容、模型参数和输入类型变化。

```python
{
  "res": {
    "input_path": "./general_ocr_002.png",
    "page_index": None,
    "model_settings": {
      "use_doc_preprocessor": True,
      "use_textline_orientation": False
    },
    "doc_preprocessor_res": {
      "input_path": None,
      "page_index": None,
      "model_settings": {
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False
      },
      "angle": -1
    },
    "dt_polys": "文本检测框坐标数组",
    "text_det_params": {
      "limit_side_len": 736,
      "limit_type": "min",
      "thresh": 0.3,
      "max_side_limit": 4000,
      "box_thresh": 0.6,
      "unclip_ratio": 1.5
    },
    "text_type": "general",
    "textline_orientation_angles": "文本行方向角数组",
    "text_rec_score_thresh": 0.0,
    "rec_texts": [
      "www.997700",
      "",
      "Cm",
      "登机牌",
      "BOARDING",
      "PASS"
    ],
    "rec_scores": "文本识别置信度数组",
    "rec_polys": "识别文本框坐标数组",
    "rec_boxes": "识别文本框边界数组"
  }
}
```

说明：

- `res` 是核心结构，建议业务侧优先解析该字段
- `rec_texts` 保存每个文本框对应的识别文本
- `rec_scores` 保存每个文本框的置信度
- `dt_polys`、`rec_polys`、`rec_boxes` 用于文本框定位和可视化回显
- `text_det_params` 记录检测阶段实际使用的参数，便于排查线上差异
- `textline_orientation_angles` 记录每个文本行的方向判断结果

## 4. 调用示例

```python
import base64
import requests

API_URL = "<your url>"
TOKEN = "<access token>"
file_path = "<local file path>"

with open(file_path, "rb") as f:
    file_data = base64.b64encode(f.read()).decode("ascii")

payload = {
    "file": file_data,
    "fileType": 1,
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useTextlineOrientation": False
}

headers = {
    "Authorization": f"token {TOKEN}",
    "Content-Type": "application/json"
}

resp = requests.post(API_URL, json=payload, headers=headers)
resp.raise_for_status()
result = resp.json()["result"]
```

## 5. 错误码说明

| 错误码 | 说明 | 解决建议 |
| --- | --- | --- |
| `403` | Token 错误 | 检查 Token 是否正确，或 URL 是否与 Token 匹配 |
| `413` | 请求体过大 | 请减少 PDF 文件的页数或文件大小 |
| `422` | 参数无效 | 请参考 `errorMsg` 进行解决 |
| `429` | 超出单日解析最大页数 | 请使用其他模型或稍后再试 |
| `500` | 服务器内部错误 | 如果频繁遇到 500 问题，请联系 PaddleOCR 官方人员 |
| `503` | 当前请求过多 | 请稍后再试 |
| `504` | 网关超时 | 请稍后再试 |

## 6. 对接建议

- 建议优先通过 `logId` 定位问题
- 业务侧不要只看 HTTP 状态码，需同时检查 `errorCode` 和 `errorMsg`
- 生产环境建议默认关闭 `visualize`
- 批量 PDF 任务建议先控制页数，再根据需要放开限制
- 需要回显或复核时，优先使用 `ocrImage` 和 `prunedResult`
