# C++ 后端测试规范

> **所属层级**：QA / 后端测试  
> **测试框架**：Google Test (GTest)  
> **架构参考**：[cpp_core.md](../../03-Modules/cpp_core.md) · [persistence.md](../../03-Modules/persistence.md) · [vision.md](../../03-Modules/vision.md)

---

## 测试目录结构

```
src/backend/tests/
├── CMakeLists.txt            # 测试构建脚本，通过 FetchContent 引入 GTest
├── core/                     # 核心模块测试
│   ├── test_router.cpp       # HTTP 路由分发与请求解析
│   └── test_task_queue.cpp   # 导入任务队列的排队、并发控制、取消
├── db/                       # 持久化模块测试
│   ├── test_meme_crud.cpp    # Meme 增删改查完整流程
│   ├── test_tag_ops.cpp      # 标签 CRUD 与级联删除
│   ├── test_search.cpp       # FTS5 全文搜索、双向量表存储与兼容查询
│   └── test_soft_delete.cpp  # 软删除、回收站恢复、自动清理
├── embedding/                # Embedding 模块测试
│   └── test_embedding_mock.cpp # JinaAI Mock / live 测试、错误码与排序输出
├── vision/                   # Vision 模块测试
│   └── test_vision_mock.cpp  # Mock HTTP 响应测试 OCR / AI 分析
└── utils/                    # 工具类测试
    ├── test_config_parser.cpp # 配置解析与校验
    └── test_logger.cpp        # 日志格式化与等级过滤
```

### CMake 集成

测试通过 CMake 的 `FetchContent` 自动拉取 GTest，构建时使用 `ctest` 运行：

```cmake
# tests/CMakeLists.txt 核心片段
include(FetchContent)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG        v1.17.0
)
FetchContent_MakeAvailable(googletest)

enable_testing()

# 示例：持久化模块测试
add_executable(test_meme_crud db/test_meme_crud.cpp)
target_link_libraries(test_meme_crud PRIVATE gtest_main quickmemes_db)
add_test(NAME MemeCrud COMMAND test_meme_crud)
```

运行方式：

```bash
cd build/backend
./build.sh
./test.sh
```

---

## Mock 策略

每个模块测试都有明确的 Mock 边界，确保测试可独立运行、不依赖外部环境。

### 持久化模块

- 使用 **SQLite 内存数据库**（`:memory:`）替代磁盘文件
- 每个测试用例在 `SetUp()` 中创建全新的内存数据库，`TearDown()` 中自动销毁
- 优势：速度极快，无需清理残留数据，测试间完全隔离

```cpp
class MemeDbTest : public ::testing::Test {
protected:
    void SetUp() override {
        db_ = std::make_unique<Database>(":memory:");
        db_->initialize();  // 执行建表迁移
    }
    void TearDown() override {
        db_.reset();
    }
    std::unique_ptr<Database> db_;
};
```

### Vision 模块

- **Mock HTTP 客户端**：替换真实的 HTTP 客户端实现，返回预定义的 JSON 响应
- 不调用任何真实的云端 OCR / AI API
- 分别模拟成功响应、网络超时、API 错误等场景

```cpp
class MockHttpClient : public HttpClientInterface {
public:
    // 预设返回值
    void setResponse(const std::string& body, int statusCode = 200);
    // 模拟网络超时
    void simulateTimeout();
};
```

### 核心路由模块

- 构造 **Mock HTTP Request 对象**（包含 method、path、headers、body）
- 直接调用对应的 `handle*()` 函数，验证返回的 HTTP Response 状态码和 JSON body
- 不启动真实的 HTTP 服务器

---

## 关键路径测试清单

以下路径**必须**有测试覆盖，是项目质量的底线保障。

### 持久化模块

| 关键路径            | 测试要点                                               |
| ------------------- | ------------------------------------------------------ |
| Meme 增删改查       | 插入后可查、更新字段生效、软删除后不出现在常规查询中   |
| 文件哈希去重        | 插入相同 `fileHash` 的 Meme 时应被拒绝或提示重复       |
| 标签关联与级联删除  | 删除标签时，`meme_tags` 关联表中的对应记录应被级联移除 |
| FTS5 全文搜索       | 关键词匹配名称、描述、OCR 文本；覆盖中文、拼音、拼音开关与 ASCII 边界行为 |
| sqlite-vec 双向量表 | description / OCR 向量分别写入 `vec_meme_desc` / `vec_meme_ocr` |
| 软删除与回收站      | 软删除的 Meme 可恢复；过期记录可被自动清理             |
| 数据库备份与恢复    | 备份文件可正常创建；从备份恢复后数据完整               |

### Vision 模块

| 关键路径         | 测试要点                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| OCR 识别（Mock） | 正确解析 Mock 的 OCR API 响应；处理空结果和错误响应                         |
| AI 分析（Mock）  | 正确解析标签、描述；处理 API 超时和重试                                    |
| Embedding（Mock） | 正确构造 JinaAI 请求、校验 dimensions、分类错误码、验证重试策略           |
| Embedding（Live） | 默认跳过；通过 `QM_RUN_JINA_EMBEDDING_LIVE=1` 激活，并输出排序后的相似度结果 |
| 降级策略         | 云端不可用时 `isAvailable()` 返回 `false`，`recognize()` 返回空结果而非崩溃 |

### 核心路由模块

| 关键路径        | 测试要点                                                   |
| --------------- | ---------------------------------------------------------- |
| 路由分发        | 各 HTTP 方法 + 路径组合正确映射到对应 handler              |
| Auth Token 校验 | 缺少 Token 或 Token 错误时返回 `401`                       |
| 导入任务队列    | 任务入队、进度推送、队列满时拒绝新任务（`max_queue_size`） |
| 请求参数校验    | 缺少必填字段时返回 `400`，含非法值时返回明确错误信息       |

### 工具类

| 关键路径   | 测试要点                                               |
| ---------- | ------------------------------------------------------ |
| 配置解析   | 合法配置正确加载；缺少必填项时使用默认值；非法值时报错 |
| 日志格式化 | 各等级日志输出格式正确；低于最低等级的日志不输出       |

---

## 命名与编写规范

### 测试命名

采用 `TEST(模块名, When条件_Expect行为)` 格式，确保从测试名就能读懂测试意图：

```cpp
TEST(MemeDb, WhenInsertValidMeme_ExpectIdReturned)
TEST(MemeDb, WhenInsertDuplicateHash_ExpectRejected)
TEST(Router, WhenMissingAuthToken_ExpectUnauthorized401)
TEST(Vision, WhenApiTimeout_ExpectGracefulDegradation)
```

### 编写原则

- **一个测试只验证一件事**：避免在一个 `TEST()` 中堆砌多个不相关的断言
- **Arrange-Act-Assert 模式**：先准备数据，再执行操作，最后断言结果
- **测试应自给自足**：不依赖其他测试的执行顺序或残留数据
- **避免测试实现细节**：测试公开接口的行为，而非内部函数的调用顺序

### 常用断言

```cpp
EXPECT_EQ(actual, expected);     // 相等
EXPECT_NE(actual, unexpected);   // 不等
EXPECT_TRUE(condition);          // 为真
EXPECT_FALSE(condition);         // 为假
EXPECT_THROW(statement, ExType); // 抛出特定异常
EXPECT_NO_THROW(statement);      // 不抛出异常
EXPECT_NEAR(a, b, tolerance);    // 浮点近似（用于向量相似度）
```

---
