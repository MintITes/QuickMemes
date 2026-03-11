# QuickMemes 开发文档库

欢迎来到 QuickMemes 的项目文档主页。为了保持文档结构的清晰与条理，我们对文档进行了模块化的编排。请根据您的需求进入对应的目录查阅文档：

## 目录导航

- **[01-Product (产品与需求)](./01-Product/)**  
  包含了该项目的核心功能规划与功能清单。主要包括：
  - [features.md](./01-Product/features.md) - 项目主要功能点列表和未来发布计划。

- **[02-Architecture (总体架构设计)](./02-Architecture/)**  
  系统层面的设计与选型，为了解整体架构的最佳入口。主要包括：
  - [overview.md](./02-Architecture/overview.md) - 包含了前端、通信层、后端的全局架构图与共享数据结构。
  - [structure.md](./02-Architecture/structure.md) - 详述了项目的源码目录结构和预期摆放规范。
  - [tech_stack.md](./02-Architecture/tech_stack.md) - 罗列了前端、后端、持久化、AI 集成相关所有使用的技术栈。

- **[03-Modules (各核心子模块详细设计)](./03-Modules/)**  
  按功能领域划分了应用各端模块的详细设计与 API 说明：
  - [cpp_core.md](./03-Modules/cpp_core.md) - C++ 核心模块，管理 HTTP / WS 服务器及路由。
  - [frontend.md](./03-Modules/frontend.md) - 前端模块（Electron 主进程 / React 渲染进程交互）。
  - [ipc_protocol.md](./03-Modules/ipc_protocol.md) - 前后端间 HTTP 与 WebSocket 通信协议及规范。
  - [config.md](./03-Modules/config.md) - 配置文件与运行时命令行参数详细说明。
  - [logger.md](./03-Modules/logger.md) - 前后端统一的日志记录设计。
  - [persistence.md](./03-Modules/persistence.md) - 基于 SQLite 和 sqlite-vec 的持久化方案。
  - [vision.md](./03-Modules/vision.md) - 关于 OCR 与 AI 服务集成的视觉分析设计方案。

- **[04-UI-UX (界面交互与视觉设计)](./04-UI-UX/)**  
  包含了整个 UI 界面的各项规范与设计细则：
  - [overview.md](./04-UI-UX/overview.md) - UI/UX 模块总览。
  - [layout.md](./04-UI-UX/layout.md) - 应用布局规范及热区分布。
  - [components.md](./04-UI-UX/components.md) - 复用业务组件设计细则。
  - [dialogs.md](./04-UI-UX/dialogs.md) - 各类弹窗（气泡、通知）的设计。
  - [floating-panel.md](./04-UI-UX/floating-panel.md) - 全局悬浮置顶查询面板行为规范。
  - [interactions.md](./04-UI-UX/interactions.md) - 用户快捷键、拖拽、操作习惯说明。
  - [visual-style.md](./04-UI-UX/visual-style.md) - 统一的视觉、配色、主题规则。

- **[05-Testing-QA (测试保障体系)](./05-Testing-QA/)**  
  保证应用上线质量的各项自动化测试指导方向：
  - [overview.md](./05-Testing-QA/overview.md) - 质量保证的策略及测试手段说明。
  - [frontend/frontend-testing.md](./05-Testing-QA/frontend/frontend-testing.md) - React 与前台相关测试。
  - [backend/backend-testing.md](./05-Testing-QA/backend/backend-testing.md) - C++ 后台接口与底层测试。
  - [e2e/e2e-testing.md](./05-Testing-QA/e2e/e2e-testing.md) - Playwright + Electron 的端到端测试用例。
