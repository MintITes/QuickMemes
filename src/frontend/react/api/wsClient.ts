import type { WsEventMap, WsEventName } from '../types';

type EventHandler<K extends WsEventName> = (payload: WsEventMap[K]) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentRetries = 0;
let isForcedDisconnect = false;

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

const subscribers = new Map<WsEventName, Set<(payload: unknown) => void>>();

export async function connectWebSocket() {
    isForcedDisconnect = false;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const config = await window.electronAPI.getBackendConfig();
    if (!config.ready) {
        return;
    }

    const url = `ws://${config.bindAddress}:${config.port}/ws?token=${config.token}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
        currentRetries = 0;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
        }
        heartbeatTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
        }, 25_000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data) as { event?: WsEventName; payload?: unknown; data?: unknown };
            if (!data.event) {
                return;
            }
            const handlers = subscribers.get(data.event);
            const payload = data.payload ?? data.data;
            handlers?.forEach((handler) => handler(payload));
        } catch (error) {
            console.error('Failed to parse WebSocket message', error);
        }
    };

    ws.onclose = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        ws = null;
        if (!isForcedDisconnect) {
            scheduleReconnect();
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket encountered an error', error);
    };
}

function scheduleReconnect() {
    if (reconnectTimer) {
        return;
    }

    const delay = Math.min(INITIAL_RETRY_DELAY * (2 ** currentRetries), MAX_RETRY_DELAY);
    currentRetries += 1;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connectWebSocket();
    }, delay);
}

export function disconnectWebSocket() {
    isForcedDisconnect = true;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
}

export function onEvent<K extends WsEventName>(eventName: K, handler: EventHandler<K>) {
    const current = subscribers.get(eventName) ?? new Set<(payload: unknown) => void>();
    const wrapped = handler as (payload: unknown) => void;
    current.add(wrapped);
    subscribers.set(eventName, current);

    return () => {
        const handlers = subscribers.get(eventName);
        if (!handlers) {
            return;
        }
        handlers.delete(wrapped);
        if (handlers.size === 0) {
            subscribers.delete(eventName);
        }
    };
}
