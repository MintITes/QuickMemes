# E2E 测试规范

> **所属层级**：QA / 端到端测试  
> **测试框架**：Playwright  
> **架构参考**：[frontend.md](../../03-Modules/frontend.md) · [ipc_protocol.md](../../03-Modules/ipc_protocol.md)

---

## 测试目录结构

E2E 测试独立于组件测试，放置在前端目录下的顶层位置：

```
src/frontend/e2e/
├── playwright.config.ts         # Playwright 配置（Electron 启动参数）
├── fixtures/                    # 测试用图片素材
│   ├── sample-meme.png          # 标准测试图（小尺寸，< 100KB）
│   ├── sample-gif.gif           # GIF 格式测试图
│   └── large-image.jpg          # 大尺寸图片（用于边界测试）
├── tests/
│   ├── app-startup.spec.ts      # 应用启动与健康检查
│   ├── import.spec.ts           # 导入流程测试
│   ├── search.spec.ts           # 搜索与过滤测试
│   ├── gallery.spec.ts          # Gallery 浏览与交互测试
│   ├── tag-management.spec.ts   # 标签管理流程测试
│   └── settings.spec.ts        # 设置页面测试
└── helpers/
    ├── app-launcher.ts          # Electron 应用启动/关闭辅助函数
    └── wait-for-backend.ts      # 等待后端就绪的轮询工具
```

---

## Playwright + Electron 集成

### 启动配置

Playwright 原生支持 Electron 应用测试，通过 `electron.launch()` API 启动应用：

```typescript
// helpers/app-launcher.ts
import { _electron as electron, type ElectronApplication } from 'playwright';

export async function launchApp(): Promise<ElectronApplication> {
  const app = await electron.launch({
    args: ['./dist/electron/main.js'],  // Electron 入口文件
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });
  return app;
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
```

### 等待后端就绪

由于 Electron 启动后需要等待 C++ 后端子进程完成初始化，E2E 测试必须先确认后端可用：

```typescript
// helpers/wait-for-backend.ts
import type { Page } from 'playwright';

export async function waitForBackend(
  page: Page,
  timeoutMs = 10000,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await page.evaluate(async () => {
        const res = await fetch('http://127.0.0.1:PORT/api/health');
        return res.ok;
      });
      if (response) return;
    } catch {
      // 后端尚未就绪，继续等待
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('后端健康检查超时');
}
```

### Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,           // 单个测试 30 秒超时
  retries: 1,               // 允许 1 次重试（防止 Electron 启动偶发波动）
  use: {
    trace: 'on-first-retry', // 失败重试时自动录制 trace
  },
});
```

---

## 核心测试场景清单

以下是 E2E 测试**必须覆盖**的完整用户场景。

### 应用启动

| 场景             | 验证要点                                                    |
| ---------------- | ----------------------------------------------------------- |
| 冷启动           | Electron 窗口正常打开；C++ 后端健康检查通过；主界面完整加载 |
| 首次启动（空库） | Gallery 显示空状态引导提示                                  |

### 导入流程

| 场景           | 验证要点                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| 拖拽导入       | 拖拽图片文件到窗口 → Drop Zone 出现 → 松开后触发导入 → Gallery 出现新 Meme |
| 文件对话框导入 | 点击导入按钮 → 选择文件 → 导入完成 → Gallery 更新                          |
| 重复文件导入   | 导入已存在的文件 → 显示"已存在"提示而非重复入库                            |

### 搜索与过滤

| 场景       | 验证要点                                     |
| ---------- | -------------------------------------------- |
| 关键词搜索 | 输入关键词 → Gallery 实时过滤显示匹配结果    |
| 标签过滤   | 点击左侧标签 → Gallery 仅显示含该标签的 Meme |
| 清空搜索   | 清空搜索框 → Gallery 恢复显示全部 Meme       |

### Gallery 交互

| 场景         | 验证要点                                             |
| ------------ | ---------------------------------------------------- |
| 双击复制     | 双击 Meme 卡片 → 图片被写入剪贴板 → 显示复制成功反馈 |
| 选中查看详情 | 单击 Meme 卡片 → Inspector 面板展示该 Meme 的元数据  |

### 标签管理

| 场景             | 验证要点                                             |
| ---------------- | ---------------------------------------------------- |
| 创建标签         | 创建新标签 → 左侧标签列表出现新标签                  |
| 为 Meme 添加标签 | 选中 Meme → 添加标签 → Inspector 显示已关联的标签    |
| 删除标签         | 删除标签 → 标签列表移除 → 关联的 Meme 不再显示该标签 |

### 删除与恢复

| 场景      | 验证要点                                             |
| --------- | ---------------------------------------------------- |
| 删除 Meme | 删除 Meme → Gallery 移除该 Meme → 回收站出现对应记录 |
| 恢复 Meme | 在回收站中恢复 Meme → Gallery 重新出现该 Meme        |

---

## 运行策略

E2E 测试涉及启动完整的 Electron 应用和 C++ 后端进程，执行时间较长。运行策略如下：

| 时机             | 运行方式           | 说明                                               |
| ---------------- | ------------------ | -------------------------------------------------- |
| 日常开发         | **不自动运行**     | E2E 测试耗时较久，开发中依靠单元测试和组件测试保障 |
| 功能里程碑完成时 | **手动运行**       | 完成一个功能模块后执行完整 E2E 验证                |
| 后续 CI 接入     | **合并前门控检查** | 作为 PR 合并到主分支前的必须通过项（未来规划）     |

### 运行命令

```bash
cd src/frontend
npx playwright test                # 运行全部 E2E 测试
npx playwright test import.spec.ts # 运行单个测试文件
npx playwright test --headed       # 有界面模式（调试用）
npx playwright show-report         # 查看 HTML 测试报告
```

---

## 编写规范

### 文件命名

- 测试文件：`*.spec.ts`（与 Vitest 的 `*.test.ts` 区分）
- 辅助文件：`helpers/` 目录内

### 测试结构

```typescript
import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from '../helpers/app-launcher';
import { waitForBackend } from '../helpers/wait-for-backend';

test.describe('导入流程', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    app = await launchApp();
    page = await app.firstWindow();
    await waitForBackend(page);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('拖拽图片文件后 Gallery 出现新 Meme', async () => {
    // Arrange: 准备测试用图片文件路径
    // Act: 模拟拖拽操作
    // Assert: 验证 Gallery 中出现新 Meme 卡片
  });
});
```

### 编写原则

- **模拟真实用户操作**：使用 Playwright 的高层 API（`click`、`fill`、`dragAndDrop`）而非直接操作 DOM
- **等待而非 sleep**：使用 `expect(locator).toBeVisible()` 等自动等待断言，避免硬编码 `setTimeout`
- **测试间相互独立**：每组测试在 `beforeAll` 中启动全新的应用实例，避免残留状态互相影响
- **保持测试素材轻量**：`fixtures/` 中的图片应尽可能小（< 100KB），减少测试执行时间

---
