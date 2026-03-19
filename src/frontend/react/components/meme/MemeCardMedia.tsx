import { motion, AnimatePresence } from 'framer-motion';
import { Check, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import { SkeletonCard } from '../common/SkeletonCard';
import type { Meme } from '../../types';
import { useUiStore } from '../../stores/UiStore';
import { useTagStore } from '../../stores/TagStore';

interface MemeCardMediaProps {
    meme: Meme;
    src: string | null;
    isLoading: boolean;
    isSelected: boolean;
    viewMode: 'grid' | 'masonry' | 'list';
    imageFit: 'contain' | 'cover';
    showTags: boolean;
    onImageLoad: () => void;
}

export function MemeCardMedia({
    meme, src, isLoading, isSelected, viewMode, imageFit, showTags, onImageLoad
}: MemeCardMediaProps) {
    const { cornerRadius, accentColor } = useUiStore();
    const tags = useTagStore((state) => state.tags);
    const memeTags = tags.filter((entry) => meme.tagIds.includes(entry.id));

    const radiusValue = `${cornerRadius}px`;
    const innerRadiusValue = `${Math.max(0, cornerRadius - 1)}px`;
    const shouldShowTags = showTags && memeTags.length > 0;

    return (
        <div
            className={clsx(
                'w-full relative flex items-center justify-center transition-all duration-500 group/media',
                viewMode === 'grid' && 'aspect-square'
            )}
            style={{
                aspectRatio: viewMode === 'masonry' && meme.width && meme.height
                    ? `${meme.width} / ${meme.height}`
                    : undefined,
                minHeight: viewMode === 'masonry' && (!meme.width || !meme.height) ? '150px' : undefined,
                borderRadius: radiusValue,
                // Keep the selection stroke inside the card bounds so edge items do not get clipped.
                boxShadow: isSelected
                    ? `inset 0 0 0 2px ${accentColor}, 0 8px 20px -4px ${accentColor}40`
                    : '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.1)'
            }}
        >
            {/* Inner Border / Shadow for depth */}
            <div
                className={clsx(
                    'absolute inset-0 z-20 pointer-events-none transition-all duration-300',
                    isSelected
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/media:opacity-100'
                )}
                style={{
                    borderRadius: radiusValue,
                    boxShadow: isSelected
                        ? `inset 0 0 0 1px rgba(255,255,255,0.2)`
                        : 'inset 0 0 0 1px rgba(255,255,255,0.1)'
                }}
            />

            <div
                className="absolute inset-px overflow-hidden bg-white dark:bg-white/5 isolate transform-gpu"
                style={{ borderRadius: innerRadiusValue }}
            >
                {/* Selection Badge */}
                <AnimatePresence>
                    {isSelected && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-2 left-2 w-5 h-5 text-white rounded-full flex items-center justify-center shadow-lg z-30 transition-colors"
                            style={{ backgroundColor: accentColor }}
                        >
                            <Check size={12} strokeWidth={4} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Media Container */}
                <div
                    className="absolute inset-0 w-full h-full overflow-hidden bg-black/[0.03] dark:bg-white/[0.03]"
                    style={{ borderRadius: 'inherit' }}
                >
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
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: isLoading ? 0 : 1, scale: isLoading ? 1.05 : 1 }}
                            onLoad={onImageLoad}
                            className={clsx(
                                'w-full h-full transition-[transform,filter] duration-700 transform-gpu',
                                'group-hover/media:scale-[1.04]',
                                // For masonry, we always want to show the full image without cropping
                                viewMode === 'masonry' ? 'object-contain' : (imageFit === 'contain' ? 'object-contain p-2' : 'object-cover')
                            )}
                            style={{ borderRadius: 'inherit' }}
                        />
                    ) : !isLoading && (
                        <div className="w-full h-full flex items-center justify-center text-textSecondary/40">
                            <ImageIcon size={32} strokeWidth={1.5} />
                        </div>
                    )}
                </div>

                {/* Hover Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {shouldShowTags && (
                    <div className="absolute left-2 right-12 bottom-2 z-20 flex flex-wrap gap-1 pointer-events-none">
                        {memeTags.map((tagEntry) => (
                            <span
                                key={tagEntry.id}
                                className="relative inline-flex max-w-full items-center overflow-hidden rounded-md px-2 py-0.5"
                                title={tagEntry.name}
                            >
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-md"
                                    style={{ backgroundColor: accentColor }}
                                />
                                <span className="relative truncate text-[10px] font-bold whitespace-nowrap text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
                                    {tagEntry.name}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
