function buildAssetUrl(path: string) {
    return window.electronAPI.getBackendConfig().then(({ bindAddress, port }) => {
        return new URL(path, `http://${bindAddress}:${port}`).toString();
    });
}

export async function getThumbnailUrl(memeId: number) {
    return buildAssetUrl(`/api/meme/${memeId}/thumbnail`);
}

export async function getFileUrl(memeId: number) {
    return buildAssetUrl(`/api/meme/${memeId}/file`);
}

export function revokeAssetUrl(_key: string) {
    // 直连 URL 不再使用 Blob/Object URL，保留空实现以兼容现有调用点。
}
