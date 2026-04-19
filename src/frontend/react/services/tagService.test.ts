import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeTagFromMeme } from './tagService';

const sendHttpRequestMock = vi.fn();

vi.mock('../api/httpClient', () => ({
    sendHttpRequest: (...args: unknown[]) => sendHttpRequestMock(...args),
}));

describe('tagService', () => {
    beforeEach(() => {
        sendHttpRequestMock.mockReset();
        sendHttpRequestMock.mockResolvedValue(null);
    });

    it('uses the backend delete tags route when removing a meme tag', async () => {
        await removeTagFromMeme(12, 34);

        expect(sendHttpRequestMock).toHaveBeenCalledWith('DELETE', '/api/meme/12/tags/34');
    });
});
