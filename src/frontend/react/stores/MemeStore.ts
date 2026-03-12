import { create } from 'zustand';
import { Meme } from '../types';

export interface MemeState {
    memes: Meme[];
    isLoading: boolean;
    totalCount: number;

    setMemes: (memes: Meme[]) => void;
    addMemes: (memes: Meme[]) => void;
    updateMeme: (id: number, updates: Partial<Meme>) => void;
    removeMemes: (ids: number[]) => void;
    setLoading: (isLoading: boolean) => void;
    setTotalCount: (count: number) => void;
}

export const useMemeStore = create<MemeState>((set) => ({
    memes: [],
    isLoading: false,
    totalCount: 0,

    setMemes: (memes) => set({ memes }),
    addMemes: (newMemes) => set((state) => ({ memes: [...state.memes, ...newMemes] })),
    updateMeme: (id, updates) => set((state) => ({
        memes: state.memes.map(meme => meme.id === id ? { ...meme, ...updates } : meme)
    })),
    removeMemes: (ids) => set((state) => ({
        memes: state.memes.filter(meme => !ids.includes(meme.id))
    })),
    setLoading: (isLoading) => set({ isLoading }),
    setTotalCount: (count) => set({ totalCount: count }),
}));
