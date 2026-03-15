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
    Hash,
    MousePointer2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Meme } from '../../types';
import { EmptyState } from '../common/EmptyState';

// Helper: format bytes
const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper: format date
const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

function MemeDetails({ meme }: { meme: Meme }) {
    const { t } = useTranslation();
    const { updateMeme } = useMemeStore();
    const { tags: allTags } = useTagStore();

    const [editingOcr, setEditingOcr] = useState<string | null>(null);
    const [editingSource, setEditingSource] = useState<string>(meme.sourceUrl || '');
    const [tagInput, setTagInput] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyOcr = () => {
        if (meme.ocrText) {
            navigator.clipboard.writeText(meme.ocrText);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const handleUpdateOcr = () => {
        if (editingOcr !== null) {
            updateMeme(meme.id, { ocrText: editingOcr });
            setEditingOcr(null);
        }
    };

    const handleUpdateSource = () => {
        updateMeme(meme.id, { sourceUrl: editingSource });
    };

    const handleRemoveTag = (tagId: number) => {
        updateMeme(meme.id, {
            tagIds: meme.tagIds.filter(id => id !== tagId)
        });
    };

    const handleAddTag = (tagName: string) => {
        if (!tagName.trim()) return;
        const existingTag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (existingTag && !meme.tagIds.includes(existingTag.id)) {
            updateMeme(meme.id, {
                tagIds: [...meme.tagIds, existingTag.id]
            });
        }
        setTagInput('');
    };

    return (
        <div className="p-4 flex flex-col gap-6">
            {/* Preview Image Area */}
            <div className="aspect-square bg-black/5 dark:bg-black/20 flex items-center justify-center p-2 rounded-xl border border-borderColor overflow-hidden group relative">
                <img
                    src={`file://${meme.filePath}`}
                    alt={meme.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const nextElement = (e.target as HTMLImageElement).nextElementSibling;
                        if (nextElement) (nextElement as HTMLElement).style.display = 'flex';
                    }}
                />
                <div className="hidden absolute inset-0 items-center justify-center bg-black/5 dark:bg-white/5">
                    <ImageIcon className="text-textSecondary/30" size={48} />
                </div>
            </div>

            {/* A. Basic Information */}
            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <Info size={14} className="mr-2" /> {t('inspector.basic_info')}
                </h3>
                <div className="inner-container-effect p-3 space-y-2.5">
                    {[
                        { label: t('inspector.labels.name'), value: meme.name, truncate: true },
                        { label: t('inspector.labels.format'), value: meme.format.toUpperCase() },
                        { label: t('inspector.labels.size'), value: formatSize(meme.size) },
                        { label: t('inspector.labels.resolution'), value: `${meme.width}×${meme.height}` },
                        { label: t('inspector.labels.added'), value: formatDate(meme.createdAt) },
                        { label: t('inspector.labels.modified'), value: formatDate(meme.updatedAt) },
                    ].map((item) => (
                        <div key={item.label} className="grid grid-cols-[80px_1fr] items-baseline text-xs">
                            <span className="text-textSecondary text-[10px] font-medium">{item.label}</span>
                            <span className={clsx("font-medium break-all", item.truncate && "truncate")} title={item.value}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* B. Tag Management */}
            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <TagIcon size={14} className="mr-2" /> {t('inspector.tags')}
                </h3>
                <div className="inner-container-effect p-3">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {meme.tagIds.map(tid => {
                            const tag = allTags.find(t => t.id === tid);
                            return tag ? (
                                <span
                                    key={tid}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-medium group transition-all"
                                >
                                    {tag.name}
                                    <button
                                        onClick={() => handleRemoveTag(tid)}
                                        className="ml-1 hover:text-red-500 opacity-40 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} strokeWidth={3} />
                                    </button>
                                </span>
                            ) : null;
                        })}
                        {meme.tagIds.length === 0 && (
                            <span className="text-[10px] text-textSecondary italic py-1 px-1">No tags yet.</span>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Add tag and press Enter..."
                            className="w-full text-xs bg-bgPrimary/50 border border-borderColor rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                        />
                        <Hash size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary opacity-40" />
                    </div>
                </div>
            </section>

            {/* C. OCR Text Content */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest flex items-center">
                        <FileText size={14} className="mr-2" /> {t('inspector.ocr_text')}
                    </h3>
                    <div className="flex gap-1.5">
                        <button
                            onClick={handleCopyOcr}
                            disabled={!meme.ocrText}
                            className="p-1 px-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                            title="Copy text"
                        >
                            {copySuccess ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <textarea
                        className="w-full min-h-[100px] text-xs bg-bgPrimary/50 border border-borderColor rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none transition-shadow custom-scrollbar leading-relaxed"
                        placeholder="No text detected or extracted..."
                        value={editingOcr ?? meme.ocrText ?? ''}
                        onChange={(e) => setEditingOcr(e.target.value)}
                        onBlur={handleUpdateOcr}
                    />
                    {(editingOcr !== null && editingOcr !== meme.ocrText) && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                            <span className="bg-accent px-1.5 py-0.5 rounded text-[9px] text-white font-bold shadow-lg">UNSAVED</span>
                        </div>
                    )}
                </div>
            </section>

            {/* D. Source Information */}
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
                            onChange={(e) => setEditingSource(e.target.value)}
                            onBlur={handleUpdateSource}
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
    const { removeMemes } = useMemeStore();

    const handleBatchDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) {
            removeMemes(selectedIds);
        }
    };

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

            {/* Batch Tag Input */}
            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <TagIcon size={14} className="mr-2" /> {t('inspector.batch.tagging')}
                </h3>
                <div className="inner-container-effect p-4 gap-3 flex flex-col">
                    <p className="text-[10px] text-textSecondary leading-relaxed italic">{t('inspector.batch.tag_input_tip')}</p>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Tag name..."
                            className="w-full text-xs bg-bgPrimary/50 border border-borderColor rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    // Batch tag logic (currently placeholder)
                                    console.log("Batch add tag:", val);
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* Batch Operations */}
            <section>
                <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-3 flex items-center px-1">
                    <Check size={14} className="mr-2" /> {t('inspector.batch.operations')}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-bgPrimary hover:bg-black/5 dark:hover:bg-white/5 border border-borderColor text-xs font-semibold transition-all">
                        <Download size={14} /> {t('inspector.batch.export')}
                    </button>
                    <button
                        onClick={handleBatchDelete}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-all"
                    >
                        <Trash2 size={14} /> {t('inspector.batch.delete')}
                    </button>
                </div>
            </section>
        </div>
    );
}

export function Inspector() {
    const { t } = useTranslation();
    const {
        selectedMemeIds,
        togglePanel,
        inspectorWidth,
        setInspectorWidth
    } = useUiStore();

    const { memes } = useMemeStore();
    const [isResizing, setIsResizing] = useState(false);

    // Derived data
    const selectedMemes = useMemo(() =>
        memes.filter(m => selectedMemeIds.includes(m.id)),
        [memes, selectedMemeIds]
    );

    const isSingleSelect = selectedMemes.length === 1;
    const isMultiSelect = selectedMemes.length > 1;
    const currentMeme = isSingleSelect ? selectedMemes[0] : null;

    // Resizing implementation
    const stopResizing = useCallback(() => setIsResizing(false), []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 240 && newWidth < 600) {
                setInspectorWidth(newWidth);
            }
        }
    }, [isResizing, setInspectorWidth]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
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


    const hasSelection = selectedMemeIds.length > 0;

    return (
        <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: inspectorWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex-shrink-0 h-full surface-effect flex flex-col overflow-hidden relative border-l border-borderColor shadow-2xl z-20"
        >
            {/* Splitter Handle */}
            <div
                className={clsx(
                    "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-30 transition-colors",
                    isResizing ? "bg-accent" : "hover:bg-accent/40"
                )}
                onMouseDown={startResizing}
            />

            {/* Header / Close Switch */}
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
                {hasSelection ? (
                    <>
                        {isSingleSelect && currentMeme && (
                            <MemeDetails key={currentMeme.id} meme={currentMeme} />
                        )}

                        {isMultiSelect && (
                            <BatchActions selectedIds={selectedMemeIds} />
                        )}
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center p-8">
                        <EmptyState
                            icon={<MousePointer2 size={40} className="opacity-20" />}
                            title={t('inspector.no_selection')}
                            description={t('inspector.no_selection_desc')}
                            className="scale-90"
                        />
                    </div>
                )}
            </div>
        </motion.aside>
    );
}
