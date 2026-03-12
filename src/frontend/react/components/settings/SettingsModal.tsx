import { useState } from 'react';
import { X, Layout, Monitor, Trash2, Shield, Info, ExternalLink, Globe, Sparkles, Github } from 'lucide-react';
import { useUiStore } from '../../stores/UiStore';
import clsx from 'clsx';

type SettingsTab = 'general' | 'storage' | 'ocr' | 'ai' | 'shortcuts' | 'about';

export function SettingsModal() {
    const { isSettingsOpen, toggleSettings, theme, resolvedTheme, setTheme, glassEffect, toggleGlassEffect } = useUiStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    if (!isSettingsOpen) return null;

    const tabs: { id: SettingsTab; label: string; subLabel: string }[] = [
        { id: 'general', label: '常规', subLabel: 'General' },
        { id: 'storage', label: '存储', subLabel: 'Storage' },
        { id: 'ocr', label: 'OCR', subLabel: 'Text' },
        { id: 'ai', label: 'AI 视觉', subLabel: 'Vision' },
        { id: 'shortcuts', label: '快捷键', subLabel: 'Keys' },
        { id: 'about', label: '关于', subLabel: 'About' }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">常规设置</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">外观主题</div>
                                    <div className="text-xs opacity-60">夜间模式或白昼模式</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", theme === 'light' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('light')}
                                    >明亮</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border", theme === 'dark' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('dark')}
                                    >暗黑</button>
                                    <button
                                        className={clsx("px-3 py-1 text-sm rounded-lg transition-colors border text-nowrap", theme === 'system' ? "bg-accent text-white border-accent" : "border-white/10 opacity-70 hover:bg-white/10")}
                                        onClick={() => setTheme('system')}
                                    >跟随系统</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        全局磨砂玻璃特效
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">实验性</span>
                                    </div>
                                    <div className="text-xs opacity-60 mt-0.5">关闭以提升性能并解决部分渲染拖影问题</div>
                                </div>
                                <div
                                    className={clsx("w-10 h-5 rounded-full cursor-pointer relative transition-colors shadow-inner", glassEffect ? "bg-accent" : "bg-black/20 dark:bg-white/20")}
                                    onClick={() => toggleGlassEffect()}
                                >
                                    <div className={clsx("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", glassEffect ? "right-0.5" : "left-0.5")}></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">开机自启</div>
                                    <div className="text-xs opacity-60">随系统启动并在后台静默运行</div>
                                </div>
                                <div className="w-10 h-5 bg-black/20 dark:bg-white/20 rounded-full cursor-pointer relative transition-colors">
                                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/50 rounded-full transition-transform"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'storage':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">存储库管理</h3>
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl border border-borderColor bg-white/5">
                                <div className="font-medium text-sm mb-1">主存储路径</div>
                                <div className="text-xs opacity-60 mb-3">当前所有梗图保存的根目录</div>
                                <div className="flex gap-2">
                                    <input type="text" readOnly value="C:\Users\BoheSama\Pictures\QuickMemes" className="flex-1 bg-black/20 dark:bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-textSecondary outline-none select-text" />
                                    <button className="px-4 py-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-sm">更改</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'ocr':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">OCR 文本识别</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-borderColor bg-white/5">
                                <div>
                                    <div className="font-medium text-sm">后台自动 OCR</div>
                                    <div className="text-xs opacity-60">导入图片后自动在后台提取文字索引</div>
                                </div>
                                <div className="w-10 h-5 bg-accent rounded-full cursor-pointer relative shadow-inner">
                                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'ai':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">AI 视觉分析</h3>
                        <div className="flex flex-col items-center justify-center h-40 opacity-50">
                            <p className="text-sm">AI 自动打标模型尚未配置，请在后续版本配置 API Key</p>
                        </div>
                    </div>
                );
            case 'shortcuts':
                return (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2 mb-4">快捷键绑定</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">全局唤出</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono">Alt + Space</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">快速截图导入</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono">Alt + Shift + A</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg">
                                <span className="text-sm">开启设置</span>
                                <span className="px-2 py-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-md text-xs font-mono">Ctrl + ,</span>
                            </div>
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="flex flex-col items-center justify-center text-center mt-0">
                        <img src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.svg'} alt="Logo" className="w-50 h-40 mb-0 opacity-80 drop-shadow-lg" draggable={false} />
                        <h3 className="font-bold text-xl tracking-wider select-none">QuickMemes</h3>
                        <p className="text-sm opacity-60 mb-2">Version 0.0.1-dev</p>

                        <div className="max-w-md space-y-4 my-0">
                            <p className="text-xs leading-relaxed opacity-60">
                                一个跨平台的用于管理和存储Memes的工具，旨在帮助用户高效地组织、查找和分享Memes。
                            </p>

                            <div className="flex flex-col gap-2 py-4 border-y border-white/5">
                                <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
                                    <Shield size={14} className="text-accent" />
                                    <span>基于 GPL-3.0 开源协议发布</span>
                                </div>
                                <p className="text-[10px] opacity-40">你可以自由地使用、修改和分发本程序，但前提是任何衍生作品都必须公开源代码，并继续沿用相同的 GPLv3 协议。</p>
                            </div>

                            <div className="flex items-center justify-center gap-4 pt-2">
                                <a href="https://github.com/MintITes/QuickMemes" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 hover:text-accent transition-all">
                                    <Github size={14} />
                                    <span>源代码</span>
                                </a>
                                <div className="w-px h-3 bg-white/10"></div>
                                <a href="https://github.com/MintITes/QuickMemes" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 hover:text-accent transition-all">
                                    <Globe size={14} />
                                    <span>官方网站</span>
                                </a>
                            </div>
                        </div>

                        <p className="text-[10px] opacity-30 mt-0">Copyright © 2026 MintITes & Contributors</p>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center rounded-xl overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md transition-opacity"
                onClick={() => toggleSettings(false)}
                aria-hidden="true"
            />

            {/* Modal Box */}
            <div
                className="relative surface-effect w-[760px] h-[540px] max-h-[85vh] rounded-2xl flex flex-col overflow-hidden ring-1 ring-white/10"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {/* Header */}
                <div className="flex items-center justify-center p-4 border-b border-white/10 dark:border-black/20 shrink-0">
                    <h2 className="text-base font-bold tracking-wide select-none">设置中心</h2>
                    <button
                        onClick={() => toggleSettings(false)}
                        className="absolute left-4 w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                        aria-label="Close settings"
                    >
                        <X size={16} />
                    </button>
                    {/* A macOS style close button logic might put it top-left, while Windows puts it top-right. Let's put it top-left per convention or standard modal logic */}
                </div>

                {/* Content Body - Split View */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar */}
                    <div className="w-[180px] shrink-0 border-r border-white/5 bg-black/5 dark:bg-black/20 p-3 flex flex-col gap-1.5 overflow-y-auto select-none">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "px-4 py-2 text-left rounded-xl text-sm font-medium transition-all flex items-baseline gap-2",
                                    activeTab === tab.id
                                        ? "bg-accent text-white shadow-md shadow-accent/20"
                                        : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                                )}
                            >
                                <span>{tab.label}</span>
                                <span className={clsx(
                                    "text-[10px] font-bold tracking-tight",
                                    activeTab === tab.id ? "text-white/60" : "opacity-30"
                                )}>
                                    {tab.subLabel}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Right Content */}
                    <div className="flex-1 p-8 overflow-y-auto bg-white/40 dark:bg-white/5 shadow-inner select-none">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}

