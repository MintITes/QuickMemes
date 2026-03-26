import { describe, it, expect, beforeEach } from 'vitest';
import { useTagStore } from '../TagStore';

describe('TagStore', () => {
    beforeEach(() => {
        useTagStore.setState({ tags: [], isLoading: false });
    });

    it('should add, update, and remove tags', () => {
        const tag1 = { id: 1, name: 'funny', color: '#fff', createdAt: 0 };

        useTagStore.getState().addTag(tag1);
        expect(useTagStore.getState().tags).toHaveLength(1);

        useTagStore.getState().updateTag(1, { color: '#ff0000' });
        expect(useTagStore.getState().tags[0].color).toBe('#ff0000');

        useTagStore.getState().removeTag(1);
        expect(useTagStore.getState().tags).toHaveLength(0);
    });

    it('should upsert tags by id when the same tag is added twice', () => {
        useTagStore.getState().addTag({ id: 1, name: 'funny', color: '#fff', createdAt: 0 });
        useTagStore.getState().addTag({ id: 1, name: 'funny', color: '#000', createdAt: 1 });

        expect(useTagStore.getState().tags).toHaveLength(1);
        expect(useTagStore.getState().tags[0]).toEqual({
            id: 1,
            name: 'funny',
            color: '#000',
            createdAt: 1,
        });
    });
});
