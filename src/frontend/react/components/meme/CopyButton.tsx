import React from 'react';
import { Clipboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../../stores/NotificationStore';
import clsx from 'clsx';

interface CopyButtonProps {
    memeId: number;
    memeName: string;
    isVisible: boolean;
}

export function CopyButton({ memeId, memeName, isVisible }: CopyButtonProps) {
    const { t } = useTranslation();
    const addNotification = useNotificationStore(state => state.addNotification);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        try {
            await window.electronAPI.writeClipboardImageFromMeme(memeId);
            addNotification({
                type: 'success',
                title: t('gallery.item.copy_success'),
                description: memeName,
            });
        } catch {
            addNotification({
                type: 'error',
                title: t('common.copy_failed'),
            });
        }
    };

    return (
        <button
            title={t('gallery.item.copy_image')}
            onClick={handleCopy}
            className={clsx(
                "w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-lg border border-white/20 backdrop-blur-md",
                "bg-white/90 dark:bg-black/80 text-textPrimary hover:bg-white dark:hover:bg-black hover:scale-105 active:scale-95",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
            )}
            onMouseDown={(e) => e.preventDefault()}
        >
            <Clipboard size={14} />
        </button>
    );
}
