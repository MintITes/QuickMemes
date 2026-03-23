declare global {
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
            timeoutSeconds: number;
            maxRetries: number;
        };
        embedding: {
            provider: string;
            model: string;
            apiUrl: string;
            apiKey: string;
            dimensions: number;
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

    interface BackendConfig {
        bindAddress: string;
        port: number;
        token: string;
        ready: boolean;
    }

    interface BackendStatus extends BackendConfig {
        starting: boolean;
        pid: number | null;
        lastExitCode: number | null;
        lastError: string | null;
    }

    interface SetConfigResult {
        config: AppConfig;
        restartRequired: boolean;
        hotPatched: boolean;
    }

    interface Window {
        electronAPI: {
            getBackendConfig: () => Promise<BackendConfig>;
            getBackendStatus: () => Promise<BackendStatus>;
            onBackendStatusChange: (listener: (status: BackendStatus) => void) => () => void;
            getConfig: () => Promise<AppConfig>;
            setConfig: (patch: Partial<AppConfig>) => Promise<SetConfigResult>;
            readClipboardImage: () => Promise<string | null>;
            writeClipboardImageFromMeme: (memeId: number) => Promise<boolean>;
            getPathForFile: (file: File) => string;
            openFileDialog: (options?: unknown) => Promise<string[]>;
            openDirectoryDialog: (options?: unknown) => Promise<string | null>;
            saveFileDialog: (options?: unknown) => Promise<string | null>;
            windowControls: (action: 'close' | 'minimize' | 'maximize') => void;
            openExternal: (url: string) => void;
            openDevTools: () => void;
            platform: string;
        };
        debug?: DebugAPI;
    }
}

export {};
    interface DebugAPI {
        notify: (type: NotificationType, title: string, description?: string) => string;
        clearNotifications: () => string;
        fps: (enabled?: boolean) => string;
    }
