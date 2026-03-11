# QuickMemes 测试与质量保证策略

> **所属层级**：项目级 QA 规范  
> **架构参考**：[Arch.md](../02-Architecture/overview.md)（全局架构总索引）

---

## QA 核心原则

| 原则       | 说明                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| 务实导向   | 不追求覆盖率数字，但所有**关键路径**（数据库读写、IPC 通信、图片处理流水线等）必须有测试 |
| 分层 Mock  | 前后端测试互不依赖——后端 Mock HTTP 请求，前端 Mock 后端响应，各自可独立运行              |
| 快速反馈   | 单元测试秒级完成，组件测试分钟级完成，E2E 测试仅在里程碑时运行                           |
| 测试即文档 | 测试用例本身就是模块行为的最佳文档，命名清晰、意图明确                                   |

---

## 框架选型

| 测试层              | 框架 / 工具                        | 用途                                               |
| ------------------- | ---------------------------------- | -------------------------------------------------- |
| C++ 后端单元测试    | **Google Test (GTest)**            | 后端各模块（持久化、Vision、核心路由等）的逻辑验证 |
| 前端组件 / 集成测试 | **Vitest + React Testing Library** | React 组件渲染、交互行为、API 客户端层验证         |
| 前端 Mock 服务      | **msw (Mock Service Worker)**      | 拦截前端 HTTP 请求，模拟后端响应                   |
| 端到端 (E2E) 测试   | **Playwright**                     | Electron 应用完整流程自动化测试                    |

---

## 文档索引

| 文档                                       | 说明                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| [backend-testing.md](backend/backend-testing.md)   | C++ 后端测试规范：GTest 配置、目录结构、Mock 策略、关键路径清单      |
| [frontend-testing.md](frontend/frontend-testing.md) | 前端测试规范：Vitest + RTL 配置、组件测试、Mock Server、关键路径清单 |
| [e2e-testing.md](e2e/e2e-testing.md)           | E2E 测试规范：Playwright + Electron 集成、测试场景清单、运行策略     |

---

## 测试目录结构约定

```
QuickMemes/
├── src/
│   ├── backend/
│   │   └── tests/                    # C++ 后端测试代码（GTest）
│   │       ├── CMakeLists.txt        # 测试构建脚本
│   │       ├── core/                 # 核心模块测试
│   │       ├── db/                   # 持久化模块测试
│   │       ├── vision/               # Vision 模块测试
│   │       └── utils/                # 工具类测试
│   │
│   └── frontend/
│       ├── react/
│       │   ├── components/
│       │   │   └── __tests__/        # 组件测试（就近放置）
│       │   ├── api/
│       │   │   └── __tests__/        # API 客户端测试
│       │   └── pages/
│       │       └── __tests__/        # 页面级测试
│       └── e2e/                      # E2E 测试（Playwright）
│           ├── playwright.config.ts
│           ├── fixtures/             # 测试用图片素材
│           ├── tests/                # 测试用例
│           └── helpers/              # 辅助工具函数
```

---
