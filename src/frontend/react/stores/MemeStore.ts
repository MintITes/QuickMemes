import { create } from 'zustand';
import type { Meme } from '../types';

export interface MemeState {
    memes: Meme[];
    isLoading: boolean;
    totalCount: number;

    setMemes: (memes: Meme[], totalCount?: number) => void;
    upsertMeme: (meme: Meme) => void;
    updateMeme: (id: number, updates: Partial<Meme>) => void;
    removeMemes: (ids: number[]) => void;
    setLoading: (isLoading: boolean) => void;
    setTotalCount: (count: number) => void;
    reset: () => void;
}

export const useMemeStore = create<MemeState>((set) => ({
    memes: [],
    isLoading: false,
    totalCount: 0,

    setMemes: (memes, totalCount) => set({
        memes,
        totalCount: totalCount ?? memes.length,
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

    removeMemes: (ids) => set((state) => ({
        memes: state.memes.filter((meme) => !ids.includes(meme.id)),
        totalCount: Math.max(0, state.totalCount - ids.length),
    })),

    setLoading: (isLoading) => set({ isLoading }),
    setTotalCount: (count) => set({ totalCount: count }),
    reset: () => set({ memes: [], isLoading: false, totalCount: 0 }),
}));
