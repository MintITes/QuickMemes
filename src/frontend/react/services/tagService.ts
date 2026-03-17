import { sendHttpRequest } from '../api/httpClient';
import type { Tag } from '../types';

export async function fetchTags() {
    return sendHttpRequest<Tag[]>('GET', '/api/tags');
}

export async function createTag(name: string) {
    return sendHttpRequest<Tag>('POST', '/api/tags', { name });
}

export async function addTagToMeme(memeId: number, tagId: number) {
    return sendHttpRequest<null>('POST', `/api/meme/${memeId}/tags`, { tagId });
}

export async function removeTagFromMeme(memeId: number, tagId: number) {
    return sendHttpRequest<null>('DELETE', `/api/meme/${memeId}/tag/${tagId}`);
}
