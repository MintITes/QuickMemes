import { useEffect, useRef, useState, useCallback, useMemo, startTransition, useDeferredValue } from 'react';
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
    const pendingFadeInRef = useRef(false); // 初始 masonry 加载时（containerWidth=0）的保险机制
    const firstMeasuredRef = useRef(false);  // 跳过首次测量（初始化阶段不属于用户 resize）
    // 虚拟化：rAF 节流后的滚动位置，用于可见区域计算
    const rafIdRef = useRef<number | null>(null);
    const containerHeightRef = useRef(600);
    const [virtualScrollTop, setVirtualScrollTop] = useState(0);
    const virtualScrollTopRef = useRef(0);
    const VIRTUAL_OVERSCAN_PX = 1200;
    const [isZoomResizing, setIsZoomResizing] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    // useDeferredValue：侧栏动画期间 React 并发调度器会自动跳过中间帧的布局计算，
    // 动画结束后立即处理最新宽度，无需手动 setTimeout 防抖，也不引入人为延迟
    const deferredContainerWidth = useDeferredValue(containerWidth);
    // isSwitchingView=true 时内容区 opacity:0（fade-out / 切换中）
    const [isSwitchingView, setIsSwitchingView] = useState(false);
    const [displayedViewMode, setDisplayedViewMode] = useState(viewMode);
    const hasMore = useMemeStore((state) => state.hasMore);
    const hasMoreRef = useRef(hasMore);
    useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

    const handleSetViewMode = useCallback((mode: 'grid' | 'masonry') => {
        if (mode === viewMode) return;
        if (viewSwitchTimerRef.current) {
            window.clearTimeout(viewSwitchTimerRef.current);
        }
        setIsSwitchingView(true);
        viewSwitchTimerRef.current = window.setTimeout(() => {
            // 用 startTransition 标记为低优先级，避免阻塞主线程
            startTransition(() => {
                setDisplayedViewMode(mode);
                setViewMode(mode);
                // 两个方向统一：不重置 containerWidth，直接 rAF 后 fade-in
                // containerWidth 是同一容器的宽度，切换布局模式时值不变，无需重测
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setIsSwitchingView(false);
                        viewSwitchTimerRef.current = null;
                    });
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

    // 统一常驻 ResizeObserver
    // 高度立即写入 ref（虚拟化用）；宽度用 startTransition + useDeferredValue 实现调度器级防抖：
    // 侧栏动画期间每帧调用均为低优先级，React 并发模式下自动跳过中间状态，只提交最终宽度
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                const h = entry.contentRect.height;
                containerHeightRef.current = h;

                if (!firstMeasuredRef.current) {
                    // 首次测量（初始化）：立即提交，确保布局能立刻计算
                    firstMeasuredRef.current = true;
                    setContainerWidth(w);
                } else {
                    // 后续测量：低优先级，配合 useDeferredValue 跳过动画中间帧
                    startTransition(() => setContainerWidth(w));
                }

                // 保险：应对初始 masonry containerWidth=0 的情况
                if (w > 0 && pendingFadeInRef.current) {
                    pendingFadeInRef.current = false;
                    setContainerWidth(w);
                    requestAnimationFrame(() => {
                        setIsSwitchingView(false);
                        viewSwitchTimerRef.current = null;
                    });
                }
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []); // 常驻，不随布局模式重新挂载

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

    // 滚动处理：预加载触发 + 虚拟化 scrollTop 追踪（rAF 节流）
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            // 预加载：距底部不足一屏时触发
            if (hasMoreRef.current) {
                const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (remaining < el.clientHeight) {
                    (window as Window & { __loadMoreMemes?: () => void }).__loadMoreMemes?.();
                }
            }
            // 虚拟化：rAF 节流更新 scrollTop（每帧最多一次，变化 > 50px 再 setState）
            if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null;
                    const st = el.scrollTop;
                    if (Math.abs(st - virtualScrollTopRef.current) > 50) {
                        virtualScrollTopRef.current = st;
                        setVirtualScrollTop(st);
                    }
                });
            }
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, []);

    // ─── JS 预计算瀑布流布局 ───────────────────────────────────────────────────
    // 用绝对定位代替 CSS columns，追加新内容时旧卡位置完全不变，杜绝全量重排
    const masonryLayout = useMemo(() => {
        // 使用 deferredContainerWidth：侧栏动画期间 React 自动跳过中间帧的布局计算
        if (displayedViewMode !== 'masonry' || deferredContainerWidth <= 0) return null;

        const itemSize = galleryItemSize || 200;
        const gap = galleryGap || 16;
        const columns = Math.max(1, Math.floor((deferredContainerWidth + gap) / (itemSize + gap)));
        const colHeights = new Array<number>(columns).fill(0);

        const items = memes.map((meme) => {
            // 找最短列
            let shortest = 0;
            for (let i = 1; i < columns; i++) {
                if (colHeights[i] < colHeights[shortest]) shortest = i;
            }
            const left = shortest * (itemSize + gap);
            const top = colHeights[shortest];

            // 用宽高比计算卡片高度，无需 DOM 测量
            const cardHeight =
                meme.width && meme.height
                    ? Math.round((itemSize / meme.width) * meme.height)
                    : 150;
            colHeights[shortest] += cardHeight + gap;

            return { id: meme.id, meme, top, left, height: cardHeight };
        });

        const totalHeight = Math.max(0, Math.max(...colHeights) - gap);
        const totalWidth = columns * itemSize + (columns - 1) * gap;
        return { items, totalHeight, totalWidth };
    }, [memes, deferredContainerWidth, galleryItemSize, galleryGap, displayedViewMode]);

    // ─── 虚拟化：瀑布流可见区域过滤 ───────────────────────────────────────────
    const visibleMasonryItems = useMemo(() => {
        if (!masonryLayout) return [];
        const viewH = containerHeightRef.current;
        const vTop = virtualScrollTop - VIRTUAL_OVERSCAN_PX;
        const vBottom = virtualScrollTop + viewH + VIRTUAL_OVERSCAN_PX;
        return masonryLayout.items.filter(
            (item) => item.top + item.height >= vTop && item.top <= vBottom
        );
    }, [masonryLayout, virtualScrollTop]);

    // ─── 虚拟化：网格布局（绝对定位，与瀑布流统一方式）──────────────────────
    const gridLayout = useMemo(() => {
        // 使用 deferredContainerWidth：侧栏动画期间 React 自动跳过中间帧的布局计算
        if (displayedViewMode !== 'grid' || deferredContainerWidth <= 0 || memes.length === 0) return null;

        const itemSize = galleryItemSize || 200;
        const gap = galleryGap || 16;
        const columns = Math.max(1, Math.floor((deferredContainerWidth + gap) / (itemSize + gap)));
        const rowHeight = itemSize + gap;
        const totalRows = Math.ceil(memes.length / columns);
        const totalHeight = totalRows * rowHeight - gap;
        const totalWidth = columns * itemSize + (columns - 1) * gap;

        const viewH = containerHeightRef.current;
        const vTop = virtualScrollTop - VIRTUAL_OVERSCAN_PX;
        const vBottom = virtualScrollTop + viewH + VIRTUAL_OVERSCAN_PX;
        const firstRow = Math.max(0, Math.floor(vTop / rowHeight));
        const lastRow = Math.min(totalRows - 1, Math.ceil(vBottom / rowHeight));

        const firstIndex = firstRow * columns;
        const lastIndex = Math.min((lastRow + 1) * columns, memes.length);

        const visibleItems = memes.slice(firstIndex, lastIndex).map((meme, localIdx) => {
            const globalIdx = firstIndex + localIdx;
            const col = globalIdx % columns;
            const row = Math.floor(globalIdx / columns);
            return { meme, top: row * rowHeight, left: col * (itemSize + gap) };
        });

        return { visibleItems, totalHeight, totalWidth };
    }, [memes, displayedViewMode, deferredContainerWidth, galleryItemSize, galleryGap, virtualScrollTop]);

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
                    // 是否开启布局过渡动效（切换视图或缩放时禁用）
                    const enableLayoutTransitions = !isSwitchingView && !isZoomResizing;

                    // 卡片位置过渡：GPU-composited transform，零 reflow
                    const itemTransition = enableLayoutTransitions
                        ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        : undefined;

                    // 容器尺寸过渡（高度跟随内容变化）+ opacity 切换
                    const containerTransition = [
                        isSwitchingView ? 'opacity 0.15s ease-out' : 'opacity 0.2s ease-in',
                        enableLayoutTransitions ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : null,
                    ].filter(Boolean).join(', ');

                    // ── 瀑布流：绝对定位 + 虚拟化，只渲染视口内卡片 ──
                    if (displayedViewMode === 'masonry') {
                        const itemSize = galleryItemSize || 200;
                        return (
                            <div
                                style={{
                                    position: 'relative',
                                    margin: '0 auto',
                                    width: masonryLayout ? `${masonryLayout.totalWidth}px` : '100%',
                                    height: masonryLayout ? `${masonryLayout.totalHeight + 32}px` : 'auto',
                                    visibility: containerWidth > 0 ? 'visible' : 'hidden',
                                    opacity: isSwitchingView ? 0 : 1,
                                    transition: containerTransition,
                                }}
                            >
                                {visibleMasonryItems.map(({ id, meme, top, left }) => (
                                    <div
                                        key={id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: itemSize,
                                            // transform 代替 top/left 定位：GPU 合成层，动画不触发 layout reflow
                                            transform: `translate(${left}px, ${top}px)`,
                                            transition: itemTransition,
                                        }}
                                    >
                                        {renderMemeCard(meme)}
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    // ── 网格：绝对定位 + 虚拟化，只渲染视口内行 ──
                    if (gridLayout) {
                        const itemSize = galleryItemSize || 200;
                        return (
                            <div
                                style={{
                                    position: 'relative',
                                    width: `${gridLayout.totalWidth}px`,
                                    height: `${gridLayout.totalHeight + 32}px`,
                                    opacity: isSwitchingView ? 0 : 1,
                                    transition: containerTransition,
                                }}
                            >
                                {gridLayout.visibleItems.map(({ meme, top, left }) => (
                                    <div
                                        key={meme.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: itemSize,
                                            height: itemSize,
                                            transform: `translate(${left}px, ${top}px)`,
                                            transition: itemTransition,
                                        }}
                                    >
                                        {renderMemeCard(meme)}
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    // ── 降级方案：containerWidth 尚未测量时用 CSS grid 全量渲染 ──
                    return (
                        <div
                            className="w-full pb-8 grid gap-[var(--gallery-gap)] justify-start content-start grid-cols-[repeat(auto-fill,var(--gallery-item-size,200px))]"
                            style={{
                                opacity: isSwitchingView ? 0 : 1,
                                transition: isSwitchingView ? 'opacity 0.15s ease-out' : 'opacity 0.2s ease-in',
                            }}
                        >
                            {memes.map((meme) => (
                                <div key={meme.id}>
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
