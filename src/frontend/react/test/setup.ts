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
    writeClipboardImage: vi.fn(),
    openFileDialog: vi.fn(),
    saveFileDialog: vi.fn(),
    registerGlobalShortcut: vi.fn(),
    unregisterGlobalShortcut: vi.fn(),
    showMemePanel: vi.fn(),
    hideMemePanel: vi.fn(),
    getBackendConfig: vi.fn().mockResolvedValue({ port: 57321, token: 'mock-token' }),
    windowControls: vi.fn(),
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
