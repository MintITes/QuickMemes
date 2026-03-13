import React, { useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';
import clsx from 'clsx';
import { useUiStore } from '../../stores/UiStore';
import './WindowControlButton.css';

interface WindowControlButtonProps {
    className?: string;
}

export const WindowControlButton: React.FC<WindowControlButtonProps> = ({ className }) => {
    // @ts-expect-error - electronAPI is injected by preload script
    const systemPlatform = window.electronAPI?.platform || 'linux';
    const platformOverride = useUiStore(state => state.platformOverride);
    const platform = platformOverride === 'auto' ? systemPlatform : platformOverride;

    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        const handleFocus = () => setIsFocused(true);
        const handleBlur = () => setIsFocused(false);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const handleAction = (action: 'minimize' | 'maximize' | 'close') => {
        // @ts-expect-error - electronAPI is injected by preload script
        window.electronAPI?.windowControls(action);
    };

    if (platform === 'darwin') {
        return (
            <div className={clsx("window-controls-macos flex items-center gap-2 px-3 no-drag group/macos", className)}>
                <button
                    onClick={() => handleAction('close')}
                    className={clsx("macos-btn macos-close", !isFocused && "macos-inactive")}
                    aria-label="Close"
                />
                <button
                    onClick={() => handleAction('minimize')}
                    className={clsx("macos-btn macos-minimize", !isFocused && "macos-inactive")}
                    aria-label="Minimize"
                />
                <button
                    onClick={() => handleAction('maximize')}
                    className={clsx("macos-btn macos-maximize", !isFocused && "macos-inactive")}
                    aria-label="Maximize"
                />
            </div>
        );
    }

    return (
        <div className={clsx("window-controls-win flex items-center no-drag h-full", className)}>
            <button
                onClick={() => handleAction('minimize')}
                className={clsx("win-btn", !isFocused && "win-inactive")}
                aria-label="Minimize"
            >
                <Minus size={14} />
            </button>
            <button
                onClick={() => handleAction('maximize')}
                className={clsx("win-btn", !isFocused && "win-inactive")}
                aria-label="Maximize"
            >
                <Square size={12} />
            </button>
            <button
                onClick={() => handleAction('close')}
                className={clsx("win-btn win-close", !isFocused && "win-inactive")}
                aria-label="Close"
            >
                <X size={16} />
            </button>
        </div>
    );
};
