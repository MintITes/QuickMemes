import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight,
    Clipboard, Download, Tags as TagsIcon, Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useTagStore } from '../../stores/TagStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { getFileUrl, revokeAssetUrl } from '../../services/assetService';
import clsx from 'clsx';
import { Portal } from '../common/Portal';

export function Lightbox() {
    const { t } = useTranslation();
    const lightboxMemeId = useUiStore(state => state.lightboxMemeId);
    const setLightboxMemeId = useUiStore(state => state.setLightboxMemeId);
    const memes = useMemeStore(state => state.memes);
    const tags = useTagStore(state => state.tags);
    const addNotification = useNotificationStore(state => state.addNotification);
    const selectMeme = useUiStore(state => state.selectMeme);
    const togglePanel = useUiStore(state => state.togglePanel);

    const [src, setSrc] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const currentIndex = memes.findIndex(m => m.id === lightboxMemeId);
    const meme = memes[currentIndex];
    const memeTags = meme ? tags.filter((entry) => meme.tagIds.includes(entry.id)) : [];

    // URL Management
    useEffect(() => {
        if (!meme) {
            setSrc(null);
            return;
        }
        setIsImageLoaded(false);

        let cancelled = false;
        // Fetch full res image for lightbox
        void getFileUrl(meme.id).then((nextUrl: string | null) => {
            if (!cancelled) setSrc(nextUrl);
        });

        return () => {
            cancelled = true;
            if (meme) revokeAssetUrl(meme.id.toString());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meme?.id]);

    // Reset zoom/pan on image change
    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [meme?.id]);

    const close = useCallback(() => {
        setLightboxMemeId(null);
    }, [setLightboxMemeId]);

    const goNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < memes.length - 1) {
            setLightboxMemeId(memes[currentIndex + 1].id);
        }
    }, [currentIndex, memes, setLightboxMemeId]);

    const goPrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setLightboxMemeId(memes[currentIndex - 1].id);
        }
    }, [currentIndex, memes, setLightboxMemeId]);

    const handleZoomIn = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setScale(prev => Math.min(prev * 1.25, 5));
    };

    const handleZoomOut = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setScale(prev => Math.max(prev / 1.25, 0.5));
    };

    const handleResetZoom = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleWheel = useCallback((e: WheelEvent) => {
        if (!meme) return;
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setScale(prev => {
                const newScale = Math.max(0.5, Math.min(prev * delta, 5));
                return newScale;
            });
        } else {
            // Pan
            setPosition(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    }, [meme]);

    // Actions
    const handleCopy = useCallback(async () => {
        if (!meme) return;
        try {
            await window.electronAPI.writeClipboardImageFromMeme(meme.id);
            addNotification({
                type: 'success',
                title: t('gallery.item.copy_success'),
                description: meme.name,
            });
        } catch {
            addNotification({ type: 'error', title: t('common.copy_failed') });
        }
    }, [meme, addNotification, t]);

    const handleExport = useCallback(async () => {
        if (!meme) return;
        addNotification({ type: 'info', title: t('common.not_implemented') || 'Not implemented yet' });
    }, [meme, addNotification, t]);

    const handleEditTags = useCallback(() => {
        if (!meme) return;
        selectMeme(meme.id, false);
        togglePanel(true);
        close();
    }, [meme, selectMeme, togglePanel, close]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!lightboxMemeId) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === '=' || e.key === '+') handleZoomIn();
            else if (e.key === '-') handleZoomOut();
            else if (e.key === '0') handleResetZoom();
            else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                handleCopy();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [lightboxMemeId, close, goNext, goPrev, handleWheel, handleCopy]);

    // Drag to pan
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click pan
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
        };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: dragStartRef.current.posX + (e.clientX - dragStartRef.current.x),
            y: dragStartRef.current.posY + (e.clientY - dragStartRef.current.y)
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (!lightboxMemeId || !meme) return null;

    return (
        <Portal>
            <AnimatePresence>
                <div
                    ref={containerRef}
                    className="fixed inset-0 z-[2000] flex flex-col items-center justify-center outline-none select-none"
                    tabIndex={-1}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Background Layer: Adaptive Tint */}
                    <div className="absolute inset-0 overflow-hidden bg-black/90 cursor-default" onClick={close}>
                        {src && (
                            <img
                                src={src}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover blur-[100px] opacity-40 scale-110 saturate-150 brightness-75 pointer-events-none"
                            />
                        )}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none" />
                    </div>

                    {/* Top Bar */}
                    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/60 to-transparent flex items-start justify-between px-6 py-4 pointer-events-none z-10">
                        <div className="text-white/90 drop-shadow-md pointer-events-auto">
                            <h2 className="text-lg font-medium">{meme.name}</h2>
                            {meme.width && meme.height && (
                                <p className="text-xs text-white/60">{meme.width} × {meme.height}</p>
                            )}
                        </div>
                        <button
                            onClick={close}
                            className="pointer-events-auto p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation */}
                    {currentIndex > 0 && (
                        <button
                            className="absolute left-6 p-3 rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur-md transition-all z-10 ring-1 ring-white/10 outline-none focus-visible:ring-white pointer-events-auto"
                            onClick={goPrev}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    {currentIndex < memes.length - 1 && (
                        <button
                            className="absolute right-6 p-3 rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur-md transition-all z-10 ring-1 ring-white/10 outline-none focus-visible:ring-white pointer-events-auto"
                            onClick={goNext}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    {/* Image Area */}
                    <div
                        className={clsx(
                            "relative flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing",
                            isDragging && "cursor-grabbing"
                        )}
                        onMouseDown={handleMouseDown}
                    >
                        {src && (
                            <motion.img
                                src={src}
                                alt={meme.name}
                                draggable={false}
                                onLoad={() => setIsImageLoaded(true)}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{
                                    opacity: isImageLoaded ? 1 : 0,
                                    scale: isImageLoaded ? scale : 0.95,
                                    x: position.x,
                                    y: position.y
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.5 }}
                                className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
                            />
                        )}
                    </div>

                    {/* Bottom Toolbar Area */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-8 py-6 flex flex-col items-center pointer-events-none z-10">

                        {/* Tags */}
                        <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-3xl pointer-events-auto">
                            {memeTags.map(t => (
                                <span key={t.id} className="px-3 py-1 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md rounded-lg text-sm text-white border border-white/10 shadow-sm cursor-pointer">
                                    #{t.name}
                                </span>
                            ))}
                            <button
                                onClick={handleEditTags}
                                className="px-3 py-1 bg-accent/80 hover:bg-accent transition-colors backdrop-blur-md rounded-lg text-sm text-white shadow-sm flex items-center gap-1 border border-white/20"
                            >
                                <Plus size={14} /> 添加标签
                            </button>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl pointer-events-auto">
                            <div className="flex items-center gap-1 px-2 border-r border-white/10">
                                <button onClick={handleZoomOut} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white" title="缩小 (-)"><ZoomOut size={18} /></button>
                                <button onClick={handleResetZoom} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white" title="还原 (0)"><Maximize size={18} /></button>
                                <button onClick={handleZoomIn} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white" title="放大 (+)"><ZoomIn size={18} /></button>
                            </div>
                            <div className="flex items-center gap-1 px-2 border-r border-white/10">
                                <button onClick={handleCopy} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white flex items-center gap-2" title="复制 (Ctrl+C)"><Clipboard size={18} /><span className="text-sm">复制</span></button>
                                <button onClick={handleExport} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white flex items-center gap-2" title="导出"><Download size={18} /><span className="text-sm">导出</span></button>
                            </div>
                            <div className="flex items-center gap-1 px-2">
                                <button onClick={handleEditTags} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white flex items-center gap-2" title="编辑详情"><TagsIcon size={18} /><span className="text-sm">编辑</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </AnimatePresence>
        </Portal>
    );
}
