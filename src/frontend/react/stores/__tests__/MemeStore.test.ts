import { describe, it, expect, beforeEach } from 'vitest';
import { useMemeStore } from '../MemeStore';

describe('MemeStore', () => {
    beforeEach(() => {
        useMemeStore.setState({ memes: [], isLoading: false, totalCount: 0 });
    });

    it('should set and add memes', () => {
        const meme1 = { id: 1, name: '1.png', filePath: '/1.png', tagIds: [], width: 100, height: 100, size: 1024, format: 'png', createdAt: 0, updatedAt: 0 };
        const meme2 = { id: 2, name: '2.png', filePath: '/2.png', tagIds: [], width: 100, height: 100, size: 1024, format: 'png', createdAt: 0, updatedAt: 0 };

        useMemeStore.getState().setMemes([meme1]);
        expect(useMemeStore.getState().memes).toHaveLength(1);

        useMemeStore.getState().addMemes([meme2]);
        expect(useMemeStore.getState().memes).toHaveLength(2);
        expect(useMemeStore.getState().memes[1].id).toBe(2);
    });

    it('should update meme', () => {
        const meme1 = { id: 1, name: '1.png', filePath: '/1.png', tagIds: [], width: 100, height: 100, size: 1024, format: 'png', createdAt: 0, updatedAt: 0 };
        useMemeStore.setState({ memes: [meme1] });

        useMemeStore.getState().updateMeme(1, { name: 'updated.png' });
        expect(useMemeStore.getState().memes[0].name).toBe('updated.png');
    });

    it('should remove memes', () => {
        const meme1 = { id: 1, name: '1.png', filePath: '/1.png', tagIds: [], width: 100, height: 100, size: 1024, format: 'png', createdAt: 0, updatedAt: 0 };
        const meme2 = { id: 2, name: '2.png', filePath: '/2.png', tagIds: [], width: 100, height: 100, size: 1024, format: 'png', createdAt: 0, updatedAt: 0 };
        useMemeStore.setState({ memes: [meme1, meme2] });

        useMemeStore.getState().removeMemes([1]);
        expect(useMemeStore.getState().memes).toHaveLength(1);
        expect(useMemeStore.getState().memes[0].id).toBe(2);
    });
});
