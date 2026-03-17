import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, MoreHorizontal, Info, Check, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { IconButton } from '../common/IconButton';
import { useUiStore } from '../../stores/UiStore';
import { useTagStore } from '../../stores/TagStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { getThumbnailUrl, revokeAssetUrl } from '../../services/assetService';
import { SkeletonCard } from '../common/SkeletonCard';
import type { Meme } from '../../types';

interface MemeCardProps {
    meme: Meme;
    isSelected: boolean;
    viewMode: 'grid' | 'masonry' | 'list';
    imageFit: 'contain' | 'cover';
    showTags: boolean;
}

export function MemeCard({ meme, isSelected, viewMode, imageFit, showTags }: MemeCardProps) {
    const { t } = useTranslation();
    const { selectMeme, togglePanel } = useUiStore();
    const tags = useTagStore((state) => state.tags);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const [src, setSrc] = useState<string | null>(null);
    const [lastMemeId, setLastMemeId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    if (meme.id !== lastMemeId) {
        setLastMemeId(meme.id);
        setIsLoading(true);
        setSrc(null);
    }
    const [isFlashing, setIsFlashing] = useState(false);
    const clickTimeout = useRef<number | null>(null);

    const memeTags = tags.filter((entry) => meme.tagIds.includes(entry.id));

    useEffect(() => {
        let cancelled = false;
        void getThumbnailUrl(meme.id).then((nextUrl) => {
            if (!cancelled) {
                setSrc(nextUrl);
                // Note: actual fade-in is handled by the img.onLoad or simple CSS
            }
        }).catch(() => {
            if (!cancelled) {
                setSrc(null);
                setIsLoading(false);
            }
        });

        return () => {
            cancelled = true;
            revokeAssetUrl(`thumb:${meme.id}`);
        };
    }, [meme.id]);

    const handleCopy = async () => {
        try {
            await window.electronAPI.writeClipboardImageFromMeme(meme.id);
            addNotification({
                type: 'success',
                title: t('gallery.item.copy_success'),
                description: meme.name,
            });

            // Trigger flash effect
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 400);
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.failed') || 'Error',
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const handleClick = (event: React.MouseEvent) => {
        const isMulti = event.metaKey || event.ctrlKey;

        // Single click logic
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
            // Double click triggered - will be handled by onDoubleClick
            return;
        }

        clickTimeout.current = setTimeout(() => {
            selectMeme(meme.id, isMulti);
            clickTimeout.current = null;
        }, 200); // Short delay to distinguish from double click
    };

    const handleDoubleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
        handleCopy();
    };

    const handleMoreClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        // More menu logic can be added here
    };

    const handleInfoClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        selectMeme(meme.id);
        togglePanel(true);
    };

    return (
        <motion.div
            className={clsx(
                'flex flex-col gap-2 group cursor-pointer select-none',
                viewMode === 'masonry' && 'mb-4'
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className={clsx(
                'w-full bg-white dark:bg-white/5 rounded-xl border flex items-center justify-center relative overflow-hidden transition-[border-color,box-shadow,background-color] duration-300',
                isSelected
                    ? 'border-accent ring-2 ring-accent/30 shadow-lg'
                    : 'border-borderColor hover:border-accent/40 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]',
                viewMode === 'grid' ? 'aspect-square' : 'min-h-[150px]'
            )}>
                {/* Visual Feedback Overlays */}
                <AnimatePresence>
                    {isFlashing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-accent z-20 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* Selection Indicator */}
                {isSelected && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center shadow-md z-10">
                        <Check size={12} strokeWidth={4} />
                    </div>
                )}

                {/* Thumbnail Image */}
                <div className="w-full h-full relative">
                    <AnimatePresence mode="wait">
                        {isLoading && (
                            <motion.div
                                key="skeleton"
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-0"
                            >
                                <SkeletonCard viewMode={viewMode} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {src ? (
                        <motion.img
                            key="image"
                            src={src}
                            alt={meme.name}
                            draggable={false}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isLoading ? 0 : 1 }}
                            onLoad={() => setIsLoading(false)}
                            className={clsx(
                                'w-full h-full transition-transform duration-500 group-hover:scale-105',
                                imageFit === 'contain' ? 'object-contain p-4' : 'object-cover'
                            )}
                        />
                    ) : !isLoading && (
                        <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5">
                            <ImageIcon className="text-textSecondary/40" size={36} />
                        </div>
                    )}
                </div>

                {/* Hover Action Buttons */}
                <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200 z-10">
                    <IconButton
                        icon={<Copy size={14} />}
                        size="sm"
                        className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20 backdrop-blur-md"
                        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                        title={t('gallery.item.copy_image')}
                    />
                    <IconButton
                        icon={<Info size={14} />}
                        size="sm"
                        className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20 backdrop-blur-md"
                        onClick={handleInfoClick}
                        title={t('gallery.item.view_details')}
                    />
                    <IconButton
                        icon={<MoreHorizontal size={14} />}
                        size="sm"
                        className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20 backdrop-blur-md"
                        onClick={handleMoreClick}
                        title={t('gallery.item.more')}
                    />
                </div>
            </div>

            {/* Label Area */}
            {(showTags || viewMode === 'grid') && (
                <div className="px-1 flex flex-col gap-0.5">
                    <span className={clsx(
                        'text-xs font-medium truncate transition-colors',
                        isSelected ? 'text-accent' : 'text-textPrimary'
                    )}>
                        {meme.name}
                    </span>
                    {showTags && memeTags.length > 0 && (
                        <div className="flex gap-1 overflow-hidden flex-wrap">
                            {memeTags.slice(0, 3).map((tagEntry) => (
                                <span
                                    key={tagEntry.id}
                                    className="text-[10px] text-accent font-medium px-1.5 py-0.5 bg-accent/10 rounded-md border border-accent/20"
                                >
                                    {tagEntry.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
