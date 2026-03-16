import { motion } from 'framer-motion';
import { History, Sparkles, SlidersHorizontal, ArrowRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import clsx from 'clsx';

interface SearchDropdownProps {
    onSelectHistory: (term: string) => void;
    onClose: () => void;
}

export function SearchDropdown({ onSelectHistory, onClose }: SearchDropdownProps) {
    const { t } = useTranslation();
    const { searchHistory, clearSearchHistory, toggleAdvancedSearch } = useUiStore();

    // Mock smart suggestions for now
    const suggestions = [
        { id: 1, text: 'coding memes', type: 'tag' },
        { id: 2, text: 'funny cats', type: 'category' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 right-0 pt-2 z-[60] no-drag cursor-default"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="glass-effect surface-effect shadow-2xl rounded-2xl overflow-hidden flex flex-col border border-white/10 dark:border-black/10">
                {/* Search History */}
                {searchHistory.length > 0 && (
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
                            {searchHistory.map((item) => (
                                <button
                                    key={item}
                                    onClick={() => onSelectHistory(item)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left group"
                                >
                                    <ArrowRight size={12} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-[opacity,margin] duration-200 text-accent" />
                                    <span className="text-xs truncate">{item}</span>
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
                                    item.type === 'tag' ? "bg-accent/10 text-accent" : "bg-black/10 dark:bg-white/10 opacity-60"
                                )}>
                                    {item.type}
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
        </motion.div>
    );
}
