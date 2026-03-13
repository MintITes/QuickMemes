type EventHandler = (payload: unknown) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRetries = 0;
let isForcedDisconnect = false;

const MAX_RETRY_DELAY = 30000;
const INITIAL_RETRY_DELAY = 1000;

const subscribers: Map<string, Set<EventHandler>> = new Map();

export async function connectWebSocket() {
    isForcedDisconnect = false;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const config = await window.electronAPI.getBackendConfig();
    const url = `ws://127.0.0.1:${config.port}/ws?token=${config.token}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
        currentRetries = 0; // reset retries on successful connection
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && data.event) {
                const handlers = subscribers.get(data.event);
                if (handlers) {
                    handlers.forEach((fn) => fn(data.payload));
                }
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message', e);
        }
    };

    ws.onclose = () => {
        ws = null;
        if (!isForcedDisconnect) {
            scheduleReconnect();
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket encountered an error', err);
        // onclose will be called after onerror, so reconnect logic remains in onclose
    };
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, currentRetries), MAX_RETRY_DELAY);
    currentRetries++;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
    }, delay);
}

export function disconnectWebSocket() {
    isForcedDisconnect = true;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
}

export function onEvent(eventName: string, handler: EventHandler): () => void {
    if (!subscribers.has(eventName)) {
        subscribers.set(eventName, new Set());
    }
    subscribers.get(eventName)!.add(handler);

    return () => {
        const handlers = subscribers.get(eventName);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                subscribers.delete(eventName);
            }
        }
    };
}
