import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackendSearchQuery, triggerMemeOcr } from './memeService';

const sendHttpRequestMock = vi.fn();

vi.mock('../api/httpClient', () => ({
    sendHttpRequest: (...args: unknown[]) => sendHttpRequestMock(...args),
}));

describe('memeService', () => {
    beforeEach(() => {
        sendHttpRequestMock.mockReset();
        sendHttpRequestMock.mockResolvedValue({ taskId: 'ocr-1' });
    });

    it('maps untagged nav to backend uncategorized filter', () => {
        const query = buildBackendSearchQuery(
            {
                keyword: '',
                categoryId: 0,
                tagIds: [],
                matchMode: 'fuzzy',
                mediaType: 'all',
                dateRange: 'all',
            },
            'untagged'
        );

        expect(query.categoryId).toBe(-1);
        expect(query.enablePinyin).toBe(true);
    });

    it('allows overriding the backend pinyin search toggle', () => {
        const query = buildBackendSearchQuery(
            {
                keyword: 'test',
                categoryId: 0,
                tagIds: [],
                matchMode: 'fuzzy',
                mediaType: 'all',
                dateRange: 'all',
            },
            'all',
            { enablePinyin: false }
        );

        expect(query.enablePinyin).toBe(false);
    });

    it('uses the backend manual OCR route', async () => {
        await triggerMemeOcr(42);

        expect(sendHttpRequestMock).toHaveBeenCalledWith('POST', '/api/meme/42/ocr');
    });
});
