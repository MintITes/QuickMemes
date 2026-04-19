export async function getAppConfig() {
    return window.electronAPI.getConfig();
}

export async function setAppConfig(patch: Partial<AppConfig>) {
    return window.electronAPI.setConfig(patch);
}
