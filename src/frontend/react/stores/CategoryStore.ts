import { create } from 'zustand';
import { Category } from '../types';

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

    setCategories: (categories) => set({ categories: categories.sort((a, b) => a.order - b.order) }),
    addCategory: (category) => set((state) => ({
        categories: [...state.categories, category].sort((a, b) => a.order - b.order)
    })),
    updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c).sort((a, b) => a.order - b.order)
    })),
    removeCategory: (id) => set((state) => ({
        categories: state.categories.filter(c => c.id !== id)
    })),
    setLoading: (isLoading) => set({ isLoading }),
}));
