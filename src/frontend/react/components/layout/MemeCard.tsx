import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useUiStore } from '../../stores/UiStore';
import { getThumbnailUrl, revokeAssetUrl } from '../../services/assetService';
import type { Meme } from '../../types';

import { MemeCardMedia } from '../meme/MemeCardMedia';
import { MemeCardMeta } from '../meme/MemeCardMeta';
import { MoreButton } from '../meme/MoreButton';

interface MemeCardProps {
    meme: Meme;
    isSelected: boolean;
    viewMode: 'grid' | 'masonry' | 'list';
    imageFit: 'contain' | 'cover';
    showTags: boolean;
    disableLayoutAnimation?: boolean;
}

export function MemeCard({ meme, isSelected, viewMode, imageFit, showTags, disableLayoutAnimation = false }: MemeCardProps) {
    const { t } = useTranslation();
    const { selectMeme, setContextMenu, setLightboxMemeId, cornerRadius, selectedMemeIds } = useUiStore();

    const [src, setSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Manage stable meme ID to prevent flickering on data updates
    const [lastMemeId, setLastMemeId] = useState<number>(meme.id);
    const clickTimeout = useRef<number | null>(null);

    if (meme.id !== lastMemeId) {
        setLastMemeId(meme.id);
        setIsLoading(true);
        setSrc(null);
    }

    useEffect(() => {
        let cancelled = false;
        void getThumbnailUrl(meme.id).then((nextUrl) => {
            if (!cancelled) {
                setSrc(nextUrl);
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

    const handleClick = (event: React.MouseEvent) => {
        // Prevent event bubbling to avoid conflicts with child elements
        event.stopPropagation();

        const isMulti = event.metaKey || event.ctrlKey;

        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
            return; // Handled by double click
        }

        clickTimeout.current = window.setTimeout(() => {
            selectMeme(meme.id, isMulti);
            clickTimeout.current = null;
        }, 200);
    };

    const handleDoubleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
        selectMeme(meme.id, false); // Make sure it's the only one selected
        setLightboxMemeId(meme.id); // Open lightbox on double click
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();

        // If not already selected, select only this one.
        // If already part of a multi-selection, keep it.
        if (!selectedMemeIds.includes(meme.id)) {
            selectMeme(meme.id, false);
        }

        setContextMenu({
            memeId: meme.id,
            x: e.clientX,
            y: e.clientY
        });
    };

    return (
        <motion.div
            layout={disableLayoutAnimation ? false : 'position'}
            className={clsx(
                'flex flex-col cursor-pointer select-none group/card relative',
                viewMode === 'masonry' && 'mb-4'
            )}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            transition={{
                layout: disableLayoutAnimation ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30, mass: 0.8 },
                opacity: { duration: 0.25 },
                y: { type: "spring", stiffness: 400, damping: 25 },
                scale: { duration: 0.1 }
            }}
        >
            <div className="relative isolate">
                <MemeCardMedia
                    meme={meme}
                    src={src}
                    isLoading={isLoading}
                    isSelected={isSelected}
                    viewMode={viewMode}
                    imageFit={imageFit}
                    showTags={showTags}
                    onImageLoad={() => setIsLoading(false)}
                />

                {/* Floating More Button - Enhanced visibility on hover */}
                <div className={clsx(
                    'absolute bottom-2 right-2 z-30 transition-all duration-300 transform-gpu',
                    isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100'
                )}>
                    <MoreButton
                        memeId={meme.id}
                        isVisible={true} // Controlled by parent visibility classes
                        title={t('gallery.item.more')}
                    />
                </div>
            </div>

            <MemeCardMeta
                meme={meme}
                isSelected={isSelected}
                showTags={showTags}
            />

            {/* Subtle glow effect for selected item */}
            {isSelected && (
                <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                        borderRadius: `${cornerRadius}px`,
                        background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--accent-color), transparent 75%), transparent 56%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent-color), transparent 82%), transparent 62%)',
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--accent-color), transparent 45%)`
                    }}
                />
            )}
        </motion.div>
    );
}
