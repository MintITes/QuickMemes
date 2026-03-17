/* eslint-disable @typescript-eslint/no-unused-vars */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    readClipboardImage: () => Promise.resolve(null),
    writeClipboardImage: (_filePath: string) => Promise.resolve(),
    openFileDialog: (options: unknown) => ipcRenderer.invoke('open-file-dialog', options),
    saveFileDialog: (_options: unknown) => Promise.resolve(null),
    registerGlobalShortcut: (_key: string, _callback: () => void) => { },
    unregisterGlobalShortcut: (_key: string) => { },
    showMemePanel: () => { },
    hideMemePanel: () => { },
    windowControls: (action: 'close' | 'minimize' | 'maximize') => ipcRenderer.send('window-controls', action),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
    openDevTools: () => ipcRenderer.send('open-dev-tools'),
    platform: process.platform,
});
