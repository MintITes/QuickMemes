import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        titleBarStyle: 'hidden',
        ...(process.platform === 'darwin' ? {
            vibrancy: 'under-window',
            visualEffectState: 'active',
            titleBarStyle: 'hiddenInset'
        } : {}),
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        win.loadFile(path.join(__dirname, '../react/index.html'));
    }
}

app.whenReady().then(() => {
    ipcMain.on('window-controls', (event, action) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        if (action === 'close') win.close();
        if (action === 'minimize') win.minimize();
        if (action === 'maximize') {
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
