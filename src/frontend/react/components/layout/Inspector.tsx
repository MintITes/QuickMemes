import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useTagStore } from '../../stores/TagStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import {
    Image as ImageIcon,
    X,
    Copy,
    ExternalLink,
    Check,
    Trash2,
    Download,
    MousePointer2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Meme } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { getFileUrl, revokeAssetUrl } from '../../services/assetService';
import { updateMeme as updateMemeRemote } from '../../services/memeService';
import { addTagToMeme, createTag, fetchTags, removeTagFromMeme } from '../../services/tagService';
import { useNotificationStore } from '../../stores/NotificationStore';
import { HttpError } from '../../api/httpClient';

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ` ${sizes[i]}`;
};

const formatDate = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
} as const;

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring" as const,
            stiffness: 300,
            damping: 30
        }
    }
} as const;


function MemeDetails({ meme }: { meme: Meme }) {
    const { t } = useTranslation();
    const upsertMeme = useMemeStore((state) => state.upsertMeme);
    const updateMemeInStore = useMemeStore((state) => state.updateMeme);
    const allTags = useTagStore((state) => state.tags);
    const setTags = useTagStore((state) => state.setTags);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [lastMemeId, setLastMemeId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState(meme.name || '');
    const [editingDescription, setEditingDescription] = useState(meme.description || meme.ocrText || '');
    const [editingSource, setEditingSource] = useState(meme.sourceUrl || '');
    const [copySuccess, setCopySuccess] = useState(false);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const categories = useCategoryStore((state) => state.categories);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const isSubmittingTagRef = useRef(false);
    const skipTagBlurRef = useRef(false);

    useEffect(() => {
        if (meme.id !== lastMemeId) {
            setLastMemeId(meme.id);
            setPreviewUrl(null);
        }
        setEditingName(meme.name || '');
        setEditingDescription(meme.description || meme.ocrText || '');
        setEditingSource(meme.sourceUrl || '');
    }, [lastMemeId, meme.description, meme.id, meme.name, meme.ocrText, meme.sourceUrl]);

    useEffect(() => {
        let cancelled = false;
        void getFileUrl(meme.id).then((url) => {
            if (!cancelled) {
                setPreviewUrl(url);
            }
        }).catch(() => {
            if (!cancelled) {
                setPreviewUrl(null);
            }
        });

        return () => {
            cancelled = true;
            revokeAssetUrl(`file:${meme.id}`);
        };
    }, [meme.id]);

    useEffect(() => {
        if (isAddingTag) {
            tagInputRef.current?.focus();
        }
    }, [isAddingTag]);

    const persistPatch = async (patch: Partial<Pick<Meme, 'name' | 'description' | 'sourceUrl'>>) => {
        updateMemeInStore(meme.id, patch);
        try {
            const updated = await updateMemeRemote(meme.id, patch);
            upsertMeme(updated);
        } catch (error) {
            upsertMeme(meme);
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const handleCopyOcr = async () => {
        if (!meme.ocrText) {
            return;
        }
        await navigator.clipboard.writeText(meme.ocrText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 1_500);
    };

    const handleCopyFullImage = async () => {
        try {
            await window.electronAPI.writeClipboardImageFromMeme(meme.id);
            addNotification({
                type: 'success',
                title: t('gallery.item.copy_success'),
                description: meme.name,
            });
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.copy_failed'),
                description: String(error),
            });
        }
    };

    const submitNewTag = async (rawName = newTagName) => {
        const name = rawName.trim();
        if (!name) {
            setIsAddingTag(false);
            setNewTagName('');
            return;
        }

        if (isSubmittingTagRef.current) {
            return;
        }

        isSubmittingTagRef.current = true;

        try {
            let tag = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (!tag) {
                try {
                    tag = await createTag(name);
                } catch (error) {
                    if (error instanceof HttpError && error.status === 409) {
                        const tags = await fetchTags();
                        setTags(tags);
                        tag = tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
                    } else {
                        throw error;
                    }
                }
            }

            if (!tag) {
                throw new Error('标签已存在，但未能读取到已有标签。');
            }

            if (!meme.tagIds.includes(tag.id)) {
                await addTagToMeme(meme.id, tag.id);
                upsertMeme({
                    ...meme,
                    tagIds: [...meme.tagIds, tag.id],
                    tags: meme.tags.some((entry) => entry.id === tag.id) ? meme.tags : [...meme.tags, tag],
                });
            }
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            isSubmittingTagRef.current = false;
            setIsAddingTag(false);
            setNewTagName('');
        }
    };

    const handleRemoveTag = async (tagId: number) => {
        try {
            await removeTagFromMeme(meme.id, tagId);
            upsertMeme({
                ...meme,
                tagIds: meme.tagIds.filter(id => id !== tagId),
                tags: meme.tags.filter(t => t.id !== tagId),
            });
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const memeTags = allTags.length > 0
        ? allTags.filter((tag) => meme.tagIds.includes(tag.id))
        : meme.tags;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-5 flex flex-col gap-5"
        >
            {/* Preview Section */}
            <motion.div variants={itemVariants} className="relative group">
                <div className="w-full bg-black/5 dark:bg-white/5 flex items-center justify-center rounded-xl overflow-hidden relative group/preview">
                    {previewUrl ? (
                        <div className="relative w-full pt-[100%]">
                            <img
                                src={previewUrl}
                                alt={meme.name}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Format Badge */}
                            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                                {(meme.mimeType || '-').split('/').pop()}
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-full pt-[100%]">
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-textSecondary/20">
                                <ImageIcon size={40} strokeWidth={1} />
                                <span className="text-[10px] font-semibold tracking-wide mt-2">{t('inspector.loading_asset')}</span>
                            </div>
                        </div>
                    )}

                    {/* Floating Quick Actions */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={handleCopyFullImage}
                            className="p-2 bg-black/50 text-white rounded-lg shadow-md hover:bg-white hover:text-black active:scale-95 transition-all backdrop-blur-md"
                            title="Copy Image"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                </div>


            </motion.div>

            {/* Editable Title */}
            <motion.div variants={itemVariants} className="px-1">
                <input
                    type="text"
                    className="w-full text-[18px] font-bold bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-textPrimary placeholder:text-textSecondary/30 truncate"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                        if (editingName !== meme.name) {
                            void persistPatch({ name: editingName });
                        }
                    }}
                    placeholder={t('inspector.labels.name')}
                />
            </motion.div>

            {/* OCR/Description Section - Flat style */}
            <motion.div variants={itemVariants} className="relative group/desc">
                <textarea
                    className="w-full min-h-[140px] text-[13px] leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3.5 focus:bg-white dark:focus:bg-black/20 focus:border-accent/30 focus:shadow-sm transition-all focus:outline-none resize-none placeholder:text-textSecondary/30 text-textPrimary/90"
                    placeholder={t('inspector.ocr_placeholder') || 'Enter description or prompt...'}
                    value={editingDescription}
                    onChange={(event) => setEditingDescription(event.target.value)}
                    onBlur={() => void persistPatch({ description: editingDescription })}
                />
                <button
                    onClick={handleCopyOcr}
                    disabled={!meme.ocrText}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-black/80 rounded-md shadow-sm border border-black/5 dark:border-white/10 opacity-0 group-hover/desc:opacity-100 transition-opacity disabled:opacity-0 text-textSecondary hover:text-accent backdrop-blur-md"
                    title="Copy text"
                >
                    {copySuccess ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
            </motion.div>

            {/* Source URL - Standalone input */}
            <motion.div variants={itemVariants} className="relative group/input">
                <input
                    type="text"
                    placeholder={t('inspector.source_placeholder') || 'https://...'}
                    className="w-full text-[12px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl pl-3.5 pr-9 py-2.5 focus:bg-white dark:focus:bg-black/20 focus:border-accent/30 focus:shadow-sm transition-all outline-none text-textSecondary"
                    value={editingSource}
                    onChange={(event) => setEditingSource(event.target.value)}
                    onBlur={() => void persistPatch({ sourceUrl: editingSource })}
                />
                {meme.sourceUrl && (
                    <button
                        onClick={() => window.electronAPI.openExternal(meme.sourceUrl)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-textSecondary/40 hover:text-accent hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-all"
                        title="Open in Browser"
                    >
                        <ExternalLink size={13} />
                    </button>
                )}
            </motion.div>

            {/* Tags Section */}
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
                <h3 className="text-[12px] font-bold text-textPrimary/80 px-1 mb-1">{t('inspector.tags')}</h3>
                <div className="flex flex-wrap gap-1.5 px-1">
                    {memeTags.map((tag) => (
                        <span
                            key={tag.id}
                            className="group/tag inline-flex items-center h-7 px-2.5 rounded-md bg-transparent border border-black/10 dark:border-white/10 text-[11px] text-textSecondary whitespace-nowrap transition-colors hover:border-black/20 dark:hover:border-white/20"
                        >
                            {tag.name}
                            <button
                                onClick={() => void handleRemoveTag(tag.id)}
                                className="ml-1.5 -mr-1 p-0.5 text-textSecondary/40 hover:text-red-500 transition-colors"
                            >
                                <X size={10} strokeWidth={2.5} />
                            </button>
                        </span>
                    ))}

                    {isAddingTag ? (
                        <input
                            ref={tagInputRef}
                            type="text"
                            className="h-7 px-2.5 text-[11px] bg-transparent border border-accent/40 text-accent rounded-md outline-none w-24 focus:w-32 focus:border-accent transition-all placeholder:text-accent/30"
                            placeholder="New tag..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onBlur={(e) => {
                                if (skipTagBlurRef.current) {
                                    skipTagBlurRef.current = false;
                                    return;
                                }
                                void submitNewTag(e.currentTarget.value);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    skipTagBlurRef.current = true;
                                    void submitNewTag(e.currentTarget.value);
                                }
                                if (e.key === 'Escape') {
                                    setIsAddingTag(false);
                                    setNewTagName('');
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <button
                            onClick={() => setIsAddingTag(true)}
                            className="h-7 px-2.5 flex items-center justify-center rounded-md border border-dashed border-black/15 dark:border-white/15 text-textSecondary/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-textSecondary hover:border-solid hover:border-black/20 dark:hover:border-white/20 transition-all font-mono"
                            title={t('inspector.add_tag')}
                        >
                            +
                        </button>
                    )}
                </div>
            </motion.div>

            <div className="my-2 border-t border-black/5 dark:border-white/5" />

            {/* Basic Info Footer */}
            <motion.div variants={itemVariants} className="px-1 mb-4">
                <h3 className="text-[12px] font-bold text-textPrimary/80 mb-2">基本信息</h3>
                <div className="grid grid-cols-[60px_1fr] gap-y-1.5 text-[11px]">
                    <span className="text-textSecondary/50 font-medium">尺寸</span>
                    <span className="text-textSecondary">{meme.width} × {meme.height}</span>

                    <span className="text-textSecondary/50 font-medium">大小</span>
                    <span className="text-textSecondary">{formatSize(meme.fileSize)}</span>

                    <span className="text-textSecondary/50 font-medium">分类</span>
                    <span className="text-textSecondary">{categories.find(c => c.id === meme.categoryId)?.name || t('sidebar.untagged')}</span>

                    <span className="text-textSecondary/50 font-medium">添加日期</span>
                    <span className="text-textSecondary">{formatDate(meme.createdAt)}</span>
                </div>
            </motion.div>
        </motion.div>
    );
}

function BatchActions({ selectedIds }: { selectedIds: number[] }) {
    const { t } = useTranslation();

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-5 flex flex-col gap-5"
        >
            <motion.div variants={itemVariants} className="inner-container-effect rounded-2xl p-6 bg-accent/[0.03] border-accent/10 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-accent/[0.08] flex items-center justify-center border border-accent/20 shadow-sm">
                        <ImageIcon size={30} className="text-accent/60" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-accent text-white text-[11px] font-black flex items-center justify-center rounded-xl shadow-lg border-2 border-white dark:border-[#1e1e1e]">
                        {selectedIds.length}
                    </div>
                </div>
                <div className="relative z-10">
                    <h4 className="font-bold text-lg tracking-tight text-textPrimary/90">{t('inspector.batch.editing')}</h4>
                    <p className="text-[11px] text-textSecondary/45 mt-1">
                        {t('inspector.batch.selected_desc', { count: selectedIds.length })}
                    </p>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-col gap-2 mt-2">
                <h3 className="text-[12px] font-bold text-textPrimary/80 px-1 mb-1">{t('inspector.batch.operations')}</h3>
                <div className="grid grid-cols-1 gap-2">
                    <button className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 transition-all group/btn">
                        <div className="flex items-center gap-3">
                            <Download size={14} className="text-textSecondary/60" />
                            <span className="text-[12px] font-semibold text-textPrimary/90">{t('inspector.batch.export')}</span>
                        </div>
                    </button>

                    <button className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-red-500/[0.02] dark:bg-red-500/[0.04] hover:bg-red-500/10 border border-red-500/10 text-red-600 dark:text-red-400 transition-all group/btn">
                        <div className="flex items-center gap-3">
                            <Trash2 size={14} className="opacity-80" />
                            <span className="text-[12px] font-semibold">{t('inspector.batch.delete')}</span>
                        </div>
                    </button>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="px-1 text-[10px] text-textSecondary/30 text-center tracking-wide leading-relaxed">
                {t('inspector.batch.bulk_footer', { count: selectedIds.length })}
            </motion.div>
        </motion.div>
    );
}

export function Inspector() {
    const { t } = useTranslation();
    const { selectedMemeIds, togglePanel, inspectorWidth, setInspectorWidth } = useUiStore();
    const memes = useMemeStore((state) => state.memes);
    const [isResizing, setIsResizing] = useState(false);

    const selectedMemes = useMemo(() => memes.filter((meme) => selectedMemeIds.includes(meme.id)), [memes, selectedMemeIds]);
    const currentMeme = selectedMemes.length === 1 ? selectedMemes[0] : null;

    const stopResizing = useCallback(() => setIsResizing(false), []);
    const resize = useCallback((event: MouseEvent) => {
        if (!isResizing) {
            return;
        }
        const newWidth = window.innerWidth - event.clientX;
        if (newWidth > 240 && newWidth < 600) {
            setInspectorWidth(newWidth);
        }
    }, [isResizing, setInspectorWidth]);

    const startResizing = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: inspectorWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={isResizing ? { duration: 0 } : { duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="flex-shrink-0 h-full surface-effect gpu-transform flex flex-col overflow-hidden relative border-l border-borderColor z-20 shadow-lg"
        >
            <div
                className={clsx(
                    'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-30 transition-colors',
                    isResizing ? 'bg-accent' : 'hover:bg-accent/40'
                )}
                onMouseDown={startResizing}
            />

            <div className="flex items-center justify-between px-4 h-14 border-b border-borderColor bg-black/[0.015] dark:bg-white/[0.015] shrink-0 z-10">
                <div className="flex items-center gap-3 overflow-hidden ml-1">
                    <div className={clsx(
                        "w-1.5 h-1.5 rounded-full transition-all duration-500",
                        selectedMemeIds.length > 0 ? "bg-accent shadow-[0_0_8px_var(--accent-color)] scale-110" : "bg-textSecondary/20 scale-100"
                    )} />
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] truncate text-textPrimary/90">
                        {selectedMemeIds.length > 1 ? t('inspector.batch_title', { count: selectedMemeIds.length }) : t('inspector.title')}
                    </h2>
                </div>
                <button
                    onClick={() => togglePanel(false)}
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 group transition-all"
                >
                    <X size={16} className="opacity-40 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-300" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-b from-transparent to-black/[0.015] dark:to-white/[0.015] gpu-layer">
                {selectedMemeIds.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-full flex items-center justify-center p-8 gpu-transform-opacity"
                    >
                        <EmptyState
                            icon={<MousePointer2 size={48} strokeWidth={1.5} className="text-accent/20" />}
                            title={t('inspector.no_selection')}
                            description={t('inspector.no_selection_desc')}
                            className="scale-90"
                        />
                    </motion.div>
                )}
                {currentMeme && <MemeDetails key={currentMeme.id} meme={currentMeme} />}
                {selectedMemes.length > 1 && <BatchActions selectedIds={selectedMemeIds} />}
            </div>
        </motion.aside>
    );
}
