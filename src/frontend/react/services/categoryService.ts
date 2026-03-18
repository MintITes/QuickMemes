import { sendHttpRequest } from '../api/httpClient';
import type { Category } from '../types';

export interface CategoryPatchPayload {
    name?: string;
    color?: string;
    position?: number;
}

export async function fetchCategories() {
    return sendHttpRequest<Category[]>('GET', '/api/categories');
}

export async function createCategory(name: string, color?: string, position?: number) {
    return sendHttpRequest<Category>('POST', '/api/categories', { name, color, position });
}

export async function updateCategory(id: number, patch: CategoryPatchPayload) {
    return sendHttpRequest<Category>('PUT', `/api/categories/${id}`, patch);
}

export async function deleteCategory(id: number) {
    return sendHttpRequest<null>('DELETE', `/api/categories/${id}`);
}
