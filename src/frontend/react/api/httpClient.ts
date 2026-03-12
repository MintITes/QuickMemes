// global type declaration for electronAPI
declare global {
    interface Window {
        electronAPI: {
            getBackendConfig: () => Promise<{ port: number; token: string }>;
            // other methods will be added here
        };
    }
}

export class HttpError extends Error {
    public status: number;
    constructor(status: number, message: string) {
        super(`HTTP Error ${status}: ${message}`);
        this.name = 'HttpError';
        this.status = status;
    }
}

export async function sendHttpRequest<T>(method: string, path: string, body?: object): Promise<T> {
    const { port, token } = await window.electronAPI.getBackendConfig();

    const url = `http://127.0.0.1:${port}${path}`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
    };

    const options: RequestInit = {
        method,
        headers,
    };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        let errorMsg = 'Server Error';
        try {
            const errorJson = await response.json();
            if (errorJson && errorJson.error) {
                errorMsg = errorJson.error;
            }
        } catch (e) {
            // Ignored if response is not JSON
        }
        throw new HttpError(response.status, errorMsg);
    }

    return response.json();
}
