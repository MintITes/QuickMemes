import { sendHttpRequest } from '../api/httpClient';
import type { Meme, SearchQuery, SearchResult } from '../types';
import type { SearchQuery as UiSearchQuery } from '../stores/UiStore';

function getTimeRange(dateRange: UiSearchQuery['dateRange']) {
    if (dateRange === 'all') {
        return { timeFrom: 0, timeTo: 0 };
    }

    const now = new Date();
    const start = new Date(now);
    if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (dateRange === 'week') {
        start.setDate(now.getDate() - 7);
    } else if (dateRange === 'month') {
        start.setMonth(now.getMonth() - 1);
    } else if (dateRange === 'year') {
        start.setFullYear(now.getFullYear() - 1);
    }

    return {
        timeFrom: start.getTime(),
        timeTo: now.getTime(),
    };
}

function getFormats(mediaType: UiSearchQuery['mediaType']) {
    if (mediaType === 'all') {
        return [];
    }
    if (mediaType === 'gif') {
        return ['image/gif'];
    }
    if (mediaType === 'image') {
        return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    }
    return ['video/mp4', 'video/webm', 'video/quicktime'];
}

export function buildBackendSearchQuery(
    uiQuery: UiSearchQuery,
    activeNav: string,
    options?: { limit?: number; offset?: number }
): SearchQuery {
    const { timeFrom, timeTo } = getTimeRange(uiQuery.dateRange);
    const categoryId =
        activeNav.startsWith('category-') ? Number(activeNav.replace('category-', '')) :
            uiQuery.categoryId ?? 0;

    return {
        keyword: uiQuery.matchMode === 'regex' ? '' : uiQuery.keyword,
        tagIds: uiQuery.tagIds,
        categoryId: Number.isFinite(categoryId) ? categoryId : 0,
        source: '',
        timeFrom,
        timeTo,
        formats: getFormats(uiQuery.mediaType),
        sizeMin: 0,
        sizeMax: 0,
        regex: uiQuery.matchMode === 'regex' ? uiQuery.keyword : '',
        useVector: uiQuery.matchMode === 'fuzzy' && uiQuery.keyword.trim().length > 0,
        sortBy: activeNav === 'recent' ? 'lastUsedAt' : 'createdAt',
        sortOrder: 'DESC',
        limit: options?.limit ?? 100,
        offset: options?.offset ?? 0,
        includeTags: true,
    };
}

export async function searchMemes(query: SearchQuery) {
    return sendHttpRequest<SearchResult>('POST', '/api/memes/search', query);
}

export async function fetchTrashMemes() {
    return sendHttpRequest<SearchResult>('GET', '/api/memes/trash');
}

export async function getMeme(id: number) {
    return sendHttpRequest<Meme>('GET', `/api/meme/${id}`);
}

export async function updateMeme(id: number, patch: Partial<Pick<Meme, 'name' | 'description' | 'sourceName' | 'sourceUrl' | 'categoryId' | 'tagIds'>>) {
    return sendHttpRequest<Meme>('PUT', `/api/meme/${id}`, patch);
}
