import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCategory, deleteCategory, updateCategory } from './categoryService';

const sendHttpRequestMock = vi.fn();

vi.mock('../api/httpClient', () => ({
    sendHttpRequest: (...args: unknown[]) => sendHttpRequestMock(...args),
}));

describe('categoryService', () => {
    beforeEach(() => {
        sendHttpRequestMock.mockReset();
        sendHttpRequestMock.mockResolvedValue(null);
    });

    it('uses the backend update category route', async () => {
        await updateCategory(12, { name: 'Renamed' });

        expect(sendHttpRequestMock).toHaveBeenCalledWith('PUT', '/api/categories/12', { name: 'Renamed' });
    });

    it('uses the backend delete category route', async () => {
        await deleteCategory(34);

        expect(sendHttpRequestMock).toHaveBeenCalledWith('DELETE', '/api/categories/34');
    });

    it('uses the backend create category route', async () => {
        await createCategory('Fresh', '#112233', 7);

        expect(sendHttpRequestMock).toHaveBeenCalledWith('POST', '/api/categories', {
            name: 'Fresh',
            color: '#112233',
            position: 7,
        });
    });

    it('passes category position in patch payloads', async () => {
        await updateCategory(12, { position: 3 });

        expect(sendHttpRequestMock).toHaveBeenCalledWith('PUT', '/api/categories/12', { position: 3 });
    });
});
