import { sendHttpRequest } from '../api/httpClient';
import type { Tag } from '../types';

export async function fetchTags() {
    return sendHttpRequest<Tag[]>('GET', '/api/tags');
}
