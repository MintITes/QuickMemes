import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectWebSocket, disconnectWebSocket, onEvent } from '../wsClient';

let lastSocket: MockWebSocket | null = null;

class MockWebSocket {
    url: string;
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    readyState = 0;

    constructor(url: string) {
        this.url = url;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastSocket = this;
        setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) this.onopen();
        }, 10);
    }

    close() {
        this.readyState = 3;
        if (this.onclose) this.onclose({ code: 1000 });
    }

    mockMessage(data: string) {
        if (this.onmessage) {
            this.onmessage({ data });
        }
    }

    mockDisconnect() {
        this.readyState = 3;
        if (this.onclose) this.onclose({ code: 1006 });
    }
}

describe('wsClient', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('WebSocket', MockWebSocket);
        vi.clearAllMocks();
    });

    afterEach(() => {
        disconnectWebSocket();
        vi.useRealTimers();
    });

    it('should connect to WebSocket using config from electronAPI', async () => {
        await connectWebSocket();

        expect(window.electronAPI.getBackendConfig).toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(10);
        expect(lastSocket?.url).toBe('ws://127.0.0.1:57321/ws?token=mock-token');
        expect(lastSocket?.readyState).toBe(1);
    });

    it('should distribute events to subscribers', async () => {
        const handler = vi.fn();
        const unsubscribe = onEvent('meme:deleted', handler);

        await connectWebSocket();
        await vi.advanceTimersByTimeAsync(10);

        lastSocket?.mockMessage(JSON.stringify({ event: 'meme:deleted', payload: { id: 1 } }));
        expect(handler).toHaveBeenCalledWith({ id: 1 });
        unsubscribe();
    });
});
