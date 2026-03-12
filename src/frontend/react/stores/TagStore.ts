import { create } from 'zustand';
import { Tag } from '../types';

export interface TagState {
    tags: Tag[];
    isLoading: boolean;

    setTags: (tags: Tag[]) => void;
    addTag: (tag: Tag) => void;
    updateTag: (id: number, updates: Partial<Tag>) => void;
    removeTag: (id: number) => void;
    setLoading: (isLoading: boolean) => void;
}

export const useTagStore = create<TagState>((set) => ({
    tags: [],
    isLoading: false,

    setTags: (tags) => set({ tags }),
    addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
    updateTag: (id, updates) => set((state) => ({
        tags: state.tags.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    removeTag: (id) => set((state) => ({
        tags: state.tags.filter(t => t.id !== id)
    })),
    setLoading: (isLoading) => set({ isLoading }),
}));
