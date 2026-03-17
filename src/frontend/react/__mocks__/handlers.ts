import { http, HttpResponse } from 'msw';

export const handlers = [
    http.get('http://127.0.0.1:57321/api/health', () => {
        return HttpResponse.json({ success: true, data: { status: 'ok', modules: { db: true, vision: true } }, error: '', code: 0 });
    }),
    http.get('http://127.0.0.1:57321/api/categories', () => HttpResponse.json({ success: true, data: [], error: '', code: 0 })),
    http.get('http://127.0.0.1:57321/api/tags', () => HttpResponse.json({ success: true, data: [], error: '', code: 0 })),
    http.post('http://127.0.0.1:57321/api/memes/search', () =>
        HttpResponse.json({ success: true, data: { items: [], total: 0 }, error: '', code: 0 })
    ),
    http.get('http://127.0.0.1:57321/api/memes/trash', () => HttpResponse.json({ success: true, data: [], error: '', code: 0 })),
];
