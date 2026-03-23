import { describe, expect, it } from 'vitest';
import { isDefaultSearchQuery, shouldRefreshVisibleMemes } from '../visibleMemes';

describe('visibleMemes helpers', () => {
    it('recognizes the default search query', () => {
        expect(isDefaultSearchQuery({
            keyword: '',
            categoryId: undefined,
            tagIds: [],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all',
        })).toBe(true);
    });

    it('detects when a visible list can become stale', () => {
        expect(shouldRefreshVisibleMemes('all', {
            keyword: 'meme',
            categoryId: undefined,
            tagIds: [],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all',
        })).toBe(true);

        expect(shouldRefreshVisibleMemes('category-1', {
            keyword: '',
            categoryId: undefined,
            tagIds: [],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all',
        })).toBe(true);

        expect(shouldRefreshVisibleMemes('all', {
            keyword: '',
            categoryId: undefined,
            tagIds: [],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all',
        })).toBe(false);
    });
});
