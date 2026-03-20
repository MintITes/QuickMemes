import '@testing-library/jest-dom';
import { server } from '../__mocks__/server';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from '../i18n/locales/zh-CN.json';
import enUS from '../i18n/locales/en-US.json';

// Initialize i18n for tests
i18n.use(initReactI18next).init({
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    ns: ['translation'],
    defaultNS: 'translation',
    resources: {
        'zh-CN': { translation: zhCN },
        'en-US': { translation: enUS }
    },
    interpolation: {
        escapeValue: false,
    }
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock global electronAPI for UI components tests
vi.stubGlobal('electronAPI', {
    readClipboardImage: vi.fn(),
    writeClipboardImageFromMeme: vi.fn(),
    openFileDialog: vi.fn().mockResolvedValue([]),
    openDirectoryDialog: vi.fn().mockResolvedValue(null),
    saveFileDialog: vi.fn().mockResolvedValue(null),
    getBackendConfig: vi.fn().mockResolvedValue({ bindAddress: '127.0.0.1', port: 57321, token: 'mock-token', ready: true }),
    getBackendStatus: vi.fn().mockResolvedValue({ bindAddress: '127.0.0.1', port: 57321, token: 'mock-token', ready: true, starting: false, pid: 1, lastExitCode: null, lastError: null }),
    onBackendStatusChange: vi.fn().mockImplementation(() => () => {}),
    getConfig: vi.fn().mockResolvedValue({
        backendPort: 57321,
        bindAddress: '127.0.0.1',
        storagePath: '/tmp/storage',
        dbPath: '/tmp/quickmemes.db',
        logDir: '/tmp/logs',
        maxQueueSize: 500,
        vision: { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', visionModel: 'gpt-4o', embeddingModel: 'text-embedding-3-small', timeoutSeconds: 30, maxRetries: 2 },
        ocr: { apiKey: '', apiUrl: '', provider: '' },
        ui: { panelShortcut: 'Alt+M', theme: 'system', viewMode: 'grid', language: 'zh-CN' },
        log: { minLevel: 'INFO', retentionEnabled: true, retentionDays: 30 },
        thumbnail: { enabled: true, maxSize: 300 },
        backup: { enabled: true, retentionDays: 30 },
        recycleBinRetentionDays: 30,
        workerCount: 4,
    }),
    setConfig: vi.fn().mockResolvedValue({ config: {}, restartRequired: false, hotPatched: true }),
    windowControls: vi.fn(),
    openExternal: vi.fn(),
    openDevTools: vi.fn(),
    platform: 'linux',
});

// Mock window.matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// JSDOM does not provide ResizeObserver, but Gallery depends on it during mount.
class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(...args: Parameters<ResizeObserver['observe']>) {
        void args;
        this.callback([], this as unknown as ResizeObserver);
    }

    unobserve() {}

    disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
