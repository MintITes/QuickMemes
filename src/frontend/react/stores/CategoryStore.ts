import { create } from 'zustand';
import type { Category } from '../types';

export interface CategoryState {
    categories: Category[];
    isLoading: boolean;

    setCategories: (categories: Category[]) => void;
    addCategory: (category: Category) => void;
    updateCategory: (id: number, updates: Partial<Category>) => void;
    removeCategory: (id: number) => void;
    setLoading: (isLoading: boolean) => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
    categories: [],
    isLoading: false,

    setCategories: (categories) => set({ categories }),
    addCategory: (category) => set((state) => ({
        categories: [...state.categories, category]
    })),
    updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map((category) =>
            category.id === id ? { ...category, ...updates } : category
        )
    })),
    removeCategory: (id) => set((state) => ({
        categories: state.categories.filter((category) => category.id !== id)
    })),
    setLoading: (isLoading) => set({ isLoading }),
}));
