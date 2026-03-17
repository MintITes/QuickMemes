import { sendBlobRequest } from '../api/httpClient';

const blobUrlCache = new Map<string, string>();

async function getObjectUrl(key: string, path: string) {
    const cached = blobUrlCache.get(key);
    if (cached) {
        return cached;
    }

    const blob = await sendBlobRequest(path);
    const objectUrl = URL.createObjectURL(blob);
    blobUrlCache.set(key, objectUrl);
    return objectUrl;
}

export async function getThumbnailUrl(memeId: number) {
    try {
        return await getObjectUrl(`thumb:${memeId}`, `/api/meme/${memeId}/thumbnail`);
    } catch {
        return getObjectUrl(`file:${memeId}`, `/api/meme/${memeId}/file`);
    }
}

export async function getFileUrl(memeId: number) {
    return getObjectUrl(`file:${memeId}`, `/api/meme/${memeId}/file`);
}

export function revokeAssetUrl(key: string) {
    const current = blobUrlCache.get(key);
    if (!current) {
        return;
    }
    URL.revokeObjectURL(current);
    blobUrlCache.delete(key);
}
