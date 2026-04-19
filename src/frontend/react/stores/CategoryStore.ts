import { create } from 'zustand';
import type { Category } from '../types';

const sortCategories = (categories: Category[]) =>
    [...categories].sort((left, right) => {
        if (left.position !== right.position) {
            return left.position - right.position;
        }
        if (left.createdAt !== right.createdAt) {
            return left.createdAt - right.createdAt;
        }
        return left.id - right.id;
    });

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

    setCategories: (categories) => set({ categories: sortCategories(categories) }),
    addCategory: (category) => set((state) => ({
        categories: sortCategories(
            state.categories.some((entry) => entry.id === category.id)
                ? state.categories.map((entry) => entry.id === category.id ? category : entry)
                : [...state.categories, category]
        )
    })),
    updateCategory: (id, updates) => set((state) => ({
        categories: sortCategories(
            state.categories.map((category) =>
                category.id === id ? { ...category, ...updates } : category
            )
        )
    })),
    removeCategory: (id) => set((state) => ({
        categories: state.categories.filter((category) => category.id !== id)
    })),
    setLoading: (isLoading) => set({ isLoading }),
}));
