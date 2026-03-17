import { sendHttpRequest } from '../api/httpClient';
import type { Category } from '../types';

export async function fetchCategories() {
    return sendHttpRequest<Category[]>('GET', '/api/categories');
}
