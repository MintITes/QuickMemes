import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useNotificationStore } from '../../stores/NotificationStore';

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

function MemeDetails({ meme }: { meme: Meme }) {
    const { t } = useTranslation();
    const upsertMeme = useMemeStore((state) => state.upsertMeme);
    const allTags = useTagStore((state) => state.tags);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState(meme.description || meme.ocrText || '');
    const [editingSource, setEditingSource] = useState(meme.sourceUrl || '');
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        setEditingDescription(meme.description || meme.ocrText || '');
        setEditingSource(meme.sourceUrl || '');
    }, [meme.description, meme.ocrText, meme.sourceUrl]);

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

    const persistPatch = async (patch: Partial<Pick<Meme, 'description' | 'sourceUrl'>>) => {
        try {
            const updated = await updateMemeRemote(meme.id, patch);
            upsertMeme(updated);
        } catch (error) {
            addNotification({
                type: 'error',
                title: '保存失败',
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

    const memeTags = allTags.filter((tag) => meme.tagIds.includes(tag.id));

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="aspect-square bg-black/5 dark:bg-black/20 flex items-center justify-center p-2 rounded-xl border border-borderColor overflow-hidden group relative">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={meme.name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-white/5">
                        <ImageIcon className="text-textSecondary/30" size={48} />
                    </div>
                )}
            </div>

            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <Info size={14} className="mr-2" /> {t('inspector.basic_info')}
                </h3>
                <div className="inner-container-effect p-3 space-y-2.5">
                    {[
                        { label: t('inspector.labels.name'), value: meme.name, truncate: true },
                        { label: t('inspector.labels.format'), value: meme.mimeType || '-' },
                        { label: t('inspector.labels.size'), value: formatSize(meme.fileSize) },
                        { label: t('inspector.labels.resolution'), value: `${meme.width}×${meme.height}` },
                        { label: t('inspector.labels.added'), value: formatDate(meme.createdAt) },
                        { label: t('inspector.labels.modified'), value: formatDate(meme.updatedAt) },
                    ].map((item) => (
                        <div key={item.label} className="grid grid-cols-[80px_1fr] items-baseline text-xs">
                            <span className="text-textSecondary text-[10px] font-medium">{item.label}</span>
                            <span className={clsx('font-medium break-all', item.truncate && 'truncate')} title={item.value}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <TagIcon size={14} className="mr-2" /> {t('inspector.tags')}
                </h3>
                <div className="inner-container-effect p-3">
                    <div className="flex flex-wrap gap-1.5">
                        {memeTags.length === 0 && (
                            <span className="text-[10px] text-textSecondary italic py-1 px-1">No tags yet.</span>
                        )}
                        {memeTags.map((tag) => (
                            <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-medium"
                            >
                                {tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest flex items-center">
                        <FileText size={14} className="mr-2" /> {t('inspector.ocr_text')}
                    </h3>
                    <button
                        onClick={handleCopyOcr}
                        disabled={!meme.ocrText}
                        className="p-1 px-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                        title="Copy text"
                    >
                        {copySuccess ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                </div>
                <textarea
                    className="w-full min-h-[120px] text-xs bg-bgPrimary/50 border border-borderColor rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    placeholder="No text detected or extracted..."
                    value={editingDescription}
                    onChange={(event) => setEditingDescription(event.target.value)}
                    onBlur={() => void persistPatch({ description: editingDescription })}
                />
            </section>

            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <ExternalLink size={14} className="mr-2" /> {t('inspector.source')}
                </h3>
                <div className="inner-container-effect p-3">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            placeholder="Add source URL..."
                            className="w-full text-xs bg-bgPrimary/50 border border-borderColor rounded-lg pl-3 pr-9 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
                            value={editingSource}
                            onChange={(event) => setEditingSource(event.target.value)}
                            onBlur={() => void persistPatch({ sourceUrl: editingSource })}
                        />
                        {meme.sourceUrl && (
                            <a
                                href={meme.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute right-2.5 p-1 text-accent hover:bg-accent/10 rounded-md transition-colors"
                                title="Open link"
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

function BatchActions({ selectedIds }: { selectedIds: number[] }) {
    const { t } = useTranslation();

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center relative overflow-hidden">
                    <ImageIcon size={32} className="text-accent/60" />
                    <div className="absolute top-0 right-0 w-6 h-6 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-bl-xl border-l border-b border-accent">
                        {selectedIds.length}
                    </div>
                </div>
                <div>
                    <h4 className="font-bold text-base leading-tight">{t('inspector.batch.editing')}</h4>
                    <p className="text-[11px] text-textSecondary mt-1">{t('inspector.batch.selected_desc', { count: selectedIds.length })}</p>
                </div>
            </div>

            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <Check size={14} className="mr-2" /> {t('inspector.batch.operations')}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-bgPrimary hover:bg-black/5 dark:hover:bg-white/5 border border-borderColor text-xs font-semibold transition-all">
                        <Download size={14} /> {t('inspector.batch.export')}
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-all">
                        <Trash2 size={14} /> {t('inspector.batch.delete')}
                    </button>
                </div>
            </section>
        </div>
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
            transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex-shrink-0 h-full surface-effect flex flex-col overflow-hidden relative border-l border-borderColor shadow-2xl z-20"
        >
            <div
                className={clsx(
                    'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-30 transition-colors',
                    isResizing ? 'bg-accent' : 'hover:bg-accent/40'
                )}
                onMouseDown={startResizing}
            />

            <div className="flex items-center justify-between p-4 border-b border-borderColor bg-bgPrimary/30 shrink-0">
                <h2 className="text-sm font-bold truncate">
                    {selectedMemeIds.length > 1 ? t('inspector.batch_title', { count: selectedMemeIds.length }) : t('inspector.title')}
                </h2>
                <button
                    onClick={() => togglePanel(false)}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {selectedMemeIds.length === 0 && (
                    <div className="h-full flex items-center justify-center p-8">
                        <EmptyState
                            icon={<MousePointer2 size={40} className="opacity-20" />}
                            title={t('inspector.no_selection')}
                            description={t('inspector.no_selection_desc')}
                            className="scale-90"
                        />
                    </div>
                )}
                {currentMeme && <MemeDetails key={currentMeme.id} meme={currentMeme} />}
                {selectedMemes.length > 1 && <BatchActions selectedIds={selectedMemeIds} />}
            </div>
        </motion.aside>
    );
}
