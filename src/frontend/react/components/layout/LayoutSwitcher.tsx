import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/UiStore';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Portal } from '../common/Portal';

interface LayoutSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}

export function LayoutSwitcher({ isOpen, onClose, anchorRef }: LayoutSwitcherProps) {
    const { sidebarExpanded, setSidebarExpanded, isPanelOpen, togglePanel } = useUiStore();
    const panelRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, right: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEsc);

            // Calculate position when opening
            const updatePosition = () => {
                const rect = anchorRef.current?.getBoundingClientRect();
                if (rect) {
                    setCoords({
                        top: rect.bottom + 8,
                        right: window.innerWidth - rect.right,
                    });
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEsc);
                window.removeEventListener('resize', updatePosition);
            };
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose, anchorRef]);

    const { t } = useTranslation();
    const layouts = [
        { id: 'full', label: t('layouts.full'), expanded: true, panel: true },
        { id: 'left_only', label: t('layouts.left_only'), expanded: true, panel: false },
        { id: 'right_only', label: t('layouts.right_only'), expanded: false, panel: true },
        { id: 'simple', label: t('layouts.simple'), expanded: false, panel: false },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <Portal>
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="fixed w-64 surface-effect border border-borderColor rounded-2xl shadow-2xl p-4 z-[100] grid grid-cols-2 gap-3 no-drag"
                        style={{
                            top: coords.top,
                            right: coords.right,
                        }}
                    >
                        {layouts.map((layout) => {
                            const isActive = sidebarExpanded === layout.expanded && isPanelOpen === layout.panel;
                            return (
                                <button
                                    key={layout.id}
                                    onClick={() => {
                                        setSidebarExpanded(layout.expanded);
                                        togglePanel(layout.panel);
                                        onClose();
                                    }}
                                    className={clsx(
                                        "flex flex-col items-center gap-2 p-3 rounded-xl transition-all group border-2",
                                        isActive
                                            ? "bg-accent/10 border-accent shadow-sm"
                                            : "hover:bg-black/5 dark:hover:bg-white/5 border-transparent hover:border-borderColor"
                                    )}
                                >
                                    {/* Layout Icon */}
                                    <div className="w-full aspect-[16/10] rounded-lg border border-white/10 dark:border-black/20 bg-black/10 dark:bg-black/60 flex gap-0.5 p-1 overflow-hidden relative shadow-inner group-hover:scale-[1.02] transition-transform duration-300">

                                        {/* Left Side (Sidebar) - THE FOCUS */}
                                        <div className={clsx(
                                            "rounded-sm transition-all duration-500 h-full flex flex-col gap-1 p-1 border border-white/5 relative",
                                            layout.expanded
                                                ? "w-[30%] bg-accent opacity-100 shadow-[2px_0_10px_rgba(0,0,0,0.1)]"
                                                : "w-[12%] bg-accent opacity-100 items-center justify-start pt-1.5"
                                        )}>
                                            {layout.expanded ? (
                                                <>
                                                    <div className="h-1 w-full bg-white/40 rounded-full mb-0.5" />
                                                    <div className="h-0.5 w-[70%] bg-white/20 rounded-full" />
                                                    <div className="h-0.5 w-[50%] bg-white/20 rounded-full" />
                                                </>
                                            ) : (
                                                /* Tiny Logo Mark for folded state */
                                                <div className="w-1.5 h-1.5 bg-white rounded-[1px] shadow-sm animate-pulse" />
                                            )}
                                        </div>

                                        {/* Main Content (Gallery) - NEUTRAL BACKGROUND */}
                                        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-sm h-full p-1 opacity-40">
                                            <div className="grid grid-cols-3 gap-0.5">
                                                {[...Array(6)].map((_, i) => (
                                                    <div key={i} className="aspect-square bg-black/20 dark:bg-white/10 rounded-[1px]" />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Right Side (Inspector) - THE FOCUS */}
                                        <div className={clsx(
                                            "rounded-sm transition-all duration-500 h-full flex flex-col gap-1 border border-white/5",
                                            layout.panel
                                                ? "w-[30%] bg-accent opacity-100 p-1 shadow-[-2px_0_10px_rgba(0,0,0,0.1)]"
                                                : "w-0 opacity-0 overflow-hidden border-none"
                                        )}>
                                            <div className="aspect-square w-full bg-white/30 rounded-sm mb-0.5" />
                                            <div className="h-0.5 w-full bg-white/20 rounded-full" />
                                            <div className="h-0.5 w-[70%] bg-white/20 rounded-full" />
                                        </div>

                                        {/* Active Indicator Overlay */}
                                        {isActive && (
                                            <div className="absolute inset-0 border-[1.5px] border-accent/50 rounded-lg z-10 pointer-events-none" />
                                        )}
                                    </div>

                                    <span className={clsx(
                                        "text-[10px] font-bold tracking-tight transition-colors",
                                        isActive ? "text-accent" : "text-textSecondary group-hover:text-textPrimary"
                                    )}>
                                        {layout.label}
                                    </span>
                                </button>
                            );
                        })}
                    </motion.div>
                </Portal>
            )}
        </AnimatePresence>
    );
}
