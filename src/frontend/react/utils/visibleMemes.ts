import type { SearchQuery as UiSearchQuery } from '../stores/UiStore';

const DEFAULT_SEARCH_QUERY: UiSearchQuery = {
    keyword: '',
    categoryId: undefined,
    tagIds: [],
    matchMode: 'fuzzy',
    mediaType: 'all',
    dateRange: 'all',
};

export function isDefaultSearchQuery(query: UiSearchQuery) {
    return query.keyword.trim() === DEFAULT_SEARCH_QUERY.keyword
        && (query.categoryId === DEFAULT_SEARCH_QUERY.categoryId || query.categoryId === 0)
        && query.tagIds.length === DEFAULT_SEARCH_QUERY.tagIds.length
        && query.matchMode === DEFAULT_SEARCH_QUERY.matchMode
        && query.mediaType === DEFAULT_SEARCH_QUERY.mediaType
        && query.dateRange === DEFAULT_SEARCH_QUERY.dateRange;
}

export function shouldRefreshVisibleMemes(activeNav: string, query: UiSearchQuery) {
    if (activeNav === 'trash') {
        return false;
    }

    if (activeNav === 'untagged' || activeNav.startsWith('category-')) {
        return true;
    }

    return !isDefaultSearchQuery(query);
}
