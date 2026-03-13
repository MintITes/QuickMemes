import { useState, useRef } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { Search, LayoutGrid, Sun, Moon, Settings, User } from 'lucide-react';
import clsx from 'clsx';

import { IconButton } from '../common/IconButton';
import { PlusButton } from '../common/PlusButton';
import { WindowControlButton } from '../common/WindowControlButton';
import { DropdownMenu } from '../common/DropdownMenu';

export function Header() {
    // @ts-ignore
    const systemPlatform = window.electronAPI?.platform || 'linux';
    const platformOverride = useUiStore(state => state.platformOverride);
    const platform = platformOverride === 'auto' ? systemPlatform : platformOverride;

    const { resolvedTheme, setTheme, toggleSettings, toggleImportModal } = useUiStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const plusButtonRef = useRef<HTMLButtonElement>(null);

    const handleThemeToggle = () => {
        const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    };

    const handleAction = (type: string) => {
        console.log('Action selected:', type);
        if (type === 'quick') {
            toggleImportModal(true);
        }
    };

    return (
        <header
            className="h-14 flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center px-4 border-b border-white/10 dark:border-black/10 z-50 glass-effect no-drag"
            data-testid="header"
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            {/* macOS Window Controls handled by our dynamic component */}
            <div className={clsx("flex items-center gap-2 justify-self-start h-full", platform === 'darwin' ? 'ml-0' : '')}>
                {platform === 'darwin' && <WindowControlButton className="mr-2" />}
                <div
                    className="h-8 w-8 relative flex-shrink-0 transition-all duration-500"
                    style={{
                        filter: 'drop-shadow(0 0 2px var(--accent-color))',
                        WebkitFilter: 'drop-shadow(0 0 2px var(--accent-color))'
                    } as any}
                >
                    <div
                        className="absolute inset-0 bg-accent transition-colors duration-500"
                        style={{
                            WebkitMaskImage: `url(${resolvedTheme === 'dark' ? '/icon-dark.svg' : '/icon.svg'})`,
                            maskImage: `url(${resolvedTheme === 'dark' ? '/icon-dark.svg' : '/icon.svg'})`,
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain'
                        }}
                    />
                </div>
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
                <PlusButton
                    ref={plusButtonRef}
                    active={isMenuOpen}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 scale-90 group-focus-within:scale-100 transition-all duration-300"
                    data-testid="btn-add"
                />
                <DropdownMenu
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    anchorRect={plusButtonRef.current?.getBoundingClientRect()}
                    onAction={handleAction}
                />
            </div>

            {/* Tools Area */}
            <div className="flex items-center gap-1 justify-self-end no-drag">
                <IconButton
                    icon={<LayoutGrid size={18} />}
                    aria-label="Layout"
                    className="opacity-70 hover:opacity-100"
                />
                <IconButton
                    icon={resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    aria-label="Theme"
                    className="opacity-70 hover:opacity-100"
                    onClick={handleThemeToggle}
                    title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                />
                <IconButton
                    icon={<Settings size={18} />}
                    aria-label="Settings"
                    className="opacity-70 hover:opacity-100"
                    onClick={() => toggleSettings(true)}
                />

                <div className="w-0.5 h-4 bg-black/10 dark:bg-white/10 mx-2 no-drag"></div>

                <button
                    className="w-9 h-9 rounded-full bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center no-drag border border-accent/20 hover:border-accent/50 hover:bg-accent/30 hover:scale-105 active:scale-95 transition-all duration-300 glass-effect group relative overflow-hidden"
                    title="User Profile"
                >
                    {/* Subtle inner glow */}
                    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <User size={18} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
                </button>

                {platform !== 'darwin' && (
                    <WindowControlButton className="ml-4 border-l border-white/10 dark:border-black/10" />
                )}
            </div>
        </header>
    );
}
