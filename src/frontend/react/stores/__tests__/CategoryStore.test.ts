import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '../CategoryStore';

describe('CategoryStore', () => {
    beforeEach(() => {
        useCategoryStore.setState({ categories: [], isLoading: false });
    });

    it('should add, update and remove categories', () => {
        useCategoryStore.getState().addCategory({ id: 1, uuid: '1', name: 'Z', color: '#000', position: 2, createdAt: 1, updatedAt: 1 });
        useCategoryStore.getState().addCategory({ id: 2, uuid: '2', name: 'A', color: '#111', position: 1, createdAt: 1, updatedAt: 1 });
        expect(useCategoryStore.getState().categories).toHaveLength(2);
        expect(useCategoryStore.getState().categories.map((item) => item.id)).toEqual([2, 1]);

        useCategoryStore.getState().updateCategory(2, { name: 'B', position: 3 });
        expect(useCategoryStore.getState().categories.find((item) => item.id === 2)?.name).toBe('B');
        expect(useCategoryStore.getState().categories.map((item) => item.id)).toEqual([1, 2]);

        useCategoryStore.getState().removeCategory(1);
        expect(useCategoryStore.getState().categories).toHaveLength(1);
    });
});
