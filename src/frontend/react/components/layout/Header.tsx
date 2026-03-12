import { useUiStore } from '../../stores/UiStore';
import { Search, Plus, LayoutGrid, Sun, Moon, Settings, User, X, Minus, Square } from 'lucide-react';
import clsx from 'clsx';

export function Header() {
    // @ts-ignore
    const platform = window.electronAPI?.platform || 'linux';
    const { theme, resolvedTheme, setTheme, toggleSettings } = useUiStore();

    const handleThemeToggle = () => {
        // Toggle logic: if system, switch to the opposite of current resolved.
        // If fixed, toggle between light/dark.
        const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    };

    return (
        <header
            className="h-14 flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center px-4 border-b border-white/10 dark:border-black/10 z-50 glass-effect no-drag"
            data-testid="header"
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            {/* macOS Window Controls handled natively by hiddenInset titlebar - we just leave space */}
            <div className={clsx("flex items-center gap-2 justify-self-start", platform === 'darwin' && 'ml-16')}>
                <img
                    src={resolvedTheme === 'dark' ? '/icon-dark.svg' : '/icon.svg'}
                    alt="QuickMemes Logo"
                    className="h-8 w-auto drop-shadow-sm"
                    draggable={false}
                />
                <span className="font-bold opacity-80 text-[15px] tracking-wide cursor-default ml-1 select-none">QuickMemes</span>
            </div>

            {/* Global Search Bar (Centered safely by Grid) */}
            <div className="justify-self-center w-[240px] focus-within:w-[400px] h-9 rounded-xl bg-black/5 dark:bg-black/20 flex items-center px-3 shadow-inner overflow-hidden border border-black/10 dark:border-white/10 no-drag transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:bg-white dark:focus-within:bg-black/40 focus-within:ring-2 focus-within:ring-accent/50 focus-within:shadow-md outline-none relative group">
                <Search size={16} className="text-textSecondary mr-2 no-drag transition-colors group-focus-within:text-accent" />
                <input
                    type="text"
                    placeholder="搜索 Meme..."
                    className="bg-transparent border-none outline-none flex-1 text-sm text-textPrimary placeholder:text-textSecondary h-full no-drag"
                />
                <button
                    className="absolute right-1 top-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center transform hover:scale-105 active:scale-95 transition-transform shadow-md no-drag opacity-0 group-focus-within:opacity-100 scale-90 group-focus-within:scale-100"
                    data-testid="btn-add"
                    title="添加新梗图"
                >
                    <Plus size={16} className="no-drag" />
                </button>
            </div>

            {/* Tools Area */}
            <div className="flex items-center gap-1 justify-self-end no-drag">
                <button aria-label="Layout" className="w-9 h-9 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center no-drag">
                    <LayoutGrid size={18} />
                </button>
                <button
                    aria-label="Theme"
                    className="w-9 h-9 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center no-drag relative"
                    onClick={handleThemeToggle}
                    title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button
                    aria-label="Settings"
                    className="w-9 h-9 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center no-drag"
                    onClick={() => toggleSettings(true)}
                >
                    <Settings size={18} />
                </button>
                <div className="w-0.5 h-4 bg-black/10 dark:bg-white/10 mx-2 no-drag"></div>
                <button aria-label="User" className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center no-drag">
                    <User size={16} />
                </button>

                {platform !== 'darwin' && (
                    <div className="flex items-center gap-1 ml-4 border-l border-white/10 dark:border-black/10 pl-4 h-full no-drag">
                        {/* @ts-ignore */}
                        <button onClick={() => window.electronAPI?.windowControls('minimize')} className="w-9 h-9 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100 transition-colors no-drag">
                            <Minus size={16} />
                        </button>
                        {/* @ts-ignore */}
                        <button onClick={() => window.electronAPI?.windowControls('maximize')} className="w-9 h-9 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100 transition-colors no-drag">
                            <Square size={14} />
                        </button>
                        {/* @ts-ignore */}
                        <button onClick={() => window.electronAPI?.windowControls('close')} className="w-9 h-9 rounded hover:bg-red-500 hover:text-white flex items-center justify-center opacity-70 hover:opacity-100 transition-colors no-drag">
                            <X size={18} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
