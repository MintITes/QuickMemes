import { describe, it, expect, beforeEach } from 'vitest';
import { useMemeStore } from '../MemeStore';

const meme1 = {
    id: 1,
    name: '1.png',
    filePath: '/1.png',
    fileHash: 'hash1',
    mimeType: 'image/png',
    fileSize: 1024,
    width: 100,
    height: 100,
    sourceName: '',
    sourceUrl: '',
    description: '',
    ocrText: '',
    ocrStatus: 'PENDING' as const,
    aiStatus: 'PENDING' as const,
    tagIds: [],
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: 0,
    deletedAt: 0,
    categoryId: 0,
};

const meme2 = { ...meme1, id: 2, name: '2.png', fileHash: 'hash2', filePath: '/2.png' };

describe('MemeStore', () => {
    beforeEach(() => {
        useMemeStore.setState({ memes: [], isLoading: false, totalCount: 0 });
    });

    it('should set, upsert, update and remove memes', () => {
        useMemeStore.getState().setMemes([meme1], 1);
        expect(useMemeStore.getState().memes).toHaveLength(1);

        useMemeStore.getState().upsertMeme(meme2);
        expect(useMemeStore.getState().memes).toHaveLength(2);

        useMemeStore.getState().updateMeme(1, { name: 'updated.png' });
        expect(useMemeStore.getState().memes.find((item) => item.id === 1)?.name).toBe('updated.png');

        useMemeStore.getState().removeMemes([1]);
        expect(useMemeStore.getState().memes).toHaveLength(1);
        expect(useMemeStore.getState().totalCount).toBe(1);
    });

    it('does not change totalCount when removing missing memes', () => {
        useMemeStore.getState().setMemes([meme1], 1);

        useMemeStore.getState().removeMemes([999, 999]);

        expect(useMemeStore.getState().memes).toHaveLength(1);
        expect(useMemeStore.getState().totalCount).toBe(1);
    });
});
