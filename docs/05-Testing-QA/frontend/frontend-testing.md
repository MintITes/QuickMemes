# 前端测试规范

> **所属层级**：QA / 前端测试  
> **测试框架**：Vitest + React Testing Library  
> **Mock 工具**：msw (Mock Service Worker)  
> **架构参考**：[frontend.md](../../03-Modules/frontend.md)

---

## 测试目录结构

采用**就近放置（co-location）**模式，测试文件紧贴被测源文件：

```
src/frontend/react/
├── components/
│   ├── GalleryGrid.tsx
│   ├── __tests__/
│   │   └── GalleryGrid.test.tsx      # Gallery 网格组件测试
│   ├── SearchBar.tsx
│   ├── __tests__/
│   │   └── SearchBar.test.tsx        # 搜索栏组件测试
│   ├── InspectorPanel.tsx
│   ├── __tests__/
│   │   └── InspectorPanel.test.tsx   # 属性面板组件测试
│   ├── TagManager.tsx
│   ├── __tests__/
│   │   └── TagManager.test.tsx       # 标签管理组件测试
│   ├── MemeCard.tsx
│   └── __tests__/
│       └── MemeCard.test.tsx         # 单个 Meme 卡片组件测试
│
├── api/
│   ├── httpClient.ts
│   ├── wsClient.ts
│   └── __tests__/
│       ├── httpClient.test.ts        # HTTP 客户端封装测试
│       └── wsClient.test.ts          # WebSocket 客户端测试
│
├── pages/
│   ├── MainPage.tsx
│   └── __tests__/
│       └── MainPage.test.tsx         # 主页面集成测试
│
└── __mocks__/
    ├── handlers.ts                   # msw 请求处理器定义
    └── server.ts                     # msw 测试服务器配置
```

### Vitest 配置

```typescript
// vitest.config.ts 核心片段
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./react/__mocks__/server.ts'],
    include: ['react/**/*.test.{ts,tsx}'],
  },
});
```

运行方式：

```bash
cd src/frontend
npx vitest              # 监听模式
npx vitest run          # 单次运行
npx vitest run --reporter=verbose   # 详细输出
```

---

## Mock 策略

### HTTP 请求 — msw (Mock Service Worker)

使用 msw 在网络层拦截请求，比手动 mock `fetch` 更接近真实行为：

```typescript
// __mocks__/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // 搜索接口 Mock
  http.post('/api/memes/search', () => {
    return HttpResponse.json({
      data: [
        { id: 1, name: '示例梗图', ocrText: '测试文本', tagIds: [1] },
      ],
      total: 1,
    });
  }),

  // 健康检查 Mock
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // 更多 handler...
];
```

```typescript
// __mocks__/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

测试中可在单个用例内覆盖默认响应：

```typescript
it('搜索失败时显示错误提示', async () => {
  server.use(
    http.post('/api/memes/search', () => {
      return HttpResponse.json({ error: '服务器错误' }, { status: 500 });
    }),
  );
  // ...渲染组件并断言错误提示出现
});
```

### Electron API — vi.mock()

模拟通过 `contextBridge` 暴露的 Electron 原生 API：

```typescript
// 模拟 window.electronAPI
vi.stubGlobal('electronAPI', {
  readClipboardImage: vi.fn().mockResolvedValue(null),
  writeClipboardImage: vi.fn().mockResolvedValue(undefined),
  openFileDialog: vi.fn().mockResolvedValue(['/path/to/image.png']),
  registerGlobalShortcut: vi.fn(),
});
```

### WebSocket 事件

模拟 WebSocket 推送事件，验证前端的实时 UI 响应：

```typescript
// 模拟 WebSocket 客户端
const mockWsClient = {
  onMessage: vi.fn(),
  simulateEvent(event: string, data: unknown) {
    this.onMessage({ event, data });
  },
};

it('收到 meme:added 事件时刷新 Gallery', async () => {
  mockWsClient.simulateEvent('meme:added', { id: 42, name: '新梗图' });
  // ...断言 Gallery 中出现新 Meme
});
```

---

## 关键路径测试清单

以下路径**必须**有测试覆盖。

### 组件层

| 关键路径         | 测试要点                                                     |
| ---------------- | ------------------------------------------------------------ |
| 搜索框防抖       | 输入后等待防抖结束才发出请求；快速连续输入只发一次请求       |
| Gallery 网格渲染 | 传入 Meme 列表后正确渲染卡片；空列表显示空状态               |
| 双击复制         | 双击 MemeCard 调用 `writeClipboardImage()`；显示复制成功反馈 |
| 拖拽导入 UI 状态 | 拖入文件时显示 Drop Zone；松开后触发导入请求                 |
| Inspector 面板   | 选中 Meme 后面板显示元数据；编辑字段后发送更新请求           |
| 标签管理         | 创建标签、为 Meme 添加/移除标签的 UI 流程                    |
| 错误状态渲染     | API 返回错误时显示错误提示；网络不可用时显示离线提示         |
| 空状态渲染       | 图库为空时显示引导提示；搜索无结果时显示"无匹配"提示         |

### API 客户端层

| 关键路径           | 测试要点                                             |
| ------------------ | ---------------------------------------------------- |
| HTTP 请求封装      | 正确携带 Auth Token；超时处理；请求/响应 JSON 序列化 |
| WebSocket 连接管理 | 连接建立与断开；心跳 ping/pong 处理；断线重连逻辑    |
| 事件分发           | 收到 WebSocket 事件后正确分发给对应的监听器          |

### 页面级

| 关键路径       | 测试要点                                         |
| -------------- | ------------------------------------------------ |
| 主页面初始加载 | 页面挂载后自动请求 Meme 列表并渲染 Gallery       |
| 搜索 → 结果    | 输入关键词 → 请求发出 → Gallery 更新为搜索结果   |
| 实时更新       | 收到 `meme:added` 事件后 Gallery 自动追加新 Meme |

---

## 编写规范

### 文件命名

- 测试文件：`*.test.tsx`（组件）或 `*.test.ts`（非 UI 逻辑）
- Mock 文件：`__mocks__/` 目录内

### 测试结构

采用 `describe` + `it` 分层，描述清晰：

```typescript
describe('SearchBar', () => {
  it('输入关键词后触发防抖搜索', async () => {
    // Arrange
    render(<SearchBar onSearch={mockOnSearch} />);

    // Act
    await userEvent.type(screen.getByRole('searchbox'), '猫咪');

    // Assert
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '猫咪' }),
      );
    });
  });

  it('清空输入时重置搜索', async () => {
    // ...
  });
});
```

### 查询优先级

按 React Testing Library 推荐的优先级选择查询方法：

1. `getByRole` — 最优先，语义化最强
2. `getByText` — 按可见文本查找
3. `getByPlaceholderText` — 表单元素
4. `getByTestId` — 最后手段，仅当上述方法均不适用时使用

### 编写原则

- **测试用户行为，而非实现细节**：不要断言组件内部 state，而是断言渲染输出和用户可感知的变化
- **每个 `it` 只验证一个场景**：保持测试的原子性和可读性
- **善用 `userEvent` 而非 `fireEvent`**：`userEvent` 更贴近真实用户操作（如自动触发 focus、change、blur 事件序列）

---
