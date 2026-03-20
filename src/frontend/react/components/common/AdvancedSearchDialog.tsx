import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronDown, Calendar, Tag, Layers, Monitor, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useRef } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { useTagStore } from '../../stores/TagStore';
import { IconButton } from './IconButton';
import clsx from 'clsx';

export function AdvancedSearchDialog() {
    const { t } = useTranslation();
    const { isAdvancedSearchOpen, toggleAdvancedSearch, searchQuery, setSearchQuery } = useUiStore();
    const { categories } = useCategoryStore();
    const { tags } = useTagStore();

    const [localKeyword, setLocalKeyword] = useState(searchQuery.keyword);
    const [localMatchMode, setLocalMatchMode] = useState(searchQuery.matchMode);
    const [localCategoryId, setLocalCategoryId] = useState<number | undefined>(searchQuery.categoryId);
    const [localTagIds, setLocalTagIds] = useState<number[]>(searchQuery.tagIds);
    const [localMediaType, setLocalMediaType] = useState(searchQuery.mediaType);
    const [localDateRange, setLocalDateRange] = useState(searchQuery.dateRange);

    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryButtonRef = useRef<HTMLButtonElement>(null);

    const [prevOpen, setPrevOpen] = useState(isAdvancedSearchOpen);
    if (isAdvancedSearchOpen && !prevOpen) {
        setLocalKeyword(searchQuery.keyword);
        setLocalMatchMode(searchQuery.matchMode);
        setLocalCategoryId(searchQuery.categoryId);
        setLocalTagIds(searchQuery.tagIds);
        setLocalMediaType(searchQuery.mediaType);
        setLocalDateRange(searchQuery.dateRange);
        setPrevOpen(true);
    } else if (!isAdvancedSearchOpen && prevOpen) {
        setPrevOpen(false);
    }

    const handleSearch = () => {
        setSearchQuery({
            keyword: localKeyword,
            matchMode: localMatchMode,
            categoryId: localCategoryId,
            tagIds: localTagIds,
            mediaType: localMediaType,
            dateRange: localDateRange
        });
        toggleAdvancedSearch(false);
    };

    const toggleTag = (tagId: number) => {
        setLocalTagIds(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    const matchModes: Array<{ id: typeof localMatchMode; label: string }> = [
        { id: 'fuzzy', label: t('search.mode_fuzzy') },
        { id: 'word', label: t('search.mode_word') },
        { id: 'regex', label: t('search.mode_regex') },
    ];

    const mediaTypes: Array<{ id: typeof localMediaType; label: string }> = [
        { id: 'all', label: t('search.media_all') },
        { id: 'image', label: t('search.media_image') },
        { id: 'video', label: t('search.media_video') },
        { id: 'gif', label: t('search.media_gif') },
    ];

    const dateRanges: Array<{ id: typeof localDateRange; label: string }> = [
        { id: 'all', label: t('search.date_all') },
        { id: 'today', label: t('search.date_today') },
        { id: 'week', label: t('search.date_week') },
        { id: 'month', label: t('search.date_month') },
    ];

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                duration: 0.3,
                staggerChildren: 0.05
            }
        },
        exit: {
            opacity: 0,
            scale: 0.98,
            y: 5,
            transition: { duration: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 }
    };

    return (
        <AnimatePresence>
            {isAdvancedSearchOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-white/8 dark:bg-black/32 backdrop-blur-md"
                        onClick={() => toggleAdvancedSearch(false)}
                    />

                    {/* Dialog Content */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-[560px] surface-effect bg-white/85 dark:bg-[rgba(30,30,30,0.85)] shadow-2xl flex flex-col no-drag border border-white/22 dark:border-white/8 ring-1 ring-white/12 dark:ring-white/6"
                        style={{ borderRadius: 'var(--corner-radius)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight text-textPrimary">
                                        {t('search.advanced')}
                                    </h2>
                                </div>
                            </div>
                            <IconButton
                                icon={<X size={20} />}
                                size="md"
                                variant="ghost"
                                onClick={() => toggleAdvancedSearch(false)}
                                className="hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                            />
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-6 space-y-7 max-h-[70vh] overflow-y-auto custom-scrollbar gpu-layer">
                            {/* Search Box */}
                            <motion.div variants={itemVariants} className="space-y-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60 ml-1">
                                    <Search size={14} />
                                    {t('search.advanced_keywords')}
                                </label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={localKeyword}
                                        onChange={(e) => setLocalKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="w-full h-12 bg-black/5 dark:bg-white/5 border border-white/10 dark:border-black/10 rounded-[var(--corner-radius)] px-5 text-[15px] text-textPrimary placeholder:text-textSecondary/40 focus:bg-bgSurface focus:ring-4 focus:ring-accent/10 focus:border-accent/40 outline-none transition-all duration-300 shadow-sm"
                                        placeholder={t('search.placeholder')}
                                    />
                                </div>
                            </motion.div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Match Mode */}
                                <motion.div variants={itemVariants} className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60 ml-1">
                                        <Layers size={14} />
                                        {t('search.advanced_mode')}
                                    </label>
                                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-[var(--corner-radius)] border border-white/5">
                                        {matchModes.map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setLocalMatchMode(mode.id)}
                                                className={clsx(
                                                    "flex-1 h-9 rounded-[10px] text-xs font-bold transition-all duration-300",
                                                    localMatchMode === mode.id
                                                        ? "bg-bgSurface text-accent shadow-md shadow-black/5 transform scale-[1.02]"
                                                        : "text-textSecondary hover:text-textPrimary"
                                                )}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Media Type */}
                                <motion.div variants={itemVariants} className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60 ml-1">
                                        <Monitor size={14} />
                                        {t('search.advanced_media')}
                                    </label>
                                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-[var(--corner-radius)] border border-white/5">
                                        {mediaTypes.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => setLocalMediaType(type.id)}
                                                className={clsx(
                                                    "flex-1 h-9 rounded-[10px] text-xs font-bold transition-all duration-300",
                                                    localMediaType === type.id
                                                        ? "bg-bgSurface text-accent shadow-md shadow-black/5 transform scale-[1.02]"
                                                        : "text-textSecondary hover:text-textPrimary"
                                                )}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Category */}
                                <motion.div variants={itemVariants} className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60 ml-1">
                                        <Layers size={14} />
                                        {t('search.advanced_category')}
                                    </label>
                                    <div className="relative">
                                        <button
                                            ref={categoryButtonRef}
                                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                            className="w-full h-11 bg-black/5 dark:bg-white/5 border border-white/10 dark:border-black/10 rounded-[var(--corner-radius)] px-4 flex items-center justify-between text-sm text-textPrimary hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300 shadow-sm group"
                                        >
                                            <span className={clsx(!localCategoryId && "opacity-40 font-medium")}>
                                                {localCategoryId
                                                    ? categories.find(c => c.id === localCategoryId)?.name
                                                    : t('search.media_all')}
                                            </span>
                                            <ChevronDown size={16} className={clsx("text-textSecondary transition-transform duration-300 group-hover:text-accent", isCategoryDropdownOpen && "rotate-180 text-accent")} />
                                        </button>

                                        <AnimatePresence>
                                            {isCategoryDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[210]" onClick={() => setIsCategoryDropdownOpen(false)} />
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 4, scale: 1 }}
                                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                                        className="absolute top-full left-0 right-0 z-[220] glass-effect surface-effect border border-white/20 dark:border-white/10 rounded-[var(--corner-radius)] shadow-2xl max-h-[220px] overflow-hidden flex flex-col no-drag"
                                                    >
                                                        <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar">
                                                            <button
                                                                onClick={() => {
                                                                    setLocalCategoryId(undefined);
                                                                    setIsCategoryDropdownOpen(false);
                                                                }}
                                                                className={clsx(
                                                                    "w-full px-4 py-2.5 text-left text-sm rounded-[var(--corner-radius)] transition-all flex items-center justify-between group",
                                                                    !localCategoryId ? "bg-accent/10 text-accent font-bold" : "text-textSecondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-textPrimary"
                                                                )}
                                                            >
                                                                {t('search.media_all')}
                                                                {!localCategoryId && <Check size={14} />}
                                                            </button>
                                                            {categories.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => {
                                                                        setLocalCategoryId(cat.id);
                                                                        setIsCategoryDropdownOpen(false);
                                                                    }}
                                                                    className={clsx(
                                                                        "w-full px-4 py-2.5 text-left text-sm rounded-[var(--corner-radius)] transition-all flex items-center justify-between group",
                                                                        localCategoryId === cat.id ? "bg-accent/10 text-accent font-bold" : "text-textSecondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-textPrimary"
                                                                    )}
                                                                >
                                                                    {cat.name}
                                                                    {localCategoryId === cat.id && <Check size={14} />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>

                                {/* Date Range */}
                                <motion.div variants={itemVariants} className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60 ml-1">
                                        <Calendar size={14} />
                                        {t('search.advanced_date')}
                                    </label>
                                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-[var(--corner-radius)] border border-white/5 shrink-0">
                                        {dateRanges.map((range) => (
                                            <button
                                                key={range.id}
                                                onClick={() => setLocalDateRange(range.id)}
                                                className={clsx(
                                                    "flex-1 h-9 rounded-[10px] text-xs font-bold transition-all duration-300",
                                                    localDateRange === range.id
                                                        ? "bg-bgSurface text-accent shadow-md shadow-black/5 transform scale-[1.02]"
                                                        : "text-textSecondary hover:text-textPrimary"
                                                )}
                                            >
                                                {range.label}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Tags Selection */}
                            <motion.div variants={itemVariants} className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="flex items-center gap-2 text-xs font-bold text-textPrimary uppercase tracking-widest opacity-60">
                                        <Tag size={14} />
                                        {t('search.advanced_tags')}
                                    </label>
                                    {localTagIds.length > 0 && (
                                        <button
                                            onClick={() => setLocalTagIds([])}
                                            className="text-[10px] text-accent hover:underline font-bold transition-all"
                                        >
                                            {t('search.clear_selected')} ({localTagIds.length})
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2.5 max-h-[160px] overflow-y-auto p-1 scrollbar-hide">
                                    {tags.map(tag => {
                                        const isSelected = localTagIds.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.id)}
                                                className={clsx(
                                                    "px-4 py-2 rounded-[var(--corner-radius)] text-[12px] font-semibold transition-all duration-300 border flex items-center gap-2 group",
                                                    isSelected
                                                        ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                                                        : "bg-black/5 dark:bg-white/5 border-transparent text-textSecondary hover:border-accent/30 hover:text-accent hover:bg-accent/5"
                                                )}
                                            >
                                                <span>#</span>
                                                {tag.name}
                                                {isSelected && (
                                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                                        <X size={12} className="opacity-70" />
                                                    </motion.span>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {tags.length === 0 && (
                                        <div className="w-full text-center py-8 rounded-[var(--corner-radius)] border-2 border-dashed border-white/5 bg-black/20">
                                            <p className="text-xs text-textSecondary opacity-40">{t('search.no_tags_available')}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 border-t border-white/10 dark:border-black/20 bg-black/[0.02] dark:bg-white/[0.01] flex items-center justify-between gap-4">
                            <button
                                onClick={() => {
                                    setLocalKeyword('');
                                    setLocalMatchMode('fuzzy');
                                    setLocalCategoryId(undefined);
                                    setLocalTagIds([]);
                                    setLocalMediaType('all');
                                    setLocalDateRange('all');
                                }}
                                className="text-xs font-bold text-textSecondary hover:text-accent transition-colors"
                            >
                                {t('search.reset_filters')}
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleAdvancedSearch(false)}
                                    className="px-5 h-11 text-sm font-bold text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 rounded-[var(--corner-radius)] transition-all duration-300"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleSearch}
                                    className="px-8 h-11 text-sm font-black text-white bg-accent hover:bg-accent/90 rounded-[var(--corner-radius)] shadow-xl shadow-accent/25 transition-all duration-300 flex items-center gap-3 group active:scale-[0.97]"
                                >
                                    <Search size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                    {t('search.advanced')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
