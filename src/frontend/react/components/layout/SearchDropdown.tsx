import { motion } from 'framer-motion';
import { History, Sparkles, SlidersHorizontal, ArrowRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useTagStore } from '../../stores/TagStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { SuggestionService } from '../../services/SuggestionService';
import clsx from 'clsx';
import { useMemo } from 'react';

interface SearchDropdownProps {
    keyword: string;
    onSelectHistory: (term: string) => void;
    onClose: () => void;
}

export function SearchDropdown({ keyword, onSelectHistory, onClose }: SearchDropdownProps) {
    const { t } = useTranslation();
    const { searchHistory, clearSearchHistory, toggleAdvancedSearch, browsingHistory, glassEffect } = useUiStore();
    const { memes } = useMemeStore();
    const { tags } = useTagStore();
    const { categories } = useCategoryStore();

    const suggestions = useMemo(() => {
        return SuggestionService.getSuggestions(
            keyword,
            searchHistory,
            browsingHistory,
            memes,
            tags,
            categories
        );
    }, [keyword, searchHistory, browsingHistory, memes, tags, categories]);

    const historyItems = useMemo(() => {
        const normalized = keyword.toLowerCase().trim();
        return searchHistory
            .filter(h => !normalized || h.term.toLowerCase().includes(normalized))
            .slice(0, 5);
    }, [searchHistory, keyword]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 right-0 pt-2 z-[60] no-drag cursor-default"
            onClick={(e) => e.stopPropagation()}
        >
            <div className={clsx(
                "relative surface-effect shadow-2xl rounded-2xl overflow-hidden flex flex-col border",
                glassEffect
                    ? "border-white/20 dark:border-white/10 bg-white/72 dark:bg-black/52"
                    : "border-white/10 dark:border-black/10"
            )}>
                {glassEffect && (
                    <motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute inset-0 pointer-events-none bg-white/28 dark:bg-black/20"
                        style={{
                            WebkitBackdropFilter: 'blur(22px)',
                            backdropFilter: 'blur(22px)'
                        }}
                    />
                )}
                <div className="relative z-10 flex flex-col">
                {/* Search History */}
                {historyItems.length > 0 && (
                    <div className="p-2 border-b border-borderColor">
                        <div className="flex items-center justify-between px-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 flex items-center gap-1">
                                <History size={10} />
                                {t('search.history')}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearSearchHistory();
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className="text-[10px] opacity-40 hover:opacity-100 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                                <Trash2 size={10} />
                                {t('search.clear_history')}
                            </button>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {historyItems.map((item) => (
                                <button
                                    key={item.term}
                                    onClick={() => onSelectHistory(item.term)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left group"
                                >
                                    <ArrowRight size={12} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-[opacity,margin] duration-200 text-accent" />
                                    <span className="text-xs truncate">{item.term}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Smart Suggestions */}
                <div className="p-2">
                    <div className="px-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 flex items-center gap-1">
                            <Sparkles size={10} />
                            {t('search.suggestions')}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {suggestions.length === 0 && (
                            <div className="px-2 py-4 text-center opacity-30 text-[10px]">
                                {t('search.no_suggestions', 'No matching suggestions')}
                            </div>
                        )}
                        {suggestions.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSelectHistory(item.text)}
                                onMouseDown={(e) => e.preventDefault()}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                            >
                                <span className="text-xs">{item.text}</span>
                                <span className={clsx(
                                    "text-[9px] px-1.5 py-0.5 rounded-md",
                                    item.type === 'tag' ? "bg-accent/10 text-accent" :
                                        item.type === 'browsing' ? "bg-purple-500/10 text-purple-500" :
                                            item.type === 'category' ? "bg-blue-500/10 text-blue-500" :
                                                "bg-black/10 dark:bg-white/10 opacity-60"
                                )}>
                                    {t(`search.type_${item.type}`, item.type)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-1 border-t border-borderColor bg-black/5">
                    <button
                        onClick={() => {
                            toggleAdvancedSearch(true);
                            onClose();
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold hover:bg-accent/10 hover:text-accent transition-all active:scale-[0.98]"
                    >
                        <SlidersHorizontal size={12} />
                        {t('search.advanced')}
                    </button>
                </div>
                </div>
            </div>
        </motion.div>
    );
}
