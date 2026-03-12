import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendHttpRequest } from '../httpClient';
import { server } from '../../__mocks__/server';
import { http, HttpResponse } from 'msw';

describe('httpClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send successful HTTP request and return deserialized JSON', async () => {
        server.use(
            http.post('http://127.0.0.1:57321/api/test', async ({ request }) => {
                const auth = request.headers.get('Authorization');
                expect(auth).toBe('Bearer mock-token');
                const body = await request.json();
                expect(body).toEqual({ payload: 'hello' });
                return HttpResponse.json({ success: true, data: 'world' });
            })
        );

        const result = await sendHttpRequest('POST', '/api/test', { payload: 'hello' });
        expect(result).toEqual({ success: true, data: 'world' });
    });

    it('should throw an error with status and message on 4xx', async () => {
        server.use(
            http.get('http://127.0.0.1:57321/api/fail', () => {
                return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
            })
        );

        await expect(sendHttpRequest('GET', '/api/fail')).rejects.toThrowError('HTTP Error 404: Not Found');
    });

    it('should handle unparseable JSON error responses', async () => {
        server.use(
            http.get('http://127.0.0.1:57321/api/fail-html', () => {
                return new HttpResponse('<html>error</html>', { status: 500, headers: { 'Content-Type': 'text/html' } });
            })
        );

        await expect(sendHttpRequest('GET', '/api/fail-html')).rejects.toThrowError('HTTP Error 500: Server Error');
    });
});
