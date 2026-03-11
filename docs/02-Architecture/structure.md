# QuickMemes 项目目录结构设计 (Draft 2)

`QuickMemes/` (项目根目录)
├── `docs/`                 # 项目文档库 (已存在，包含架构设计、API协议等)
│   ├── `arch/`             # 详细子模块架构文档
│   └── ...                 
│
├── `build/`                # 构建输出目录 (此目录通常会被 .gitignore 忽略)
│   ├── `backend/`          # C++ 后端编译输出目录 (存放生成的二进制执行文件及依赖动态库)
│   └── `frontend/`         # 前端 Vite 打包输出产物目录
│
├── `src/`                  # 源代码根目录
│   ├── `backend/`          # C++ 后端核心代码 (CMake 项目)
│   │   ├── `CMakeLists.txt`# 后端构建脚本 (定义目标、外部依赖拉取等)
│   │   ├── `src/`          # C++ 源码 (.cpp / .hpp)
│   │   │   ├── `core/`     # 路由、HTTP/WebSocket 处理、任务调度
│   │   │   ├── `vision/`   # OCR、AI 接口调用逻辑
│   │   │   ├── `db/`       # SQLite 持久化、sqlite-vec 扩展调用
│   │   │   └── `utils/`    # 日志、配置解析等工具类
│   │   ├── `third_party/`  # 第三方依赖 (存放 header-only 或少量源文件的轻量级库源码。大型依赖库通过 CMake fetch 或 git submodule 管理)
│   │   └── `tests/`        # C++ 单元测试代码 (GTest / Catch2)
│   │
│   └── `frontend/`         # 前端代码 (Electron + React + Vite 构建)
│       ├── `package.json`  # 前端依赖配置及 Vite 构建脚本
│       ├── `vite.config.ts`# Vite 配置文件
│       ├── `electron/`     # Electron 主进程代码 (TypeScript)
│       │   ├── `main.ts`   # Electron 入口、后端进程管理
│       │   └── `preload.ts`# contextBridge 桥接脚本
│       └── `react/`        # React 渲染进程代码 (TypeScript)
│           ├── `components/`# 可复用 UI 组件
│           ├── `pages/`    # 主要功能页面 (主界面、设置页等)
│           ├── `api/`      # HTTP 及 WebSocket 客户端封装模块
│           └── `assets/`   # 前端专属静态资源 (CSS, 图片等)
│
├── `scripts/`              # 自动化脚本 (如一键编译后端、运行测试、打包应用等脚本)
├── `resources/`            # 全局静态资源 (已存在，Logo、图标等)
├── `.gitignore`            # Git 忽略配置
├── `LICENSE`               # 开源协议
└── `README.md`             # 项目简述、快速启动指南
