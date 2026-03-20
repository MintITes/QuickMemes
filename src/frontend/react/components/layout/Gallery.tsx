import { useEffect, useRef, useState } from 'react';
import { useMemeStore } from '../../stores/MemeStore';
import { VirtuosoGrid } from 'react-virtuoso';
import {
    ArrowLeft,
    ArrowRight,
    LayoutGrid,
    Columns3,
    Box,
    Crop,
    Tag,
    ImagePlus,
    SearchX,
    Inbox,
    Sparkles,
    FolderOpen,
} from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { EmptyState } from '../common/EmptyState';
import { GALLERY_ITEM_SIZE_MAX, GALLERY_ITEM_SIZE_MIN, useUiStore } from '../../stores/UiStore';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MemeCard } from './MemeCard';


export function Gallery() {
    const { t } = useTranslation();
    const memes = useMemeStore((state) => state.memes);
    const activeNav = useUiStore((state) => state.activeNav);
    const searchQuery = useUiStore((state) => state.searchQuery);
    const setSearchQuery = useUiStore((state) => state.setSearchQuery);

    const {
        viewMode,
        setViewMode,
        imageFit,
        setImageFit,
        showTags,
        setShowTags,
        selectedMemeIds,
        toggleImportModal,
        galleryItemSize,
        goBack,
        goForward,
        navHistory,
        navHistoryIndex,
    } = useUiStore();

    const mainRef = useRef<HTMLElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const zoomAnimationTimerRef = useRef<number | null>(null);
    const [isZoomResizing, setIsZoomResizing] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // Prevent browser zoom
                e.preventDefault();
                setIsZoomResizing(true);
                if (zoomAnimationTimerRef.current) {
                    window.clearTimeout(zoomAnimationTimerRef.current);
                }
                zoomAnimationTimerRef.current = window.setTimeout(() => {
                    setIsZoomResizing(false);
                    zoomAnimationTimerRef.current = null;
                }, 140);
                const delta = e.deltaY > 0 ? 1 : -1;
                // Faster zooming when holding shift, otherwise 20px step
                const step = e.shiftKey ? 50 : 20;

                useUiStore.setState((state) => {
                    const currentSize = state.galleryItemSize || 200;
                    const newSize = currentSize - delta * step;
                    return {
                        galleryItemSize: Math.max(GALLERY_ITEM_SIZE_MIN, Math.min(GALLERY_ITEM_SIZE_MAX, newSize)),
                    };
                });
            }
        };

        // Needs to be passive: false to prevent default
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
            if (zoomAnimationTimerRef.current) {
                window.clearTimeout(zoomAnimationTimerRef.current);
            }
        };
    }, []);

    const renderEmptyState = () => {
        if (searchQuery.keyword) {
            return (
                <EmptyState
                    icon={<SearchX size={48} />}
                    title={t('gallery.empty.search_no_results')}
                    description={t('gallery.empty.search_no_results_desc', { keyword: searchQuery.keyword })}
                    action={{
                        label: t('gallery.empty.clear_search'),
                        onClick: () => setSearchQuery({ keyword: '' }),
                        icon: <SearchX size={16} />,
                    }}
                />
            );
        }

        if (activeNav === 'trash') {
            return (
                <EmptyState
                    icon={<Inbox size={48} />}
                    title={t('gallery.empty.trash_empty')}
                    description={t('gallery.empty.trash_empty_desc')}
                />
            );
        }

        if (activeNav === 'untagged') {
            return (
                <EmptyState
                    icon={<Sparkles size={48} />}
                    title={t('gallery.empty.untagged_empty')}
                    description={t('gallery.empty.untagged_empty_desc')}
                />
            );
        }

        if (activeNav.startsWith('category-')) {
            return (
                <EmptyState
                    icon={<FolderOpen size={48} />}
                    title={t('gallery.empty.category_empty')}
                    description={t('gallery.empty.category_empty_desc')}
                />
            );
        }

        return (
            <EmptyState
                icon={<ImagePlus size={48} />}
                title={t('gallery.empty.no_memes')}
                description={t('gallery.empty.no_memes_desc')}
                action={{
                    label: t('gallery.empty.import_first'),
                    onClick: () => toggleImportModal(true),
                    icon: <ImagePlus size={16} />,
                }}
            />
        );
    };

    const renderMemeCard = (meme: typeof memes[number]) => {
        const isSelected = selectedMemeIds.includes(meme.id);

        return (
            <MemeCard
                key={meme.id}
                meme={meme}
                isSelected={isSelected}
                viewMode={viewMode}
                imageFit={imageFit}
                showTags={showTags}
                disableLayoutAnimation={isZoomResizing}
            />
        );
    };

    return (
        <main
            ref={mainRef}
            className="flex-1 h-full surface-effect gpu-layer flex flex-col relative z-0 overflow-hidden shadow-none box-border transition-[padding] duration-300"
            style={{ '--gallery-item-size': `${galleryItemSize || 200}px` } as React.CSSProperties}
        >
            <div className="h-12 mx-4 mt-3 mb-2 rounded-xl border border-borderColor flex px-4 items-center justify-between glass-effect gpu-layer z-10 sticky top-3">
                <div className="flex gap-1.5">
                    <IconButton
                        icon={<ArrowLeft size={18} />}
                        size="sm"
                        variant="ghost"
                        title={t('gallery.controls.back')}
                        disabled={navHistoryIndex === 0}
                        onClick={goBack}
                    />
                    <IconButton
                        icon={<ArrowRight size={18} />}
                        size="sm"
                        variant="ghost"
                        title={t('gallery.controls.forward')}
                        disabled={navHistoryIndex === navHistory.length - 1}
                        onClick={goForward}
                    />
                </div>

                <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 items-center">
                    <div className="flex">
                        <IconButton
                            icon={imageFit === 'contain' ? <Box size={16} /> : <Crop size={16} />}
                            size="sm"
                            variant="ghost"
                            active={imageFit === 'contain' || viewMode === 'masonry'}
                            disabled={viewMode === 'masonry'}
                            onClick={() => setImageFit(imageFit === 'contain' ? 'cover' : 'contain')}
                            title={viewMode === 'masonry' ? t('gallery.controls.original_ratio') : (imageFit === 'contain' ? t('gallery.controls.original_ratio') : t('gallery.controls.fill_crop'))}
                            className="rounded-lg"
                        />
                        <IconButton
                            icon={<Tag size={16} />}
                            size="sm"
                            variant="ghost"
                            active={showTags}
                            onClick={() => setShowTags(!showTags)}
                            title={showTags ? t('gallery.controls.hide_tags') : t('gallery.controls.show_tags')}
                            className="rounded-lg"
                        />
                    </div>

                    <div className="w-px h-3 bg-borderColor/40 mx-1.5" />

                    <div className="flex">
                        <IconButton
                            icon={<LayoutGrid size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                            className="rounded-lg"
                            title={t('gallery.controls.grid_view')}
                        />
                        <IconButton
                            icon={<Columns3 size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'masonry'}
                            onClick={() => setViewMode('masonry')}
                            className="rounded-lg"
                            title={t('gallery.controls.masonry_view')}
                        />
                    </div>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto pt-7 pr-6 pb-6 pl-7 scrollbar-hide gpu-layer"
            >
                {memes.length === 0 ? renderEmptyState() : (
                    viewMode === 'masonry' ? (() => {
                        const itemSize = galleryItemSize || 200;
                        const gap = 16;
                        const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemSize + gap)));
                        const masonryWidth = containerWidth > 0 ? columns * itemSize + (columns - 1) * gap : '100%';

                        return (
                            <div
                                className="pb-8 mx-auto"
                                style={{
                                    width: typeof masonryWidth === 'number' ? `${masonryWidth}px` : masonryWidth,
                                    columnWidth: `${itemSize}px`,
                                    columnGap: `${gap}px`,
                                    visibility: containerWidth > 0 ? 'visible' : 'hidden'
                                }}
                            >
                                {memes.map((meme) => (
                                    <div key={meme.id} className="break-inside-avoid">
                                        {renderMemeCard(meme)}
                                    </div>
                                ))}
                            </div>
                        );
                    })() : (
                        <VirtuosoGrid
                            totalCount={memes.length}
                            listClassName={clsx(
                                'grid gap-4 w-full pb-8 justify-start content-start',
                                'grid-cols-[repeat(auto-fill,var(--gallery-item-size,200px))]'
                            )}
                            itemContent={(index) => {
                                const meme = memes[index];
                                if (!meme) {
                                    return null;
                                }

                                return renderMemeCard(meme);
                            }}
                        />
                    )
                )}
            </div>
        </main>
    );
}
