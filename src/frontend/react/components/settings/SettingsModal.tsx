import { useEffect, useState } from 'react';
import { X, Shield, Globe, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from '../common/IconButton';
import { Switch } from '../common/Switch';
import { Slider } from '../common/Slider';
import { useUiStore } from '../../stores/UiStore';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { LivePreview } from './LivePreview';
import { getAppConfig, setAppConfig } from '../../services/configService';
import { useNotificationStore } from '../../stores/NotificationStore';

type SettingsTab = 'general' | 'appearance' | 'storage' | 'ocr' | 'ai' | 'shortcuts' | 'about';

export function SettingsModal() {
    const {
        isSettingsOpen, toggleSettings,
        theme, resolvedTheme, setTheme,
        glassEffect, toggleGlassEffect,
        platformOverride, setPlatformOverride,
        glassBlur, setGlassBlur,
        cornerRadius, setCornerRadius,
        galleryGap, setGalleryGap,
        accentColor, setAccentColor,
        language, setLanguage
    } = useUiStore();
    const { t } = useTranslation();
    const addNotification = useNotificationStore((state) => state.addNotification);
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [debugClickCount, setDebugClickCount] = useState(0);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);

    const hasPatchChanges = (base: unknown, patch: unknown): boolean => {
        if (patch === null || patch === undefined) {
            return base !== patch;
        }

        if (Array.isArray(patch)) {
            return JSON.stringify(base) !== JSON.stringify(patch);
        }

        if (typeof patch !== 'object') {
            return base !== patch;
        }

        if (typeof base !== 'object' || base === null) {
            return true;
        }

        return Object.entries(patch as Record<string, unknown>).some(([key, value]) => {
            const currentValue = (base as Record<string, unknown>)[key];
            return hasPatchChanges(currentValue, value);
        });
    };

    useEffect(() => {
        if (!isSettingsOpen) {
            return;
        }
        void getAppConfig().then((nextConfig) => {
            setConfig(nextConfig);
            setSavedConfig(nextConfig);
        }).catch(() => {
            setConfig(null);
            setSavedConfig(null);
        });
    }, [isSettingsOpen]);

    const savePatch = async (patch: Partial<AppConfig>) => {
        if (!savedConfig || !hasPatchChanges(savedConfig, patch)) {
            return;
        }

        try {
            const result = await setAppConfig(patch);
            setConfig(result.config);
            setSavedConfig(result.config);
            addNotification({
                type: 'success',
                title: '设置已保存',
                description: result.restartRequired ? '已应用并重启后端' : '已同步到后端',
            });
        } catch (error) {
            addNotification({
                type: 'error',
                title: '设置保存失败',
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const saveOcrField = async (key: keyof AppConfig['ocr'], value: string) => {
        if (!config) {
            return;
        }
        const nextOcr = { ...config.ocr, [key]: value };
        const nextConfig = { ...config, ocr: nextOcr };
        setConfig(nextConfig);
        await savePatch({ ocr: nextOcr });
    };

    const saveVisionField = async (key: keyof AppConfig['vision'], value: string) => {
        if (!config) {
            return;
        }
        const nextVision = { ...config.vision, [key]: value };
        const nextConfig = { ...config, vision: nextVision };
        setConfig(nextConfig);
        await savePatch({ vision: nextVision });
    };

    const pickDirectory = async (field: 'storagePath' | 'logDir') => {
        const selected = await window.electronAPI.openDirectoryDialog({
            title: field === 'storagePath' ? '选择存储目录' : '选择日志目录',
            defaultPath: config?.[field],
        });
        if (!selected || !config) {
            return;
        }
        const patch = { [field]: selected } as Partial<AppConfig>;
        if (!savedConfig || !hasPatchChanges(savedConfig, patch)) {
            return;
        }
        setConfig({ ...config, ...patch });
        await savePatch(patch);
    };

    const handleLogoClick = () => {
        const newCount = debugClickCount + 1;
        if (newCount >= 5) {
            window.electronAPI?.openDevTools();
            setDebugClickCount(0);
        } else {
            setDebugClickCount(newCount);
            const timer = setTimeout(() => setDebugClickCount(0), 2000);
            return () => clearTimeout(timer);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.general.title')}</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">{t('settings.general.theme.label')}</div>
                                    <div className="text-xs opacity-60">{t('settings.general.theme.desc')}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", theme === 'light' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('light')}
                                    >{t('settings.general.theme.light')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", theme === 'dark' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('dark')}
                                    >{t('settings.general.theme.dark')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border text-nowrap", theme === 'system' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('system')}
                                    >{t('settings.general.theme.system')}</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">{t('settings.general.platform.label')}</div>
                                    <div className="text-xs opacity-60">{t('settings.general.platform.desc')}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", platformOverride === 'auto' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setPlatformOverride('auto')}
                                    >{t('settings.general.platform.auto')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", platformOverride === 'darwin' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setPlatformOverride('darwin')}
                                    >{t('settings.general.platform.macos')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", platformOverride === 'win32' || platformOverride === 'linux' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setPlatformOverride(platformOverride === 'win32' ? 'win32' : 'linux')}
                                    >{t('settings.general.platform.win_linux')}</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">{t('settings.general.language.label')}</div>
                                    <div className="text-xs opacity-60">{t('settings.general.language.desc')}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", language === 'zh-CN' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setLanguage('zh-CN')}
                                    >{t('settings.general.language.zh_CN')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", language === 'en-US' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setLanguage('en-US')}
                                    >{t('settings.general.language.en_US')}</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", language === 'system' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setLanguage('system')}
                                    >{t('settings.general.language.system')}</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">{t('settings.general.auto_start.label')}</div>
                                    <div className="text-xs opacity-60">{t('settings.general.auto_start.desc')}</div>
                                </div>
                                <Switch checked={false} onChange={() => { }} aria-label="Toggle auto start" />
                            </div>
                        </div>
                    </div>
                );
            case 'appearance':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.appearance.title')}</h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        {t('settings.appearance.glass.label')}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">{t('settings.appearance.glass.experimental')}</span>
                                    </div>
                                    <div className="text-xs opacity-60 mt-0.5">{t('settings.appearance.glass.desc')}</div>
                                </div>
                                <Switch checked={glassEffect} onChange={() => toggleGlassEffect()} aria-label="Toggle glass effect" />
                            </div>

                            <Slider
                                label={t('settings.appearance.blur.label')}
                                value={glassBlur}
                                min={0}
                                max={40}
                                onChange={setGlassBlur}
                                disabled={!glassEffect}
                                unit="px"
                                warning={!glassEffect ? t('settings.appearance.blur.warning') : undefined}
                            />

                            <Slider label={t('settings.appearance.radius')} value={cornerRadius} min={0} max={24} onChange={setCornerRadius} unit="px" />
                            <Slider label={t('settings.appearance.gap')} value={galleryGap} min={4} max={32} onChange={setGalleryGap} unit="px" />

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm">{t('settings.appearance.accent')}</div>
                                <div className="flex gap-2">
                                    {['#0066cc', '#0a84ff', '#32d74b', '#ff9f0a', '#ff375f', '#64d2ff'].map(color => (
                                        <button
                                            key={color}
                                            className={clsx("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110", accentColor === color ? "border-white shadow-lg scale-110" : "border-transparent oapcity-60")}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setAccentColor(color)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'storage':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.storage.title')}</h3>
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm mb-1">{t('settings.storage.path.label')}</div>
                                <div className="text-xs opacity-60 mb-3">{t('settings.storage.path.desc')}</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={config?.storagePath ?? ''}
                                        className="flex-1 bg-black/20 dark:bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-textSecondary outline-none select-text"
                                    />
                                    <button
                                        className="px-4 py-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-sm"
                                        onClick={() => void pickDirectory('storagePath')}
                                    >
                                        {t('settings.storage.path.change')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'ocr':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.ocr.title')}</h3>
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm mb-1">OCR API URL</div>
                                <div className="text-xs opacity-60 mb-3">{t('settings.ocr.apiUrl.desc', '填写用于图片文字识别的完整 API 接口地址')}</div>
                                <input
                                    className="w-full bg-black/20 dark:bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm"
                                    value={config?.ocr.apiUrl ?? ''}
                                    onChange={(e) => setConfig((prev) => prev ? { ...prev, ocr: { ...prev.ocr, apiUrl: e.target.value } } : prev)}
                                    onBlur={(e) => void saveOcrField('apiUrl', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'ai':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.ai.title')}</h3>
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm mb-1">AI API Base URL</div>
                                <div className="text-xs opacity-60 mb-3">{t('settings.ai.apiBaseUrl.desc', '兼容 OpenAI 格式的大语言模型服务基础地址')}</div>
                                <input
                                    className="w-full bg-black/20 dark:bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm"
                                    value={config?.vision.apiBaseUrl ?? ''}
                                    onChange={(e) => setConfig((prev) => prev ? { ...prev, vision: { ...prev.vision, apiBaseUrl: e.target.value } } : prev)}
                                    onBlur={(e) => void saveVisionField('apiBaseUrl', e.target.value)}
                                />
                            </div>
                            <div className="p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm mb-1">AI API Key</div>
                                <div className="text-xs opacity-60 mb-3">{t('settings.ai.apiKey.desc', '调用大模型服务所需的 API 密钥，将安全保存')}</div>
                                <input
                                    className="w-full bg-black/20 dark:bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm"
                                    value={config?.vision.apiKey ?? ''}
                                    onChange={(e) => setConfig((prev) => prev ? { ...prev, vision: { ...prev.vision, apiKey: e.target.value } } : prev)}
                                    onBlur={(e) => void saveVisionField('apiKey', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'shortcuts':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">{t('settings.shortcuts.title')}</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">{t('settings.shortcuts.global_call')}</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono opacity-40">{config?.ui.panelShortcut ?? t('settings.shortcuts.not_set')}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">{t('settings.shortcuts.quick_import')}</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono opacity-40">{t('settings.shortcuts.not_set')}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">{t('settings.shortcuts.open_settings')}</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono opacity-40">{t('settings.shortcuts.not_set')}</span>
                            </div>
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="flex flex-col items-center justify-center text-center mt-0">
                        <motion.img
                            src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.svg'}
                            alt="Logo"
                            className="w-50 h-40 mb-0 opacity-80 drop-shadow-lg cursor-pointer active:scale-95 transition-transform"
                            draggable={false}
                            onClick={handleLogoClick}
                        />
                        <h3 className="font-bold text-xl tracking-wider select-none">QuickMemes</h3>
                        <p className="text-sm opacity-60 mb-2">Version 0.0.1-dev</p>

                        <div className="max-w-md space-y-4 my-0">
                            <p className="text-xs leading-relaxed opacity-60">{t('settings.about.desc')}</p>
                            <div className="flex flex-col gap-2 py-4 border-y border-white/5">
                                <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
                                    <Shield size={14} className="text-accent" />
                                    <span>{t('settings.about.license')}</span>
                                </div>
                                <p className="text-[10px] opacity-40">{t('settings.about.license_desc')}</p>
                            </div>
                            <div className="flex items-center justify-center gap-4 pt-0">
                                <a
                                    href="https://github.com/MintITes/QuickMemes"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.electronAPI?.openExternal("https://github.com/MintITes/QuickMemes");
                                    }}
                                    className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 hover:text-accent transition-all"
                                >
                                    <Github size={14} />
                                    <span>{t('settings.about.source_code')}</span>
                                </a>
                                <div className="w-px h-3 bg-white/10"></div>
                                <a
                                    href="https://github.com/MintITes/QuickMemes"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.electronAPI?.openExternal("https://github.com/MintITes/QuickMemes");
                                    }}
                                    className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 hover:text-accent transition-all"
                                >
                                    <Globe size={14} />
                                    <span>{t('settings.about.official_website')}</span>
                                </a>
                            </div>
                        </div>

                        <div className="mt-4 space-y-1">
                            <p className="text-[10px] opacity-30">Copyright © 2026 MintITes & Contributors</p>
                            <p className="text-[10px] opacity-30">QuickMemes Logo/Icon © 2026 by BoheSama is licensed under CC BY-NC-ND 4.0.</p>
                        </div>
                    </div>
                );
        }
    };

    const tabs: { id: SettingsTab; label: string; subLabel: string }[] = [
        { id: 'general', label: t('settings.tabs.general'), subLabel: 'General' },
        { id: 'appearance', label: t('settings.tabs.appearance'), subLabel: 'Style' },
        { id: 'storage', label: t('settings.tabs.storage'), subLabel: 'Storage' },
        { id: 'ocr', label: t('settings.tabs.ocr'), subLabel: 'Text' },
        { id: 'ai', label: t('settings.tabs.ai'), subLabel: 'Vision' },
        { id: 'shortcuts', label: t('settings.tabs.shortcuts'), subLabel: 'Keys' },
        { id: 'about', label: t('settings.tabs.about'), subLabel: 'About' }
    ];

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
                    style={{ borderRadius: 'var(--corner-radius)' }}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md transition-opacity"
                        onClick={() => toggleSettings(false)}
                        aria-hidden="true"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300, opacity: { duration: 0.2 } }}
                        className="relative surface-effect w-[920px] h-[600px] max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10"
                        style={{ WebkitAppRegion: 'no-drag', borderRadius: 'var(--corner-radius)' } as React.CSSProperties}
                    >
                        <div className="flex items-center justify-center p-4 border-b border-white/10 dark:border-black/20 shrink-0">
                            <h2 className="text-base font-bold tracking-wide select-none">{t('settings.title')}</h2>
                            <IconButton
                                icon={<X size={16} />}
                                onClick={() => toggleSettings(false)}
                                className="absolute left-4 bg-black/5 dark:bg-white/10"
                                aria-label="Close settings"
                            />
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            <div className="w-[180px] shrink-0 border-r border-white/5 bg-black/5 dark:bg-black/20 p-3 flex flex-col gap-1.5 overflow-y-auto select-none">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={clsx(
                                            "px-4 py-2 text-left text-sm font-medium transition-colors duration-200 flex items-baseline gap-2",
                                            activeTab === tab.id
                                                ? "bg-accent text-white shadow-md shadow-accent/20"
                                                : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                                        )}
                                        style={{ borderRadius: 'calc(var(--corner-radius) * 0.75)' }}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={clsx("text-[10px] font-bold tracking-tight", activeTab === tab.id ? "text-white/60" : "opacity-30")}>
                                            {tab.subLabel}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 flex min-w-0 overflow-hidden bg-white/40 dark:bg-white/5 shadow-inner select-none relative">
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                    <div className="max-w-2xl mx-auto">
                                        {renderContent()}
                                    </div>
                                </div>

                                {activeTab === 'appearance' && (
                                    <div className="w-[280px] shrink-0 border-l border-white/5 bg-black/5 dark:bg-black/10 p-6 flex flex-col items-center justify-start overflow-y-auto no-drag animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="w-full">
                                            <LivePreview />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
