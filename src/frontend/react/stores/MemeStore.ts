import { create } from 'zustand';
import type { Meme } from '../types';

export interface MemeState {
    memes: Meme[];
    isLoading: boolean;
    isLoadingMore: boolean;
    totalCount: number;
    hasMore: boolean;

    setMemes: (memes: Meme[], totalCount?: number) => void;
    appendMemes: (memes: Meme[]) => void;
    upsertMeme: (meme: Meme) => void;
    updateMeme: (id: number, updates: Partial<Meme>) => void;
    removeMemes: (ids: number[]) => void;
    setLoading: (isLoading: boolean) => void;
    setLoadingMore: (isLoadingMore: boolean) => void;
    setTotalCount: (count: number) => void;
    reset: () => void;
}

export const useMemeStore = create<MemeState>((set) => ({
    memes: [],
    isLoading: false,
    isLoadingMore: false,
    totalCount: 0,
    hasMore: false,

    setMemes: (memes, totalCount) => set({
        memes,
        totalCount: totalCount ?? memes.length,
        hasMore: memes.length < (totalCount ?? memes.length),
    }),

    appendMemes: (memes) => set((state) => {
        // 去重，避免 WS 事件与分页数据重叠
        const existingIds = new Set(state.memes.map((m) => m.id));
        const newMemes = memes.filter((m) => !existingIds.has(m.id));
        const next = [...state.memes, ...newMemes];
        return {
            memes: next,
            hasMore: next.length < state.totalCount,
        };
    }),

    upsertMeme: (meme) => set((state) => {
        const index = state.memes.findIndex((entry) => entry.id === meme.id);
        if (index === -1) {
            return {
                memes: [meme, ...state.memes],
                totalCount: state.totalCount + 1,
            };
        }

        const next = [...state.memes];
        next[index] = meme;
        return { memes: next };
    }),

    updateMeme: (id, updates) => set((state) => ({
        memes: state.memes.map((meme) => (meme.id === id ? { ...meme, ...updates } : meme))
    })),

    removeMemes: (ids) => set((state) => {
        const idSet = new Set(ids);
        let removedCount = 0;
        const memes = state.memes.filter((meme) => {
            if (!idSet.has(meme.id)) {
                return true;
            }
            removedCount += 1;
            idSet.delete(meme.id);
            return false;
        });

        if (removedCount === 0) {
            return {};
        }

        return {
            memes,
            totalCount: Math.max(0, state.totalCount - removedCount),
        };
    }),

    setLoading: (isLoading) => set({ isLoading }),
    setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
    setTotalCount: (count) => set({ totalCount: count }),
    reset: () => set({ memes: [], isLoading: false, isLoadingMore: false, totalCount: 0, hasMore: false }),
}));
