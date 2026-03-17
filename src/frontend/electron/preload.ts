import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getBackendConfig: () => ipcRenderer.invoke('backend:get-config'),
    getBackendStatus: () => ipcRenderer.invoke('backend:get-status'),
    onBackendStatusChange: (listener: (status: unknown) => void) => {
        const wrapped = (_event: unknown, payload: unknown) => listener(payload);
        ipcRenderer.on('backend-status-changed', wrapped);
        return () => ipcRenderer.removeListener('backend-status-changed', wrapped);
    },
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (patch: unknown) => ipcRenderer.invoke('config:set', patch),
    readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
    writeClipboardImageFromMeme: (memeId: number) =>
        ipcRenderer.invoke('clipboard:write-image-from-meme', memeId),
    openFileDialog: (options: unknown) => ipcRenderer.invoke('open-file-dialog', options),
    openDirectoryDialog: (options: unknown) => ipcRenderer.invoke('open-directory-dialog', options),
    saveFileDialog: (options: unknown) => ipcRenderer.invoke('save-file-dialog', options),
    windowControls: (action: 'close' | 'minimize' | 'maximize') => ipcRenderer.send('window-controls', action),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
    openDevTools: () => ipcRenderer.send('open-dev-tools'),
    platform: process.platform,
});
