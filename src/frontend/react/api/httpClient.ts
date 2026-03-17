import type { ApiResponse } from '../types';

export class HttpError extends Error {
    public status: number;
    public code?: number;

    constructor(status: number, message: string, code?: number) {
        super(`HTTP Error ${status}: ${message}`);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
    }
}

type ResponseKind = 'json' | 'blob' | 'raw';

async function buildRequest(path: string, init?: RequestInit) {
    const { bindAddress, port, token } = await window.electronAPI.getBackendConfig();
    const url = `http://${bindAddress}:${port}${path}`;
    const headers = new Headers(init?.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);

    return {
        url,
        options: {
            ...init,
            headers,
        } satisfies RequestInit,
    };
}

async function parseError(response: Response) {
    let message = response.statusText || 'Server Error';
    let code: number | undefined;

    try {
        const json = (await response.json()) as Partial<ApiResponse<unknown>>;
        if (typeof json.error === 'string' && json.error) {
            message = json.error;
        }
        if (typeof json.code === 'number') {
            code = json.code;
        }
    } catch {
        // Ignore invalid JSON bodies and fall back to the status text.
    }

    throw new HttpError(response.status, message, code);
}

async function request<T>(method: string, path: string, body?: unknown, responseKind: ResponseKind = 'json') {
    const headers: Record<string, string> = {};
    const init: RequestInit = { method, headers };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    const { url, options } = await buildRequest(path, init);
    const response = await fetch(url, options);

    if (!response.ok) {
        await parseError(response);
    }

    if (responseKind === 'blob') {
        return response.blob() as Promise<T>;
    }
    if (responseKind === 'raw') {
        return response as T;
    }

    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.success) {
        throw new HttpError(response.status, payload.error || 'Request failed', payload.code);
    }
    return payload.data;
}

export async function sendHttpRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return request<T>(method, path, body, 'json');
}

export async function sendBlobRequest(path: string): Promise<Blob> {
    return request<Blob>('GET', path, undefined, 'blob');
}
