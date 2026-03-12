import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '../CategoryStore';

describe('CategoryStore', () => {
    beforeEach(() => {
        useCategoryStore.setState({ categories: [], isLoading: false });
    });

    it('should add, update, and sort categories correctly', () => {
        useCategoryStore.getState().addCategory({ id: 1, name: 'Z', order: 2 });
        useCategoryStore.getState().addCategory({ id: 2, name: 'A', order: 1 });

        expect(useCategoryStore.getState().categories[0].id).toBe(2); // order 1 comes first

        useCategoryStore.getState().updateCategory(2, { order: 3 });
        // After updating order of id:2 to 3, id:1 (order 2) should be first
        expect(useCategoryStore.getState().categories[0].id).toBe(1);
    });
});
