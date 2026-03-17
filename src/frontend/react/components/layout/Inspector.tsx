import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useTagStore } from '../../stores/TagStore';
import {
    Info,
    Tag as TagIcon,
    FileText,
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

function DetailCard({ children, title, icon: Icon, action }: { children: React.ReactNode, title: string, icon: any, action?: React.ReactNode }) {
    return (
        <motion.section variants={itemVariants} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1.5">
                <h3 className="text-[11px] font-bold text-textSecondary/70 tracking-[0.08em] flex items-center">
                    <Icon size={13} className="mr-2 opacity-70" /> {title}
                </h3>
                {action}
            </div>
            <div className="inner-container-effect rounded-2xl p-4 bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5 shadow-sm">
                {children}
            </div>
        </motion.section>
    );
}

function MemeDetails({ meme }: { meme: Meme }) {
    const { t } = useTranslation();
    const upsertMeme = useMemeStore((state) => state.upsertMeme);
    const allTags = useTagStore((state) => state.tags);
    const setTags = useTagStore((state) => state.setTags);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [lastMemeId, setLastMemeId] = useState<number | null>(null);
    const [editingDescription, setEditingDescription] = useState(meme.description || meme.ocrText || '');
    const [editingSource, setEditingSource] = useState(meme.sourceUrl || '');
    const [copySuccess, setCopySuccess] = useState(false);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const tagInputRef = useRef<HTMLInputElement>(null);

    if (meme.id !== lastMemeId) {
        setLastMemeId(meme.id);
        setEditingDescription(meme.description || meme.ocrText || '');
        setEditingSource(meme.sourceUrl || '');
        setPreviewUrl(null);
    }

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

    const persistPatch = async (patch: Partial<Pick<Meme, 'description' | 'sourceUrl'>>) => {
        try {
            const updated = await updateMemeRemote(meme.id, patch);
            upsertMeme(updated);
        } catch (error) {
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

    const submitNewTag = async () => {
        const name = newTagName.trim();
        if (!name) {
            setIsAddingTag(false);
            return;
        }

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
                <div className="w-full min-h-[180px] max-h-[320px] bg-black/[0.03] dark:bg-white/[0.03] flex items-center justify-center p-4 rounded-2xl border border-borderColor/30 overflow-hidden relative group/preview shadow-sm">
                    {previewUrl ? (
                        <div className="relative z-0 w-full flex items-center justify-center">
                            <img
                                src={previewUrl}
                                alt={meme.name}
                                className="max-w-full max-h-[280px] object-contain rounded-xl shadow-lg dark:shadow-black/30 transition-transform duration-300 group-hover/preview:scale-[1.01]"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-textSecondary/20">
                            <ImageIcon size={40} strokeWidth={1} />
                            <span className="text-[10px] font-semibold tracking-wide">{t('inspector.loading_asset')}</span>
                        </div>
                    )}

                    {/* Floating Quick Actions */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={handleCopyFullImage}
                            className="p-2.5 bg-white/92 dark:bg-black/60 text-textPrimary rounded-xl shadow-md hover:bg-accent hover:text-white active:scale-95 transition-all border border-black/5 dark:border-white/10 backdrop-blur-md"
                            title="Copy Image"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Info Section */}
            <DetailCard title={t('inspector.basic_info')} icon={Info}>
                <div className="space-y-3">
                    {[
                        { label: t('inspector.labels.name'), value: meme.name, truncate: true, highlight: true },
                        { label: t('inspector.labels.format'), value: (meme.mimeType || '-').split('/').pop()?.toUpperCase() },
                        { label: t('inspector.labels.size'), value: formatSize(meme.fileSize) },
                        { label: t('inspector.labels.resolution'), value: `${meme.width} × ${meme.height}` },
                        { label: t('inspector.labels.added'), value: formatDate(meme.createdAt) },
                    ].map((item) => (
                        <div key={item.label} className="grid grid-cols-[84px_1fr] items-baseline gap-3 text-[12px]">
                            <span className="text-textSecondary/50 font-medium text-[11px] shrink-0">{item.label}</span>
                            <span className={clsx(
                                'font-semibold break-all text-right leading-5',
                                item.truncate && 'truncate',
                                item.highlight ? 'text-accent' : 'text-textPrimary/80'
                            )} title={item.value}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </DetailCard>

            {/* Tags Section */}
            <DetailCard
                title={t('inspector.tags')}
                icon={TagIcon}
                action={
                    isAddingTag ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                            <input
                                ref={tagInputRef}
                                type="text"
                                className="h-6 px-2 text-[11px] font-bold bg-accent/5 dark:bg-accent/10 border border-accent/20 text-accent rounded-md outline-none w-20 focus:w-28 focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-accent/30"
                                placeholder={t('common.add') + '...'}
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onBlur={submitNewTag}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void submitNewTag();
                                    if (e.key === 'Escape') {
                                        setIsAddingTag(false);
                                        setNewTagName('');
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingTag(true)}
                            className="px-2 py-1 rounded-lg text-accent hover:bg-accent/10 active:scale-95 transition-all flex items-center gap-1.5 group"
                            title={t('inspector.add_tag')}
                        >
                            <TagIcon size={12} className="group-hover:rotate-12 transition-transform" />
                            <span className="text-[10px] font-bold tracking-wide">{t('common.add')}</span>
                        </button>
                    )
                }
            >
                <div className="flex flex-wrap gap-2">
                    {memeTags.length === 0 && (
                        <span className="text-[12px] text-textSecondary/35 italic py-1">{t('inspector.no_tags')}</span>
                    )}
                    {memeTags.map((tag) => (
                        <motion.span
                            key={tag.id}
                            variants={{
                                initial: { scale: 0.9, opacity: 0 },
                                visible: { scale: 1, opacity: 1 },
                                hover: { scale: 1.05 }
                            }}
                            initial="initial"
                            animate="visible"
                            whileHover="hover"
                            className="relative overflow-hidden inline-flex items-center rounded-xl bg-accent/[0.08] dark:bg-accent/20 text-accent text-[12px] font-semibold cursor-default group/tag h-8 px-3 border border-accent/10 hover:border-accent/25 transition-colors"
                        >
                            <span className="opacity-45 mr-1.5 text-[10px]">#</span>
                            {tag.name}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRemoveTag(tag.id);
                                }}
                                className="ml-2 p-0.5 rounded-full hover:bg-accent/20 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                            >
                                <X size={10} strokeWidth={3} />
                            </button>
                        </motion.span>
                    ))}
                </div>
            </DetailCard>

            {/* OCR/Description Section */}
            <DetailCard
                title={t('inspector.ocr_text')}
                icon={FileText}
                action={
                    <button
                        onClick={handleCopyOcr}
                        disabled={!meme.ocrText}
                        className="p-1 px-1.5 hover:bg-accent/10 dark:hover:bg-accent/20 rounded-md transition-colors disabled:opacity-20 text-accent"
                        title="Copy text"
                    >
                        {copySuccess ? <Check size={14} className="text-green-500" /> : <Copy size={13} />}
                    </button>
                }
            >
                <textarea
                    className="w-full min-h-[128px] text-[13px] leading-6 bg-transparent border-none p-0 focus:outline-none focus:ring-0 resize-none placeholder:text-textSecondary/20 scrollbar-hide"
                    placeholder={t('inspector.ocr_placeholder') || ''}
                    value={editingDescription}
                    onChange={(event) => setEditingDescription(event.target.value)}
                    onBlur={() => void persistPatch({ description: editingDescription })}
                />
            </DetailCard>

            {/* Source Section */}
            <DetailCard title={t('inspector.source')} icon={ExternalLink}>
                <div className="relative group/input">
                    <input
                        type="text"
                        placeholder={t('inspector.source_placeholder') || ''}
                        className="w-full text-[12px] bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl pl-3.5 pr-10 py-3 focus:bg-white dark:focus:bg-black/40 focus:border-accent/30 focus:shadow-sm transition-all outline-none"
                        value={editingSource}
                        onChange={(event) => setEditingSource(event.target.value)}
                        onBlur={() => void persistPatch({ sourceUrl: editingSource })}
                    />
                    {meme.sourceUrl && (
                        <button
                            onClick={() => window.electronAPI.openExternal(meme.sourceUrl)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-textSecondary/40 hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title="Open in Browser"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                </div>
            </DetailCard>
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

            <DetailCard title={t('inspector.batch.operations')} icon={Check}>
                <div className="grid grid-cols-1 gap-2.5">
                    <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] hover:bg-accent hover:text-white border border-transparent transition-all group/btn shadow-sm active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                            <Download size={16} className="opacity-40 group-hover/btn:opacity-100 transition-opacity" />
                            <span className="text-xs font-bold">{t('inspector.batch.export')}</span>
                        </div>
                        <Check size={14} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    </button>

                    <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-red-500/[0.04] dark:bg-red-500/[0.08] hover:bg-red-500 border border-transparent text-red-600 dark:text-red-400 hover:text-white transition-all group/btn shadow-sm active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                            <Trash2 size={16} className="opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                            <span className="text-xs font-bold">{t('inspector.batch.delete')}</span>
                        </div>
                        <X size={14} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                </div>
            </DetailCard>

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
            className="flex-shrink-0 h-full surface-effect flex flex-col overflow-hidden relative border-l border-borderColor z-20 shadow-lg"
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
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] truncate text-textSecondary">
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

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-b from-transparent to-black/[0.015] dark:to-white/[0.015]">
                {selectedMemeIds.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-full flex items-center justify-center p-8"
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
