import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/**
 * Gets the path to the application icon.
 * Takes into account the dist/electron structure.
 */
function getIconPath() {
    // In dev built: src/frontend/dist/electron/main.js
    // Localized public folder: src/frontend/public/tray-icon.png -> copied to dist/public/tray-icon.png or similar

    // Attempt 1: Path relative to build output (dist/electron/main.js -> ../../public/tray-icon.png)
    const buildPath = path.join(__dirname, '../../public/tray-icon.png');
    if (fs.existsSync(buildPath)) return buildPath;

    // Attempt 2: Direct source path for dev (absolute path to public folder)
    const sourcePath = path.join(app.getAppPath(), 'src/frontend/public/tray-icon.png');
    if (fs.existsSync(sourcePath)) return sourcePath;

    // Fallback: common locations
    const fallbackPaths = [
        path.join(app.getAppPath(), 'tray-icon.png'),
        path.join(app.getAppPath(), 'public/tray-icon.png'),
        path.join(__dirname, '../../../../resources/QuickMemes_icon.png'),
    ];

    for (const p of fallbackPaths) {
        if (fs.existsSync(p)) return p;
    }
    return '';
}

function createWindow() {
    const iconPath = getIconPath();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        titleBarStyle: 'hidden',
        icon: iconPath || undefined,
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
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../react/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = getIconPath();
    if (!iconPath) {
        console.warn('Tray icon not found, skipping tray creation');
        return;
    }

    const icon = nativeImage.createFromPath(iconPath);
    // Resize for different OS requirements if necessary
    const trayIcon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示首页',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: '本程序由 MintIT 驱动',
            enabled: false
        },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('QuickMemes');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

app.whenReady().then(() => {
    ipcMain.on('window-controls', (event, action) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        if (action === 'close') {
            // Instead of closing, we might want to hide it to tray on close if user wants.
            // For now, let's just close as requested but keep logic ready.
            win.close();
        }
        if (action === 'minimize') win.minimize();
        if (action === 'maximize') {
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
        }
    });

    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // app.quit(); // We don't quit here anymore if we want tray to keep it alive
    }
});

