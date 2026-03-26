import type { SearchHistoryItem, BrowsingHistoryItem } from '../stores/UiStore';
import type { Meme, Tag, Category } from '../types';

export interface Suggestion {
    id: string | number;
    text: string;
    type: 'history' | 'tag' | 'category' | 'browsing';
    score: number;
}

export class SuggestionService {
    private static WEIGHTS = {
        HISTORY: 1.0,
        BROWSING: 0.6,
        POPULAR: 0.4
    };

    static getSuggestions(
        keyword: string = '',
        searchHistory: SearchHistoryItem[],
        browsingHistory: BrowsingHistoryItem[],
        memes: Meme[],
        tags: Tag[],
        categories: Category[]
    ): Suggestion[] {

        const candidates: Suggestion[] = [];
        const normalizedKeyword = keyword.toLowerCase().trim();

        // 1. Process Search History
        if (Array.isArray(searchHistory)) {
            searchHistory.forEach(item => {
                // Safety check for item structure (important for persisted legacy data)
                if (item && typeof item === 'object' && typeof item.term === 'string') {
                    if (!normalizedKeyword || item.term.toLowerCase().includes(normalizedKeyword)) {
                        candidates.push({
                            id: `hist-${item.term}`,
                            text: item.term,
                            type: 'history',
                            // Score = frequency * weight
                            score: (item.count || 1) * this.WEIGHTS.HISTORY
                        });
                    }
                }
            });
        }

        // 2. Process Browsing History (Weighted tags/categories from recently viewed)
        const browsingTags = new Map<number, number>();
        const browsingCats = new Map<number, number>();

        if (Array.isArray(browsingHistory)) {
            browsingHistory.slice(0, 10).forEach((item, index) => {
                if (!item || typeof item !== 'object') return;
                const recencyFactor = (10 - index) / 10;
                if (typeof item.categoryId === 'number') {
                    browsingCats.set(item.categoryId, (browsingCats.get(item.categoryId) || 0) + recencyFactor);
                }
                if (Array.isArray(item.tagIds)) {
                    item.tagIds.forEach(tagId => {
                        if (typeof tagId === 'number') {
                            browsingTags.set(tagId, (browsingTags.get(tagId) || 0) + recencyFactor);
                        }
                    });
                }
            });
        }

        // Add browsing-based tags
        browsingTags.forEach((score, tagId) => {
            const tag = tags.find(t => t.id === tagId);
            if (tag && (!normalizedKeyword || tag.name.toLowerCase().includes(normalizedKeyword))) {
                candidates.push({
                    id: `brows-tag-${tag.id}`,
                    text: tag.name,
                    type: 'browsing',
                    score: score * this.WEIGHTS.BROWSING
                });
            }
        });

        // Add browsing-based categories
        browsingCats.forEach((score, catId) => {
            const cat = categories.find(c => c.id === catId);
            if (cat && (!normalizedKeyword || cat.name.toLowerCase().includes(normalizedKeyword))) {
                candidates.push({
                    id: `brows-cat-${cat.id}`,
                    text: cat.name,
                    type: 'browsing',
                    score: score * this.WEIGHTS.BROWSING
                });
            }
        });

        // 3. Process Popular Metadata (Tags/Categories with most items)
        const tagCounts = new Map<number, number>();
        const catCounts = new Map<number, number>();

        memes.forEach(meme => {
            if (meme.categoryId) {
                catCounts.set(meme.categoryId, (catCounts.get(meme.categoryId) || 0) + 1);
            }
            meme.tagIds.forEach(tagId => {
                tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
            });
        });

        tags.forEach(tag => {
            if (!normalizedKeyword || tag.name.toLowerCase().includes(normalizedKeyword)) {
                const count = tagCounts.get(tag.id) || 0;
                if (count > 0) {
                    candidates.push({
                        id: `tag-${tag.id}`,
                        text: tag.name,
                        type: 'tag',
                        score: count * this.WEIGHTS.POPULAR
                    });
                }
            }
        });

        categories.forEach(cat => {
            if (!normalizedKeyword || cat.name.toLowerCase().includes(normalizedKeyword)) {
                const count = catCounts.get(cat.id) || 0;
                if (count > 0) {
                    candidates.push({
                        id: `cat-${cat.id}`,
                        text: cat.name,
                        type: 'category',
                        score: count * this.WEIGHTS.POPULAR
                    });
                }
            }
        });

        // 4. Merge duplicate terms and pick highest score
        const uniqueSuggestions = new Map<string, Suggestion>();
        candidates.forEach(cand => {
            // Unique by text but keep the "best" type
            const existing = uniqueSuggestions.get(cand.text);
            if (!existing || cand.score > existing.score) {
                uniqueSuggestions.set(cand.text, cand);
            }
        });

        // 5. Sort by score and return top results
        return Array.from(uniqueSuggestions.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }
}
