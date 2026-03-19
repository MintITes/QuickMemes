import React, { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useUiStore } from '../../stores/UiStore';

interface MoreButtonProps {
    memeId: number;
    isVisible: boolean;
    title: string;
}

export function MoreButton({ memeId, isVisible, title }: MoreButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const setContextMenu = useUiStore(state => state.setContextMenu);
    const contextMenu = useUiStore(state => state.contextMenu);

    const isOpen = contextMenu?.memeId === memeId;
    const shouldShow = isVisible || isOpen;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (isOpen) {
            setContextMenu(null);
            return;
        }

        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setContextMenu({
                memeId,
                x: rect.right,
                y: rect.bottom,
                anchorRect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                },
                preferredPlacements: ['right', 'left', 'top', 'bottom'],
            });
        }
    };

    return (
        <button
            ref={buttonRef}
            title={title}
            onClick={handleClick}
            className={clsx(
                "w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                shouldShow ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
                isOpen
                    ? "bg-accent text-white shadow-lg scale-100"
                    : "bg-white/90 dark:bg-black/80 text-textPrimary hover:bg-white dark:hover:bg-black shadow-lg border border-white/20 backdrop-blur-md hover:scale-105 active:scale-95"
            )}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus management issues
        >
            <MoreHorizontal size={14} className={clsx("transition-transform", isOpen && "rotate-90")} />
        </button>
    );
}
