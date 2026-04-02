import { useEffect, useRef, useState, useCallback } from 'react';
import { useMemeStore } from '../../stores/MemeStore';

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
import { useShallow } from 'zustand/react/shallow';
import { MemeCard } from './MemeCard';


export function Gallery() {
    const { t } = useTranslation();
    const memes = useMemeStore((state) => state.memes);
    const {
        activeNav,
        searchQuery,
        setSearchQuery,
        viewMode,
        setViewMode,
        imageFit,
        setImageFit,
        showTags,
        setShowTags,
        selectedMemeIds,
        toggleImportModal,
        galleryItemSize,
        galleryGap,
        goBack,
        goForward,
        navHistory,
        navHistoryIndex,
    } = useUiStore(
        useShallow((state) => ({
            activeNav: state.activeNav,
            searchQuery: state.searchQuery,
            setSearchQuery: state.setSearchQuery,
            viewMode: state.viewMode,
            setViewMode: state.setViewMode,
            imageFit: state.imageFit,
            setImageFit: state.setImageFit,
            showTags: state.showTags,
            setShowTags: state.setShowTags,
            selectedMemeIds: state.selectedMemeIds,
            toggleImportModal: state.toggleImportModal,
            galleryItemSize: state.galleryItemSize,
            galleryGap: state.galleryGap,
            goBack: state.goBack,
            goForward: state.goForward,
            navHistory: state.navHistory,
            navHistoryIndex: state.navHistoryIndex,
        }))
    );

    const mainRef = useRef<HTMLElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const zoomAnimationTimerRef = useRef<number | null>(null);
    const viewSwitchTimerRef = useRef<number | null>(null);
    const [isZoomResizing, setIsZoomResizing] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    // 视图切换时先 fade out，重排完成后再 fade in
    const [isSwitchingView, setIsSwitchingView] = useState(false);
    const [displayedViewMode, setDisplayedViewMode] = useState(viewMode);

    const handleSetViewMode = useCallback((mode: 'grid' | 'masonry') => {
        if (mode === viewMode) return;
        if (viewSwitchTimerRef.current) {
            window.clearTimeout(viewSwitchTimerRef.current);
        }
        setIsSwitchingView(true);
        viewSwitchTimerRef.current = window.setTimeout(() => {
            setDisplayedViewMode(mode);
            setViewMode(mode);
            // 等待一帧让 DOM 完成重排再 fade in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsSwitchingView(false);
                    viewSwitchTimerRef.current = null;
                });
            });
        }, 150);
    }, [viewMode, setViewMode]);

    // 保持 displayedViewMode 与外部 viewMode 同步（外部直接修改时）
    useEffect(() => {
        if (!isSwitchingView && displayedViewMode !== viewMode) {
            setDisplayedViewMode(viewMode);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || displayedViewMode !== 'masonry') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [displayedViewMode]);

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

    // 组件卸载时清理 viewSwitch 定时器
    useEffect(() => {
        return () => {
            if (viewSwitchTimerRef.current) {
                window.clearTimeout(viewSwitchTimerRef.current);
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
                viewMode={displayedViewMode}
                imageFit={imageFit}
                showTags={showTags}
                disableLayoutAnimation={isZoomResizing || isSwitchingView}
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
                            onClick={() => handleSetViewMode('grid')}
                            className="rounded-lg"
                            title={t('gallery.controls.grid_view')}
                        />
                        <IconButton
                            icon={<Columns3 size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'masonry'}
                            onClick={() => handleSetViewMode('masonry')}
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
                {memes.length === 0 ? renderEmptyState() : (() => {
                    const itemSize = galleryItemSize || 200;
                    const gap = galleryGap || 16;
                    const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemSize + gap)));
                    const masonryWidth = containerWidth > 0 ? columns * itemSize + (columns - 1) * gap : '100%';

                    return (
                        <div
                            className={clsx(
                                'w-full pb-8',
                                displayedViewMode === 'masonry' 
                                    ? 'mx-auto' 
                                    : 'grid gap-[var(--gallery-gap)] justify-start content-start grid-cols-[repeat(auto-fill,var(--gallery-item-size,200px))]'
                            )}
                            style={{
                                ...(displayedViewMode === 'masonry' ? {
                                    width: typeof masonryWidth === 'number' ? `${masonryWidth}px` : masonryWidth,
                                    columnWidth: `${itemSize}px`,
                                    columnGap: `${gap}px`,
                                    visibility: containerWidth > 0 ? 'visible' : 'hidden'
                                } : undefined),
                                opacity: isSwitchingView ? 0 : 1,
                                transition: isSwitchingView ? 'opacity 0.15s ease-out' : 'opacity 0.2s ease-in',
                            }}
                        >
                            {memes.map((meme) => (
                                <div key={meme.id} className={displayedViewMode === 'masonry' ? 'break-inside-avoid' : undefined}>
                                    {renderMemeCard(meme)}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>
        </main>
    );
}
