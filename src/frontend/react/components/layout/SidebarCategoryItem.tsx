import { memo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, MoreHorizontal, GripVertical, Folder, Plus } from 'lucide-react';
import { Portal } from '../common/Portal';
import { ColorPicker } from '../common/ColorPicker';
import clsx from 'clsx';
import type { Category } from '../../types';
import { updateCategory as updateCategoryRequest, deleteCategory as deleteCategoryRequest } from '../../services/categoryService';
import { useCategoryStore } from '../../stores/CategoryStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { useUiStore } from '../../stores/UiStore';
import { useTranslation } from 'react-i18next';
import { categoryComposerStyle, getCategoryInputStyle } from './SidebarCategoryCreator';

export const PRESET_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#2563eb'
];

type CategoryMenuPanel = 'actions' | 'confirmDelete' | 'customColor';

const CATEGORY_MENU_VIEWPORT_PADDING = 12;

const clampCategoryMenuPosition = (
    position: { top: number; left: number },
    size: { width: number; height: number }
) => {
    const maxLeft = Math.max(CATEGORY_MENU_VIEWPORT_PADDING, window.innerWidth - size.width - CATEGORY_MENU_VIEWPORT_PADDING);
    const maxTop = Math.max(CATEGORY_MENU_VIEWPORT_PADDING, window.innerHeight - size.height - CATEGORY_MENU_VIEWPORT_PADDING);

    return {
        left: Math.min(Math.max(position.left, CATEGORY_MENU_VIEWPORT_PADDING), maxLeft),
        top: Math.min(Math.max(position.top, CATEGORY_MENU_VIEWPORT_PADDING), maxTop),
    };
};

const layoutTransition = {
    duration: 0.3,
    ease: [0.23, 1, 0.32, 1] as const,
};

interface SidebarCategoryItemProps {
    cat: Category;
    index: number;
    sortableProps: any;
    sidebarExpanded: boolean;
    refreshCategoriesInBackground: () => void;
}

export const SidebarCategoryItem = memo(({
    cat,
    index,
    sortableProps,
    sidebarExpanded,
    refreshCategoriesInBackground
}: SidebarCategoryItemProps) => {
    const { t } = useTranslation();
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const updateCategoryInStore = useCategoryStore(state => state.updateCategory);
    const removeCategoryFromStore = useCategoryStore(state => state.removeCategory);
    const addNotification = useNotificationStore(state => state.addNotification);

    const [isEditing, setIsEditing] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [isActionPending, setIsActionPending] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const [menuPanel, setMenuPanel] = useState<CategoryMenuPanel | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [previewColor, setPreviewColor] = useState<string | null>(null);

    const menuRef = useRef<HTMLDivElement | null>(null);
    const navId = `category-${cat.id}`;
    const isActive = activeNav === navId;
    const categoryDisplayColor = previewColor || cat.color || '#0066cc';

    // Handle scroll/click outside for menu
    useEffect(() => {
        if (!menuPanel) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(`[data-category-menu-root="${cat.id}"], .category-portal-menu`)) {
                if (menuPanel === 'customColor') setPreviewColor(null);
                setMenuPanel(null);
            }
        };

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.category-portal-menu')) {
                if (menuPanel === 'customColor') setPreviewColor(null);
                setMenuPanel(null);
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (menuPanel === 'customColor') setPreviewColor(null);
                setMenuPanel(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('scroll', handleScroll, true);
        document.addEventListener('keydown', handleEsc);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [menuPanel, cat.id]);

    // Adjust menu position if it overflows
    useEffect(() => {
        if (!menuPanel || !menuRef.current) return;
        const frameId = window.requestAnimationFrame(() => {
            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            const nextPosition = clampCategoryMenuPosition(menuPosition, { width: rect.width, height: rect.height });
            if (nextPosition.left !== menuPosition.left || nextPosition.top !== menuPosition.top) {
                setMenuPosition(nextPosition);
            }
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [menuPanel, menuPosition]);

    const handleStartRename = () => {
        setMenuPanel(null);
        setIsEditing(true);
        setEditingName(cat.name);
    };

    const handleMenuToggle = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (menuPanel) {
            setMenuPanel(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setMenuPosition({ top: rect.top, left: rect.right + 8 });
        setMenuPanel('actions');
    };

    const handleSubmitRename = async () => {
        const nextName = editingName.trim();
        if (!nextName || nextName === cat.name || isActionPending) {
            if (!nextName) {
                setIsEditing(false);
                setEditingName('');
            }
            return;
        }

        setIsActionPending(true);
        try {
            const updated = await updateCategoryRequest(cat.id, { name: nextName });
            updateCategoryInStore(cat.id, updated);
            setIsEditing(false);
            setEditingName('');
            addNotification({ type: 'success', title: '分类已重命名', description: updated.name });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({ type: 'error', title: t('common.save_failed'), description: error instanceof Error ? error.message : String(error) });
        } finally {
            setIsActionPending(false);
        }
    };

    const handlePickColor = async (color: string, notify = true, close = true) => {
        const trimmedColor = color.trim().toLowerCase();
        if (!trimmedColor || trimmedColor === cat.color) {
            setPreviewColor(null);
            if (close) setMenuPanel(null);
            return;
        }
        setPreviewColor(null);
        updateCategoryInStore(cat.id, { color: trimmedColor });
        if (close) setMenuPanel(null);
        try {
            const updated = await updateCategoryRequest(cat.id, { color: trimmedColor });
            updateCategoryInStore(cat.id, updated);
            if (notify) addNotification({ type: 'success', title: '分类颜色已更新', description: updated.name });
        } catch (error) {
            refreshCategoriesInBackground();
            addNotification({ type: 'error', title: t('common.save_failed'), description: error instanceof Error ? error.message : String(error) });
        }
    };

    const handleDelete = async () => {
        if (isActionPending) return;
        setMenuPanel(null);
        setIsActionPending(true);
        try {
            await deleteCategoryRequest(cat.id);
            removeCategoryFromStore(cat.id);
            if (isActive) setActiveNav('all');
            addNotification({ type: 'success', title: '分类已删除', description: cat.name });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({ type: 'error', title: t('common.save_failed'), description: error instanceof Error ? error.message : String(error) });
            setIsActionPending(false);
        }
    };

    const isDeleteConfirmOpen = menuPanel === 'confirmDelete';
    const isCustomColorPickerOpen = menuPanel === 'customColor';

    return (
        <div ref={sortableProps.setNodeRef} style={sortableProps.style}>
            <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                className={clsx("relative group/category px-1 gpu-transform-opacity", sortableProps.isDragging && "z-50")}
                data-category-menu-root={cat.id}
            >
                {isEditing ? (
                    <div className="pb-2">
                        <div className="rounded-2xl border p-2 space-y-2" style={categoryComposerStyle}>
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={(e) => {
                                    setIsInputFocused(false);
                                    if (!e.relatedTarget?.closest('button')) handleSubmitRename();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleSubmitRename(); }
                                    if (e.key === 'Escape') { setIsEditing(false); setEditingName(''); }
                                }}
                                autoFocus
                                className="w-full h-10 rounded-xl border px-3 text-sm text-textPrimary placeholder:text-textSecondary/60 outline-none transition-all duration-300"
                                style={getCategoryInputStyle(isInputFocused)}
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsEditing(false); setEditingName(''); }}
                                    disabled={isActionPending}
                                    className="h-8 px-3 rounded-lg text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitRename}
                                    disabled={isActionPending}
                                    className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isActionPending ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveNav(navId)}
                            className={clsx(
                                "w-full flex h-9 items-center text-left rounded-lg text-[13px] transition-all duration-300 group relative no-drag mb-0.5 px-3 select-none",
                                isActive
                                    ? "font-semibold text-textPrimary z-10"
                                    : "text-textPrimary/60 hover:text-textPrimary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:translate-x-1",
                                sidebarExpanded && "pr-10",
                                sortableProps.isDragging && "bg-black/[0.03] dark:bg-white/[0.03] text-textPrimary shadow-sm"
                            )}
                            title={!sidebarExpanded ? cat.name : undefined}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    transition={layoutTransition}
                                    className="absolute left-0 w-1 h-5 bg-accent rounded-r-full"
                                    style={{ boxShadow: '0 0 8px var(--accent-color)' }}
                                />
                            )}
                            <span className="flex w-[16px] shrink-0 justify-center">
                                <Folder
                                    size={18}
                                    className={clsx("transition-all duration-300", isActive ? "scale-110 opacity-100" : "opacity-60 group-hover/category:opacity-100")}
                                    style={{
                                        color: categoryDisplayColor,
                                        fill: categoryDisplayColor ? `color-mix(in srgb, ${categoryDisplayColor}, transparent 85%)` : 'transparent',
                                        filter: isActive ? `drop-shadow(0 0 4px ${categoryDisplayColor}80)` : 'none'
                                    }}
                                />
                            </span>
                            <motion.span
                                initial={false}
                                animate={{
                                    opacity: sidebarExpanded ? 1 : 0,
                                    maxWidth: sidebarExpanded ? 160 : 0,
                                    marginLeft: sidebarExpanded ? 16 : 0,
                                }}
                                transition={layoutTransition}
                                className="flex-1 min-w-0 truncate whitespace-nowrap overflow-hidden"
                            >
                                {cat.name}
                            </motion.span>
                        </button>

                        {sidebarExpanded && (
                            <>
                                <div
                                    {...sortableProps.attributes}
                                    {...sortableProps.listeners}
                                    className={clsx(
                                        "absolute right-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing z-20 outline-none",
                                        menuPanel ? "opacity-100 text-textSecondary" : "opacity-0 group-hover/category:opacity-100 text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5"
                                    )}
                                    title="拖动排序"
                                >
                                    <GripVertical size={14} />
                                </div>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleMenuToggle}
                                    aria-label={`${cat.name} 分类菜单`}
                                    aria-haspopup="menu"
                                    aria-expanded={!!menuPanel}
                                    className={clsx(
                                        "absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 no-drag z-20",
                                        menuPanel ? "opacity-100 bg-black/5 dark:bg-white/10 text-textPrimary" : "opacity-0 group-hover/category:opacity-100 text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5"
                                    )}
                                >
                                    <MoreHorizontal size={14} />
                                </button>
                                <Portal>
                                    <AnimatePresence>
                                        {menuPanel && (
                                            <motion.div
                                                ref={menuRef}
                                                initial={{ opacity: 0, scale: 0.96, x: -8, y: -4 }}
                                                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98, x: -6, y: -2 }}
                                                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                                className="fixed z-[9999] flex rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[color:var(--bg-surface)] shadow-2xl overflow-hidden backdrop-blur-md category-portal-menu gpu-transform-opacity"
                                                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, width: 'auto' }}
                                            >
                                                <AnimatePresence mode="wait">
                                                    {isDeleteConfirmOpen ? (
                                                        <motion.div
                                                            key="confirm"
                                                            initial={{ opacity: 0, x: 16 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -12 }}
                                                            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                                            className="flex flex-col gap-2 p-2.5 w-48"
                                                        >
                                                            <div className="text-[11px] leading-4 text-textSecondary font-medium px-1">
                                                                确认删除“<span className="text-textPrimary font-bold">{cat.name}</span>”？该操作不可撤销。
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleDelete} className="w-full flex items-center justify-center h-8 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                                                                    确定删除
                                                                </button>
                                                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenuPanel('actions')} className="w-full flex items-center justify-center h-8 rounded-xl text-textSecondary hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition-colors">
                                                                    取消
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <div className="flex">
                                                            <motion.div
                                                                key="menu"
                                                                initial={{ opacity: 0, x: -12 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                exit={{ opacity: 0, x: 10 }}
                                                                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                                                className={clsx("flex flex-col gap-0.5 p-1.5 w-48", isCustomColorPickerOpen && "border-r border-black/[0.05] dark:border-white/[0.05]")}
                                                            >
                                                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleStartRename} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-textPrimary hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
                                                                    <Pencil size={14} className="text-textSecondary" />
                                                                    <span>重命名</span>
                                                                </button>
                                                                <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] mx-2 my-1" />
                                                                <div className="px-3 py-2">
                                                                    <div className="text-[10px] uppercase tracking-wider text-textSecondary opacity-50 mb-2 font-bold">分类颜色</div>
                                                                    <div className="grid grid-cols-6 gap-1.5">
                                                                        {PRESET_COLORS.map(c => (
                                                                            <button
                                                                                key={c}
                                                                                type="button"
                                                                                onClick={() => handlePickColor(c)}
                                                                                className={clsx("w-5 h-5 rounded-full border border-black/10 dark:border-white/10 transition-transform hover:scale-125 active:scale-95", categoryDisplayColor === c && "ring-2 ring-accent ring-offset-2 ring-offset-[color:var(--bg-surface)]")}
                                                                                style={{ backgroundColor: c }}
                                                                                title={c}
                                                                            />
                                                                        ))}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setMenuPanel('customColor'); }}
                                                                            aria-label={`自定义 ${cat.name} 颜色`}
                                                                            className={clsx("w-5 h-5 rounded-full border border-dashed border-textSecondary/40 flex items-center justify-center transition-all hover:scale-125 text-textSecondary", isCustomColorPickerOpen && "bg-accent/10 border-accent/40 text-accent scale-110")}
                                                                            title="自定义颜色"
                                                                        >
                                                                            <Plus size={10} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] mx-2 my-1" />
                                                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenuPanel('confirmDelete')} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-red-500 hover:bg-red-500/[0.08] transition-colors">
                                                                    <Trash2 size={14} />
                                                                    <span>删除分类</span>
                                                                </button>
                                                            </motion.div>

                                                            <AnimatePresence>
                                                                {isCustomColorPickerOpen && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, width: 0 }}
                                                                        animate={{ opacity: 1, width: 240 }}
                                                                        exit={{ opacity: 0, width: 0 }}
                                                                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                                                        className="overflow-hidden gpu-transform-opacity"
                                                                    >
                                                                        <motion.div
                                                                            initial={{ opacity: 0, x: -12 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            exit={{ opacity: 0, x: -8 }}
                                                                            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                                                            className="w-[240px] gpu-transform-opacity"
                                                                        >
                                                                            <ColorPicker
                                                                                color={categoryDisplayColor}
                                                                                onPreviewChange={setPreviewColor}
                                                                                onCommit={(c) => handlePickColor(c, false, false)}
                                                                            />
                                                                        </motion.div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Portal>
                            </>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );
});
