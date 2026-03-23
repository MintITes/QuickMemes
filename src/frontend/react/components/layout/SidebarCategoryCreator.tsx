import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategoryStore } from '../../stores/CategoryStore';
import { useUiStore } from '../../stores/UiStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { createCategory } from '../../services/categoryService';
import { useTranslation } from 'react-i18next';
import { categoryComposerStyle, getCategoryInputStyle } from './sidebarShared';

interface SidebarCategoryCreatorProps {
    sidebarExpanded: boolean;
    isAddingCategory: boolean;
    setIsAddingCategory: (val: boolean) => void;
    refreshCategoriesInBackground: () => void;
}

export const SidebarCategoryCreator = memo(({
    sidebarExpanded,
    isAddingCategory,
    setIsAddingCategory,
    refreshCategoriesInBackground
}: SidebarCategoryCreatorProps) => {
    const { t } = useTranslation();
    const addCategory = useCategoryStore(state => state.addCategory);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const addNotification = useNotificationStore(state => state.addNotification);

    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
    const [isCategoryInputFocused, setIsCategoryInputFocused] = useState(false);

    const handleSubmitCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) {
            setIsAddingCategory(false);
            setNewCategoryName('');
            return;
        }
        if (isSubmittingCategory) return;

        setIsSubmittingCategory(true);
        try {
            const created = await createCategory(name);
            addCategory(created);
            setActiveNav(`category-${created.id}`);
            setIsAddingCategory(false);
            setNewCategoryName('');
            setIsCategoryInputFocused(false);
            addNotification({ type: 'success', title: '分类已创建', description: created.name });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({ type: 'error', title: t('common.save_failed'), description: error instanceof Error ? error.message : String(error) });
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    return (
        <AnimatePresence initial={false}>
            {isAddingCategory && sidebarExpanded && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="px-1 pb-2 gpu-transform-opacity"
                >
                    <div className="rounded-2xl border p-2 space-y-2" style={categoryComposerStyle}>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onFocus={() => setIsCategoryInputFocused(true)}
                            onBlur={(e) => {
                                setIsCategoryInputFocused(false);
                                if (!e.relatedTarget?.closest('button')) handleSubmitCategory();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleSubmitCategory(); }
                                if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategoryName(''); }
                            }}
                            placeholder="新分类名称"
                            autoFocus
                            className="w-full h-10 rounded-xl border px-3 text-sm text-textPrimary placeholder:text-textSecondary/60 outline-none transition-all duration-300"
                            style={getCategoryInputStyle(isCategoryInputFocused)}
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); setIsCategoryInputFocused(false); }}
                                disabled={isSubmittingCategory}
                                className="h-8 px-3 rounded-lg text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleSubmitCategory}
                                disabled={isSubmittingCategory}
                                className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSubmittingCategory ? '创建中...' : '创建'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});
