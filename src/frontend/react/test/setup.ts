import '@testing-library/jest-dom';
import { server } from '../__mocks__/server';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';

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
