import {
    app,
    BrowserWindow,
    clipboard,
    dialog,
    ipcMain,
    Menu,
    nativeImage,
    shell,
    Tray,
} from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ThemeMode = 'light' | 'dark' | 'system';
type ViewMode = 'grid' | 'list';
type LanguageMode = 'zh-CN' | 'en-US' | 'system';

interface AppConfig {
    backendPort: number;
    bindAddress: string;
    storagePath: string;
    dbPath: string;
    logDir: string;
    maxQueueSize: number;
    vision: {
        apiKey: string;
        apiBaseUrl: string;
        visionModel: string;
        embeddingModel: string;
        timeoutSeconds: number;
        maxRetries: number;
    };
    ocr: {
        apiKey: string;
        apiUrl: string;
        provider: string;
    };
    ui: {
        panelShortcut: string;
        theme: ThemeMode;
        viewMode: ViewMode;
        language: LanguageMode;
    };
    log: {
        minLevel: string;
        retentionEnabled: boolean;
        retentionDays: number;
    };
    thumbnail: {
        enabled: boolean;
        maxSize: number;
    };
    backup: {
        enabled: boolean;
        retentionDays: number;
    };
    recycleBinRetentionDays: number;
    workerCount: number;
}

interface BackendStatus {
    ready: boolean;
    starting: boolean;
    port: number;
    token: string;
    pid: number | null;
    lastExitCode: number | null;
    lastError: string | null;
}

interface SetConfigResult {
    config: AppConfig;
    restartRequired: boolean;
    hotPatched: boolean;
}

interface BackendSession {
    process: ChildProcessWithoutNullStreams | null;
    token: string;
    ready: boolean;
    starting: boolean;
    lastExitCode: number | null;
    lastError: string | null;
}

const DEFAULT_PORT = 57321;
const HEALTH_ENDPOINT = '/api/health';
const HEALTH_TIMEOUT_MS = 12_000;
const HEALTH_INTERVAL_MS = 250;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentConfig: AppConfig | null = null;
let backendSession: BackendSession = {
    process: null,
    token: '',
    ready: false,
    starting: false,
    lastExitCode: null,
    lastError: null,
};

const RESTART_REQUIRED_KEYS = new Set([
    'backendPort',
    'bindAddress',
    'storagePath',
    'dbPath',
    'logDir',
    'maxQueueSize',
    'thumbnail.enabled',
    'thumbnail.maxSize',
    'backup.enabled',
    'backup.retentionDays',
    'log.retentionEnabled',
    'log.retentionDays',
    'workerCount',
    'recycleBinRetentionDays',
]);

const HOT_PATCH_KEYS = new Set([
    'vision.apiKey',
    'vision.apiBaseUrl',
    'vision.visionModel',
    'vision.embeddingModel',
    'vision.timeoutSeconds',
    'vision.maxRetries',
    'ocr.apiKey',
    'ocr.apiUrl',
    'ocr.provider',
    'log.minLevel',
]);

function getAppBaseDir(): string {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
}

function getConfigPath(): string {
    return path.join(getAppBaseDir(), 'config.json');
}

function ensureDir(dirPath: string) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function getDefaultConfig(): AppConfig {
    const baseDir = getAppBaseDir();
    return {
        backendPort: DEFAULT_PORT,
        bindAddress: '127.0.0.1',
        storagePath: path.join(baseDir, 'storage'),
        dbPath: path.join(baseDir, 'data', 'quickmemes.db'),
        logDir: path.join(baseDir, 'logs'),
        maxQueueSize: 500,
        vision: {
            apiKey: '',
            apiBaseUrl: 'https://api.openai.com/v1',
            visionModel: 'gpt-4o',
            embeddingModel: 'text-embedding-3-small',
            timeoutSeconds: 30,
            maxRetries: 2,
        },
        ocr: {
            apiKey: '',
            apiUrl: '',
            provider: '',
        },
        ui: {
            panelShortcut: 'Alt+M',
            theme: 'system',
            viewMode: 'grid',
            language: 'zh-CN',
        },
        log: {
            minLevel: 'INFO',
            retentionEnabled: true,
            retentionDays: 30,
        },
        thumbnail: {
            enabled: true,
            maxSize: 300,
        },
        backup: {
            enabled: true,
            retentionDays: 30,
        },
        recycleBinRetentionDays: 30,
        workerCount: 4,
    };
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
    if (Array.isArray(base) || Array.isArray(patch)) {
        return (patch ?? base) as T;
    }
    if (typeof base !== 'object' || base === null || typeof patch !== 'object' || patch === null) {
        return (patch ?? base) as T;
    }

    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
        const prev = result[key];
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            prev &&
            typeof prev === 'object' &&
            !Array.isArray(prev)
        ) {
            result[key] = deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}

function normalizeConfig(input?: Partial<AppConfig>): AppConfig {
    const defaults = getDefaultConfig();
    const merged = deepMerge(defaults, input ?? {});

    ensureDir(path.dirname(merged.dbPath));
    ensureDir(merged.storagePath);
    ensureDir(merged.logDir);

    return merged;
}

function loadConfig(): AppConfig {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        const next = normalizeConfig();
        saveConfig(next);
        currentConfig = next;
        return next;
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = raw.trim() ? (JSON.parse(raw) as Partial<AppConfig>) : {};
    const next = normalizeConfig(parsed);
    saveConfig(next);
    currentConfig = next;
    return next;
}

function saveConfig(config: AppConfig) {
    const configPath = getConfigPath();
    ensureDir(path.dirname(configPath));
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    currentConfig = config;
}

function flattenKeys(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return prefix ? [prefix] : [];
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
        return prefix ? [prefix] : [];
    }
    return entries.flatMap(([key, nested]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            return flattenKeys(nested, nextPrefix);
        }
        return [nextPrefix];
    });
}

function getChangedKeys(prev: AppConfig, next: AppConfig, patch: Partial<AppConfig>): string[] {
    return flattenKeys(patch).filter((key) => {
        const prevValue = key.split('.').reduce<unknown>((acc, part) => {
            if (!acc || typeof acc !== 'object') {
                return undefined;
            }
            return (acc as Record<string, unknown>)[part];
        }, prev as unknown);
        const nextValue = key.split('.').reduce<unknown>((acc, part) => {
            if (!acc || typeof acc !== 'object') {
                return undefined;
            }
            return (acc as Record<string, unknown>)[part];
        }, next as unknown);
        return JSON.stringify(prevValue) !== JSON.stringify(nextValue);
    });
}

function getBackendStatus(): BackendStatus {
    const config = currentConfig ?? loadConfig();
    return {
        ready: backendSession.ready,
        starting: backendSession.starting,
        port: config.backendPort,
        token: backendSession.token,
        pid: backendSession.process?.pid ?? null,
        lastExitCode: backendSession.lastExitCode,
        lastError: backendSession.lastError,
    };
}

function emitBackendStatus() {
    const payload = getBackendStatus();
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('backend-status-changed', payload);
    }
}

function getBackendBinaryPath(): string {
    const candidates = [
        path.resolve(app.getAppPath(), '../backend/build/quickmemes-backend'),
        path.resolve(app.getAppPath(), '../../src/backend/build/quickmemes-backend'),
        path.resolve(process.cwd(), '../backend/build/quickmemes-backend'),
        path.resolve(process.cwd(), 'src/backend/build/quickmemes-backend'),
        path.resolve(process.cwd(), 'backend/build/quickmemes-backend'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`找不到后端可执行文件，已尝试路径: ${candidates.join(', ')}`);
}

function buildBackendArgs(config: AppConfig, token: string): string[] {
    return [
        '--bind-address', config.bindAddress,
        '--port', String(config.backendPort),
        '--auth-token', token,
        '--storage-path', config.storagePath,
        '--db-path', config.dbPath,
        '--log-dir', config.logDir,
        '--log-level', config.log.minLevel,
        '--log-retention-enabled', String(config.log.retentionEnabled),
        '--log-retention-days', String(config.log.retentionDays),
        '--api-key', config.vision.apiKey,
        '--api-base-url', config.vision.apiBaseUrl,
        '--vision-model', config.vision.visionModel,
        '--embedding-model', config.vision.embeddingModel,
        '--api-timeout', String(config.vision.timeoutSeconds),
        '--api-retries', String(config.vision.maxRetries),
        '--ocr-api-key', config.ocr.apiKey,
        '--ocr-api-url', config.ocr.apiUrl,
        '--ocr-provider', config.ocr.provider,
        '--thumbnail-enabled', String(config.thumbnail.enabled),
        '--thumbnail-max-size', String(config.thumbnail.maxSize),
        '--backup-enabled', String(config.backup.enabled),
        '--backup-retention-days', String(config.backup.retentionDays),
        '--max-queue-size', String(config.maxQueueSize),
        '--worker-count', String(config.workerCount),
        '--recycle-bin-retention-days', String(config.recycleBinRetentionDays),
    ];
}

async function waitForBackendReady(config: AppConfig, token: string) {
    const startedAt = Date.now();
    const url = `http://${config.bindAddress}:${config.backendPort}${HEALTH_ENDPOINT}`;

    while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
        if (!backendSession.process) {
            throw new Error('后端进程未在运行');
        }

        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                backendSession.ready = true;
                backendSession.starting = false;
                backendSession.lastError = null;
                emitBackendStatus();
                return;
            }
        } catch {
            // Ignore polling errors until timeout.
        }

        await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS));
    }

    throw new Error('后端健康检查超时');
}

async function stopBackend() {
    const proc = backendSession.process;
    if (!proc) {
        backendSession.ready = false;
        backendSession.starting = false;
        emitBackendStatus();
        return;
    }

    await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        };

        proc.once('exit', () => finish());
        proc.kill('SIGTERM');
        setTimeout(() => {
            if (!settled) {
                proc.kill('SIGKILL');
                finish();
            }
        }, 2_000);
    });
}

async function startBackend() {
    const config = currentConfig ?? loadConfig();
    await stopBackend();

    const binaryPath = getBackendBinaryPath();
    const token = randomUUID();
    const args = buildBackendArgs(config, token);
    const proc = spawn(binaryPath, args, {
        cwd: path.dirname(binaryPath),
        stdio: 'pipe',
    });

    backendSession = {
        process: proc,
        token,
        ready: false,
        starting: true,
        lastExitCode: null,
        lastError: null,
    };
    emitBackendStatus();

    proc.stdout.on('data', (chunk) => {
        process.stdout.write(`[backend] ${chunk}`);
    });
    proc.stderr.on('data', (chunk) => {
        process.stderr.write(`[backend] ${chunk}`);
    });
    proc.once('exit', (code) => {
        backendSession.process = null;
        backendSession.ready = false;
        backendSession.starting = false;
        backendSession.lastExitCode = code ?? null;
        if (code && code !== 0) {
            backendSession.lastError = `后端退出，退出码 ${code}`;
        }
        emitBackendStatus();
    });
    proc.once('error', (error) => {
        backendSession.lastError = error.message;
        emitBackendStatus();
    });

    try {
        await waitForBackendReady(config, token);
    } catch (error) {
        backendSession.lastError = error instanceof Error ? error.message : String(error);
        backendSession.starting = false;
        backendSession.ready = false;
        emitBackendStatus();
        await stopBackend();
        throw error;
    }
}

async function restartBackend() {
    await startBackend();
}

async function patchBackendConfig(config: AppConfig, changedKeys: string[]) {
    const hasHotPatch = changedKeys.some((key) => HOT_PATCH_KEYS.has(key));
    if (!hasHotPatch || !backendSession.ready) {
        return false;
    }

    const payload: Record<string, unknown> = {};

    if (changedKeys.includes('vision.apiKey')) payload.aiApiKey = config.vision.apiKey;
    if (changedKeys.includes('vision.apiBaseUrl')) payload.aiApiBaseUrl = config.vision.apiBaseUrl;
    if (changedKeys.includes('vision.visionModel')) payload.aiVisionModel = config.vision.visionModel;
    if (changedKeys.includes('vision.embeddingModel')) payload.aiEmbeddingModel = config.vision.embeddingModel;
    if (changedKeys.includes('vision.timeoutSeconds')) payload.aiTimeoutSeconds = config.vision.timeoutSeconds;
    if (changedKeys.includes('vision.maxRetries')) payload.aiMaxRetries = config.vision.maxRetries;
    if (changedKeys.includes('ocr.apiKey')) payload.ocrApiKey = config.ocr.apiKey;
    if (changedKeys.includes('ocr.apiUrl')) payload.ocrApiUrl = config.ocr.apiUrl;
    if (changedKeys.includes('ocr.provider')) payload.ocrProvider = config.ocr.provider;
    if (changedKeys.includes('log.minLevel')) payload.logMinLevel = config.log.minLevel;

    if (Object.keys(payload).length === 0) {
        return false;
    }

    const response = await fetch(`http://${config.bindAddress}:${config.backendPort}/api/config`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${backendSession.token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`配置热更新失败: ${response.status}`);
    }

    return true;
}

async function applyConfigPatch(patch: Partial<AppConfig>): Promise<SetConfigResult> {
    const prev = currentConfig ?? loadConfig();
    const next = normalizeConfig(deepMerge(prev, patch));
    const changedKeys = getChangedKeys(prev, next, patch);
    const restartRequired = changedKeys.some((key) => RESTART_REQUIRED_KEYS.has(key));

    saveConfig(next);

    let hotPatched = false;
    if (!restartRequired) {
        hotPatched = await patchBackendConfig(next, changedKeys);
    } else {
        await restartBackend();
    }

    return {
        config: next,
        restartRequired,
        hotPatched,
    };
}

function getIconPath() {
    const buildPath = path.join(__dirname, '../../public/tray-icon.png');
    if (fs.existsSync(buildPath)) return buildPath;

    const sourcePath = path.join(app.getAppPath(), 'src/frontend/public/tray-icon.png');
    if (fs.existsSync(sourcePath)) return sourcePath;

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
        ...(process.platform === 'darwin'
            ? {
                vibrancy: 'under-window',
                visualEffectState: 'active',
                titleBarStyle: 'hiddenInset' as const,
            }
            : {}),
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

function showWindow() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
        return;
    }
    createWindow();
}

function createTray() {
    const iconPath = getIconPath();
    if (!iconPath) {
        console.warn('Tray icon not found, skipping tray creation');
        return;
    }

    const icon = nativeImage.createFromPath(iconPath);
    const trayIcon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示首页',
            click: () => showWindow(),
        },
        {
            label: '退出',
            click: () => app.quit(),
        },
    ]);

    tray.setToolTip('QuickMemes');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => showWindow());
    tray.on('double-click', () => showWindow());
}

async function writeClipboardImageFromMeme(memeId: number) {
    const config = currentConfig ?? loadConfig();
    const url = `http://${config.bindAddress}:${config.backendPort}/api/meme/${memeId}/file`;
    console.log(`[Electron] Starting clipboard copy for meme ${memeId} from ${url}`);

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${backendSession.token}`,
        },
    });

    if (!response.ok) {
        const errorMsg = `读取图片失败: ${response.status}`;
        console.error(`[Electron] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Electron] Received image data. Type: ${contentType}, Size: ${buffer.length} bytes`);

    if (buffer.length === 0) {
        throw new Error('接收到的图片数据为空');
    }

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) {
        const errorDetail = `无法解析图片内容 (MIME: ${contentType}, Size: ${buffer.length})`;
        console.error(`[Electron] ${errorDetail}`);
        throw new Error(errorDetail);
    }

    clipboard.writeImage(image);
    console.log(`[Electron] Image successfully written to clipboard`);

    // Track usage (fire and forget)
    fetch(`http://${config.bindAddress}:${config.backendPort}/api/meme/${memeId}/use`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${backendSession.token}`,
        },
    }).catch(err => console.warn(`[Electron] Usage tracking failed: ${err.message}`));
}

function registerIpcHandlers() {
    ipcMain.on('window-controls', (event, action: 'close' | 'minimize' | 'maximize') => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        if (action === 'close') win.close();
        if (action === 'minimize') win.minimize();
        if (action === 'maximize') {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    ipcMain.on('open-external', (_event, url: string) => {
        shell.openExternal(url);
    });

    ipcMain.on('open-dev-tools', (event) => {
        BrowserWindow.fromWebContents(event.sender)?.webContents.openDevTools();
    });

    ipcMain.handle('backend:get-config', async () => {
        const config = currentConfig ?? loadConfig();
        return {
            bindAddress: config.bindAddress,
            port: config.backendPort,
            token: backendSession.token,
            ready: backendSession.ready,
        };
    });

    ipcMain.handle('backend:get-status', async () => getBackendStatus());
    ipcMain.handle('config:get', async () => currentConfig ?? loadConfig());
    ipcMain.handle('config:set', async (_event, patch: Partial<AppConfig>) => applyConfigPatch(patch));

    ipcMain.handle('open-file-dialog', async (event, options?: OpenDialogOptions) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return [];
        const result = await dialog.showOpenDialog(win, {
            title: options?.title ?? '选择 Meme 文件',
            buttonLabel: options?.buttonLabel ?? '导入',
            filters: options?.filters ?? [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: options?.properties ?? ['openFile', 'multiSelections'],
            defaultPath: options?.defaultPath,
        });
        return result.filePaths;
    });

    ipcMain.handle('open-directory-dialog', async (event, options?: OpenDialogOptions) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;
        const result = await dialog.showOpenDialog(win, {
            title: options?.title ?? '选择目录',
            buttonLabel: options?.buttonLabel ?? '选择',
            properties: ['openDirectory', 'createDirectory'],
            defaultPath: options?.defaultPath,
        });
        return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle('save-file-dialog', async (event, options?: SaveDialogOptions) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;
        const result = await dialog.showSaveDialog(win, options ?? {});
        return result.canceled ? null : result.filePath ?? null;
    });

    ipcMain.handle('clipboard:read-image', async () => {
        const image = clipboard.readImage();
        return image.isEmpty() ? null : image.toDataURL();
    });
    ipcMain.handle('clipboard:write-image-from-meme', async (_event, memeId: number) => {
        await writeClipboardImageFromMeme(memeId);
        return true;
    });
}

app.whenReady().then(async () => {
    loadConfig();
    registerIpcHandlers();
    createWindow();
    createTray();

    try {
        await startBackend();
    } catch (error) {
        console.error('Failed to start backend:', error);
    }

    app.on('activate', () => {
        showWindow();
    });
});

app.on('before-quit', () => {
    backendSession.ready = false;
    backendSession.starting = false;
});

app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
        return;
    }
});

app.on('will-quit', async () => {
    await stopBackend();
});
