import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clipboard, FileUp, Link as LinkIcon } from 'lucide-react';
import { Portal } from './Portal';

interface DropdownMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement | null>;
    onAction: (type: 'quick' | 'clipboard' | 'file' | 'url') => void;
}

const menuItems = [
    { id: 'quick', label: '快捷导入', icon: <Zap size={16} />, description: '弹出拖拽导入窗口' },
    { id: 'clipboard', label: '从剪贴板导入', icon: <Clipboard size={16} />, description: '直接读取图片' },
    { id: 'file', label: '从文件导入', icon: <FileUp size={16} />, description: '选择本地图片' },
    { id: 'url', label: '从 URL 导入', icon: <LinkIcon size={16} />, description: '输入网络图片链接' },
];

export function DropdownMenu({ isOpen, onClose, anchorRef, onAction }: DropdownMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = React.useState<React.CSSProperties>({});

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isClickOnMenu = menuRef.current?.contains(target);

            const isClickOnAnchor = (event.target as HTMLElement).closest('[data-testid="btn-add"]');

            if (isOpen && !isClickOnMenu && !isClickOnAnchor) {
                onClose();
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEsc);
            window.addEventListener('blur', onClose);

            // Calculate position when opening
            if (anchorRef?.current) {
                const rect = anchorRef.current.getBoundingClientRect();
                const menuWidth = 256;
                const anchorCenter = rect.left + rect.width / 2;
                let leftPos = anchorCenter - menuWidth / 2;

                // Boundaries check
                if (leftPos < 12) leftPos = 12;
                if (leftPos + menuWidth > window.innerWidth - 12) {
                    leftPos = window.innerWidth - menuWidth - 12;
                }

                setStyle({
                    top: `${rect.bottom + 8}px`,
                    left: `${leftPos}px`
                });
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
            window.removeEventListener('blur', onClose);
        };
    }, [isOpen, onClose, anchorRef]);

    return (
        <AnimatePresence>
            {isOpen && (
                <Portal>
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className="fixed z-[100] w-64 glass-effect rounded-2xl overflow-hidden no-drag"
                        style={style}
                    >
                        <div className="p-1.5 flex flex-col gap-0.5">
                            {menuItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        onAction(item.id as 'quick' | 'clipboard' | 'file' | 'url');
                                        onClose();
                                    }}
                                    className="w-full group flex items-start gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-left"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-textSecondary group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                                        {item.icon}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[13px] font-medium text-textPrimary group-hover:text-accent transition-colors">
                                            {item.label}
                                        </span>
                                        <span className="text-[11px] text-textSecondary">
                                            {item.description}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </Portal>
            )}
        </AnimatePresence>
    );
}
