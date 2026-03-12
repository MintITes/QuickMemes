import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    readClipboardImage: () => Promise.resolve(null),
    writeClipboardImage: (filePath: string) => Promise.resolve(),
    openFileDialog: (options: any) => Promise.resolve([]),
    saveFileDialog: (options: any) => Promise.resolve(null),
    registerGlobalShortcut: (key: string, callback: () => void) => { },
    unregisterGlobalShortcut: (key: string) => { },
    showMemePanel: () => { },
    hideMemePanel: () => { },
    windowControls: (action: 'close' | 'minimize' | 'maximize') => ipcRenderer.send('window-controls', action),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
    platform: process.platform,
});
