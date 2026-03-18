import { describe, expect, it } from 'vitest';
import { buildBackendSearchQuery } from './memeService';

describe('memeService', () => {
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
    });
});
