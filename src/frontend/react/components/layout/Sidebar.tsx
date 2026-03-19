import { useEffect, useMemo, useRef, useState } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { LayoutList, Tag, Trash2, Clock, Star, Folder, ArchiveRestore, PanelLeft, PanelLeftClose, Plus, MoreHorizontal, Pencil, GripVertical } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { createCategory, deleteCategory as deleteCategoryRequest, fetchCategories, updateCategory as updateCategoryRequest } from '../../services/categoryService';
import { useNotificationStore } from '../../stores/NotificationStore';
import type { Category } from '../../types';
import { Portal } from '../common/Portal';
import { ColorPicker } from '../common/ColorPicker';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, children }: { id: number, children: (props: { attributes: any, listeners: any, setNodeRef: (node: HTMLElement | null) => void, style: React.CSSProperties, isDragging: boolean }) => React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { zIndex: 50, position: 'relative' as const } : {})
    };

    return <>{children({ attributes, listeners, setNodeRef, style, isDragging })}</>;
}

type CategoryMenuPanel = 'actions' | 'confirmDelete' | 'customColor';

interface CategoryMenuState {
    categoryId: number;
    panel: CategoryMenuPanel;
    position: { top: number; left: number };
}

const CATEGORY_MENU_VIEWPORT_PADDING = 12;

const parseActiveCategoryId = (activeNav: string) => (
    activeNav.startsWith('category-') ? Number(activeNav.replace('category-', '')) : null
);

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

export function Sidebar() {
    const { t } = useTranslation();
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const sidebarExpanded = useUiStore(state => state.sidebarExpanded);
    const setSidebarExpanded = useUiStore(state => state.setSidebarExpanded);
    const categories = useCategoryStore(state => state.categories);
    const addCategory = useCategoryStore(state => state.addCategory);
    const updateCategoryInStore = useCategoryStore(state => state.updateCategory);
    const removeCategoryFromStore = useCategoryStore(state => state.removeCategory);
    const setCategories = useCategoryStore(state => state.setCategories);
    const addNotification = useNotificationStore(state => state.addNotification);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
    const [isCategoryInputFocused, setIsCategoryInputFocused] = useState(false);
    const [categoryMenu, setCategoryMenu] = useState<CategoryMenuState | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [pendingCategoryActionId, setPendingCategoryActionId] = useState<number | null>(null);
    const categoryIconRefs = useRef(new Map<number, SVGSVGElement>());
    const categoryIconPreviewColorsRef = useRef(new Map<number, string>());
    const categoryColorRequestSeqRef = useRef(new Map<number, number>());
    const categoryMenuRef = useRef<HTMLDivElement | null>(null);
    const previousActiveCategoryIdRef = useRef<number | null>(parseActiveCategoryId(activeNav));
    const activeNavRef = useRef(activeNav);

    const PRESET_COLORS = [
        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#2563eb'
    ];

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id && over) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over.id);

            const newCategories = arrayMove(categories, oldIndex, newIndex);
            const updatedCategories = newCategories.map((c, i) => ({ ...c, position: i }));

            setCategories(updatedCategories);

            try {
                await updateCategoryRequest(active.id as number, { position: newIndex });
            } catch (error) {
                addNotification({
                    type: 'error',
                    title: '分类排序失败',
                    description: error instanceof Error ? error.message : String(error),
                });
                refreshCategoriesInBackground();
            }
        }
    };

    const categoriesById = useMemo(
        () => new Map(categories.map((category) => [category.id, category])),
        [categories]
    );

    const getNavClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "w-full flex h-9 items-center text-left rounded-lg text-[13px] transition-all duration-300 group relative no-drag mb-0.5 px-3 select-none",
            isActive
                ? "font-semibold text-textPrimary z-10"
                : "text-textPrimary/60 hover:text-textPrimary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:translate-x-1"
        );
    };

    const getIconClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "transition-all duration-300 flex-shrink-0",
            isActive ? "scale-110 text-accent opacity-100" : "opacity-50 group-hover:opacity-100 group-hover:scale-105"
        );
    };

    const getSectionLabelClass = (tone: 'default' | 'muted' = 'default') => clsx(
        "block px-3 text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden leading-4 transition-[height,margin,opacity] duration-180",
        tone === 'default' ? "text-textSecondary" : "text-textSecondary",
        sidebarExpanded
            ? clsx(tone === 'default' ? "opacity-60 h-4 mb-3" : "opacity-50 h-4 mb-3")
            : "opacity-0 h-0 mb-0 pointer-events-none"
    );

    useEffect(() => {
        if (categoryMenu === null) return;

        const handleGlobalAction = () => {
            if (categoryMenu.panel === 'customColor') {
                categoryIconPreviewColorsRef.current.delete(categoryMenu.categoryId);
                const category = categoriesById.get(categoryMenu.categoryId);
                if (category) {
                    const iconNode = categoryIconRefs.current.get(category.id);
                    if (iconNode) {
                        applyCategoryIconStyle(iconNode, getCategoryBaseColor(category), activeNav === `category-${category.id}`);
                    }
                }
            }
            setCategoryMenu(null);
        };

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            // Only close if scrolling outside the category menu portal
            if (!target.closest?.('.category-portal-menu')) {
                handleGlobalAction();
            }
        };

        window.addEventListener('scroll', handleScroll, true);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [categoryMenu, categoriesById, activeNav]);

    useEffect(() => {
        if (!categoryMenu || !categoryMenuRef.current) {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            if (!categoryMenuRef.current) {
                return;
            }

            const rect = categoryMenuRef.current.getBoundingClientRect();
            const nextPosition = clampCategoryMenuPosition(categoryMenu.position, {
                width: rect.width,
                height: rect.height,
            });

            if (nextPosition.left === categoryMenu.position.left && nextPosition.top === categoryMenu.position.top) {
                return;
            }

            setCategoryMenu((current) => {
                if (!current || current.categoryId !== categoryMenu.categoryId || current.panel !== categoryMenu.panel) {
                    return current;
                }

                return {
                    ...current,
                    position: nextPosition,
                };
            });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [categoryMenu]);

    const layoutTransition = {
        duration: 0.18,
        ease: [0.23, 1, 0.32, 1] as const,
    };

    const categoryComposerStyle = {
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 80%)',
        boxShadow: '0 8px 32px -12px color-mix(in srgb, var(--accent-color), transparent 70%), 0 4px 12px -4px rgba(0,0,0,0.1)',
        borderWidth: '1px',
    } as const;

    const categoryInputStyle = {
        backgroundColor: isCategoryInputFocused
            ? 'color-mix(in srgb, var(--accent-color) 4%, var(--bg-surface))'
            : 'color-mix(in srgb, var(--accent-color) 2%, var(--bg-surface))',
        borderColor: isCategoryInputFocused
            ? 'color-mix(in srgb, var(--accent-color), transparent 60%)'
            : 'color-mix(in srgb, var(--accent-color), transparent 85%)',
        boxShadow: isCategoryInputFocused
            ? '0 0 0 4px color-mix(in srgb, var(--accent-color), transparent 92%)'
            : 'none',
        caretColor: 'var(--accent-color)',
    } as const;

    const renderNavLabel = (label: string) => (
        <span
            className={clsx(
                "flex-1 truncate whitespace-nowrap overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                sidebarExpanded ? "opacity-100 max-w-[160px] ml-4" : "opacity-0 max-w-0 ml-0"
            )}
        >
            {label}
        </span>
    );

    const renderActiveIndicator = (id: string) => {
        const isActive = activeNav === id;
        if (!isActive) {
            return null;
        }

        return (
            <motion.div
                layoutId="active-indicator"
                transition={layoutTransition}
                className="absolute left-0 w-1 h-5 bg-accent rounded-r-full"
                style={{ boxShadow: '0 0 8px var(--accent-color)' }}
            />
        );
    };

    useEffect(() => {
        if (categoryMenu === null) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-category-menu-root="true"], .category-portal-menu')) {
                if (categoryMenu.panel === 'customColor') {
                    categoryIconPreviewColorsRef.current.delete(categoryMenu.categoryId);
                    const category = categoriesById.get(categoryMenu.categoryId);
                    if (category) {
                        const iconNode = categoryIconRefs.current.get(category.id);
                        if (iconNode) {
                            applyCategoryIconStyle(iconNode, getCategoryBaseColor(category), activeNav === `category-${category.id}`);
                        }
                    }
                }
                setCategoryMenu(null);
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (categoryMenu.panel === 'customColor') {
                    categoryIconPreviewColorsRef.current.delete(categoryMenu.categoryId);
                    const category = categoriesById.get(categoryMenu.categoryId);
                    if (category) {
                        const iconNode = categoryIconRefs.current.get(category.id);
                        if (iconNode) {
                            applyCategoryIconStyle(iconNode, getCategoryBaseColor(category), activeNav === `category-${category.id}`);
                        }
                    }
                }
                setCategoryMenu(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEsc);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [categoryMenu, categoriesById, activeNav]);

    useEffect(() => {
        if (categoryMenu && !categories.some((category) => category.id === categoryMenu.categoryId)) {
            setCategoryMenu(null);
        }
    }, [categories, categoryMenu]);

    const getCategoryBaseColor = (category: Category) => category.color || '#0066cc';

    const applyCategoryIconStyle = (node: SVGSVGElement, color: string, isActive: boolean) => {
        node.style.color = color;
        node.style.fill = `color-mix(in srgb, ${color}, transparent 85%)`;
        node.style.filter = isActive ? `drop-shadow(0 0 4px ${color}80)` : 'none';
    };

    const syncCategoryIconPreview = (category: Category, overrideColor?: string) => {
        const iconNode = categoryIconRefs.current.get(category.id);
        if (!iconNode) {
            return;
        }

        const nextColor = overrideColor || getCategoryBaseColor(category);
        applyCategoryIconStyle(iconNode, nextColor, activeNav === `category-${category.id}`);
    };

    const clearCategoryIconPreview = (categoryId: number) => {
        categoryIconPreviewColorsRef.current.delete(categoryId);
        const category = categoriesById.get(categoryId);
        if (category) {
            syncCategoryIconPreview(category);
        }
    };

    useEffect(() => {
        activeNavRef.current = activeNav;
    }, [activeNav]);

    useEffect(() => {
        categories.forEach((category) => {
            const iconNode = categoryIconRefs.current.get(category.id);
            if (!iconNode) {
                return;
            }

            const previewColor = categoryIconPreviewColorsRef.current.get(category.id);
            applyCategoryIconStyle(
                iconNode,
                previewColor || getCategoryBaseColor(category),
                activeNavRef.current === `category-${category.id}`
            );
        });
        previousActiveCategoryIdRef.current = parseActiveCategoryId(activeNavRef.current);
    }, [categories]);

    useEffect(() => {
        const nextActiveCategoryId = parseActiveCategoryId(activeNav);
        const previousActiveCategoryId = previousActiveCategoryIdRef.current;

        if (previousActiveCategoryId === nextActiveCategoryId) {
            return;
        }

        const syncCategoryIcon = (categoryId: number | null) => {
            if (categoryId === null) {
                return;
            }

            const category = categoriesById.get(categoryId);
            if (!category) {
                return;
            }

            const previewColor = categoryIconPreviewColorsRef.current.get(category.id);
            const iconNode = categoryIconRefs.current.get(category.id);
            if (!iconNode) {
                return;
            }

            applyCategoryIconStyle(iconNode, previewColor || getCategoryBaseColor(category), nextActiveCategoryId === category.id);
        };

        syncCategoryIcon(previousActiveCategoryId);
        syncCategoryIcon(nextActiveCategoryId);
        previousActiveCategoryIdRef.current = nextActiveCategoryId;
    }, [activeNav, categoriesById]);

    const closeCategoryMenu = () => {
        if (categoryMenu?.panel === 'customColor') {
            clearCategoryIconPreview(categoryMenu.categoryId);
        }
        setCategoryMenu(null);
    };

    const openCategoryMenuPanel = (categoryId: number, panel: CategoryMenuPanel) => {
        setCategoryMenu((current) => {
            if (!current || current.categoryId !== categoryId) {
                return current;
            }

            return { ...current, panel };
        });
    };

    const handleToggleCategoryMenu = (categoryId: number, position: { top: number; left: number }) => {
        setCategoryMenu((current) => {
            if (current?.categoryId === categoryId) {
                return null;
            }

            return {
                categoryId,
                panel: 'actions',
                position,
            };
        });
    };

    const handleStartCreateCategory = () => {
        if (!sidebarExpanded) {
            setSidebarExpanded(true);
        }
        setEditingCategoryId(null);
        closeCategoryMenu();
        setIsAddingCategory(true);
    };

    const refreshCategoriesInBackground = () => {
        void fetchCategories()
            .then((nextCategories) => {
                setCategories(nextCategories);
            })
            .catch(() => {
                // Keep optimistic state if follow-up refresh fails.
            });
    };

    const handleSubmitCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) {
            setIsAddingCategory(false);
            setNewCategoryName('');
            return;
        }
        if (isSubmittingCategory) {
            return;
        }

        setIsSubmittingCategory(true);
        try {
            const created = await createCategory(name);
            addCategory(created);
            setActiveNav(`category-${created.id}`);
            setIsAddingCategory(false);
            setNewCategoryName('');
            setIsCategoryInputFocused(false);
            addNotification({
                type: 'success',
                title: '分类已创建',
                description: created.name,
            });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    const handleStartRenameCategory = (category: Category) => {
        closeCategoryMenu();
        setIsAddingCategory(false);
        setNewCategoryName('');
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const handleSubmitRenameCategory = async (category: Category) => {
        const nextName = editingCategoryName.trim();
        if (!nextName || nextName === category.name || pendingCategoryActionId === category.id) {
            if (!nextName) {
                setEditingCategoryId(null);
                setEditingCategoryName('');
            }
            return;
        }

        setPendingCategoryActionId(category.id);
        try {
            const updated = await updateCategoryRequest(category.id, { name: nextName });
            updateCategoryInStore(category.id, updated);
            setEditingCategoryId(null);
            setEditingCategoryName('');
            addNotification({
                type: 'success',
                title: '分类已重命名',
                description: updated.name,
            });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setPendingCategoryActionId(null);
        }
    };

    const persistCategoryColor = async (
        category: Category,
        color: string,
        options?: { closeMenu?: boolean; notify?: boolean }
    ) => {
        const trimmedColor = color.trim().toLowerCase();
        if (!trimmedColor) {
            return;
        }

        const shouldNotify = options?.notify ?? true;
        updateCategoryInStore(category.id, { color: trimmedColor });
        clearCategoryIconPreview(category.id);

        const nextSeq = (categoryColorRequestSeqRef.current.get(category.id) ?? 0) + 1;
        categoryColorRequestSeqRef.current.set(category.id, nextSeq);

        try {
            const updated = await updateCategoryRequest(category.id, { color: trimmedColor });
            if (categoryColorRequestSeqRef.current.get(category.id) !== nextSeq) {
                return;
            }

            updateCategoryInStore(category.id, updated);
            if (shouldNotify) {
                addNotification({
                    type: 'success',
                    title: '分类颜色已更新',
                    description: updated.name,
                });
            }
            if (options?.closeMenu) {
                closeCategoryMenu();
            }
        } catch (error) {
            if (categoryColorRequestSeqRef.current.get(category.id) !== nextSeq) {
                return;
            }

            clearCategoryIconPreview(category.id);
            void fetchCategories()
                .then((nextCategories) => {
                    setCategories(nextCategories);
                })
                .catch(() => {
                    // Leave optimistic state if resync also fails.
                });
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const handlePickCategoryColor = async (category: Category, color: string) => {
        await persistCategoryColor(category, color, { closeMenu: true, notify: true });
    };

    const handleOpenCustomCategoryColorPicker = (category: Category) => {
        syncCategoryIconPreview(category);
        openCategoryMenuPanel(category.id, 'customColor');
    };

    const handlePreviewCustomCategoryColor = (category: Category, color: string) => {
        categoryIconPreviewColorsRef.current.set(category.id, color);
        syncCategoryIconPreview(category, color);
    };

    const handleCommitCustomCategoryColor = async (category: Category, color: string) => {
        if (!color || color === category.color) {
            clearCategoryIconPreview(category.id);
            return;
        }

        await persistCategoryColor(category, color, { notify: false });
    };

    const handleRequestDeleteCategory = (categoryId: number) => {
        clearCategoryIconPreview(categoryId);
        setCategoryMenu((current) => {
            if (!current || current.categoryId !== categoryId) {
                return current;
            }

            return {
                ...current,
                panel: current.panel === 'confirmDelete' ? 'actions' : 'confirmDelete',
            };
        });
    };

    const handleDeleteCategory = async (category: Category) => {
        if (pendingCategoryActionId === category.id) {
            return;
        }

        closeCategoryMenu();
        setPendingCategoryActionId(category.id);
        try {
            await deleteCategoryRequest(category.id);
            removeCategoryFromStore(category.id);
            if (activeNav === `category-${category.id}`) {
                setActiveNav('all');
            }
            addNotification({
                type: 'success',
                title: '分类已删除',
                description: category.name,
            });
            refreshCategoriesInBackground();
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setPendingCategoryActionId(null);
        }
    };

    return (
        <motion.aside
            animate={{ width: sidebarExpanded ? 256 : 68 }}
            transition={layoutTransition}
            className="flex-shrink-0 h-full surface-effect gpu-transform flex flex-col p-3 relative select-none no-drag"
        >
            {/* Sidebar Toggle Header */}
            <div className={clsx("flex items-center mb-4 px-1", sidebarExpanded ? "justify-between" : "justify-center")}>
                {sidebarExpanded && <span className="text-xs font-bold text-textPrimary/50 px-2 tracking-widest uppercase">{t('common.all_memes')}</span>}
                <IconButton
                    icon={sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarExpanded(!sidebarExpanded)}
                    className="opacity-50 hover:opacity-100"
                    title={sidebarExpanded ? "折叠侧边栏" : "展开侧边栏"}
                />
            </div>

            <LayoutGroup id="sidebar-active-nav">
                <div className="flex flex-col space-y-1">
                    <span className={getSectionLabelClass()}>{t('sidebar.repository_title')}</span>
                    <button
                        onClick={() => setActiveNav('all')}
                        className={getNavClass('all')}
                        title={!sidebarExpanded ? t('sidebar.all_memes_nav') : undefined}
                    >
                        {renderActiveIndicator('all')}
                        <span className="flex w-[16px] shrink-0 justify-center">
                            <LayoutList size={18} className={getIconClass('all')} />
                        </span>
                        {renderNavLabel(t('sidebar.all_memes_nav'))}
                    </button>
                    <button
                        onClick={() => setActiveNav('untagged')}
                        className={getNavClass('untagged')}
                        title={!sidebarExpanded ? t('sidebar.untagged') : undefined}
                    >
                        {renderActiveIndicator('untagged')}
                        <span className="flex w-[16px] shrink-0 justify-center">
                            <Tag size={18} className={getIconClass('untagged')} />
                        </span>
                        {renderNavLabel(t('sidebar.untagged'))}
                    </button>
                    <button
                        onClick={() => setActiveNav('trash')}
                        className={getNavClass('trash')}
                        title={!sidebarExpanded ? t('common.trash') : undefined}
                    >
                        {renderActiveIndicator('trash')}
                        <span className="flex w-[16px] shrink-0 justify-center">
                            <Trash2 size={18} className={getIconClass('trash')} />
                        </span>
                        {renderNavLabel(t('sidebar.trash'))}
                    </button>
                </div>

                <div className="flex flex-col mt-8 space-y-1">
                    <span className={getSectionLabelClass()}>{t('sidebar.shortcuts')}</span>
                    <button
                        onClick={() => setActiveNav('recent')}
                        className={getNavClass('recent')}
                        title={!sidebarExpanded ? t('common.recent') : undefined}
                    >
                        {renderActiveIndicator('recent')}
                        <span className="flex w-[16px] shrink-0 justify-center">
                            <Clock size={18} className={getIconClass('recent')} />
                        </span>
                        {renderNavLabel(t('sidebar.recent'))}
                    </button>
                    <button
                        onClick={() => setActiveNav('starred')}
                        className={getNavClass('starred')}
                        title={!sidebarExpanded ? t('common.starred') : undefined}
                    >
                        {renderActiveIndicator('starred')}
                        <span className="flex w-[16px] shrink-0 justify-center">
                            <Star size={18} className={getIconClass('starred')} />
                        </span>
                        {renderNavLabel(t('sidebar.starred'))}
                    </button>
                </div>

                {/* Scrollable Middle Content */}
                <div className="flex-1 flex flex-col min-h-0 mt-8">
                    <div
                        className={clsx(
                            "relative z-20 flex items-center justify-between px-1 transition-all duration-300",
                            sidebarExpanded ? "mb-3 min-h-7 opacity-100" : "mb-0 min-h-0 opacity-0 pointer-events-none"
                        )}
                    >
                        <span className="block px-2 text-[10px] font-bold uppercase tracking-[0.15em] leading-4 text-textSecondary opacity-60">
                            {t('sidebar.categories')}
                        </span>
                        <IconButton
                            icon={<Plus size={16} />}
                            variant="ghost"
                            size="sm"
                            onClick={handleStartCreateCategory}
                            className={clsx(
                                "shrink-0 transition-opacity duration-300 opacity-60 hover:opacity-100",
                                !sidebarExpanded && "opacity-0 pointer-events-none"
                            )}
                            title="创建分类"
                        />
                    </div>

                    <div
                        className={clsx(
                            "flex-1 overflow-y-auto pb-4 transition-all duration-300 relative no-scrollbar gpu-layer",
                            !sidebarExpanded && "overflow-hidden hover:overflow-y-auto"
                        )}
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                    >
                        <div className="space-y-1">
                            <AnimatePresence initial={false}>
                                {isAddingCategory && sidebarExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="px-1 pb-2 gpu-transform-opacity"
                                    >
                                        <div
                                            className="rounded-2xl border p-2 space-y-2"
                                            style={categoryComposerStyle}
                                        >
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={(event) => setNewCategoryName(event.target.value)}
                                                onBlur={() => void handleSubmitCategory()}
                                                onFocus={() => setIsCategoryInputFocused(true)}
                                                onBlurCapture={() => setIsCategoryInputFocused(false)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        void handleSubmitCategory();
                                                    }
                                                    if (event.key === 'Escape') {
                                                        setIsAddingCategory(false);
                                                        setNewCategoryName('');
                                                    }
                                                }}
                                                placeholder="新分类名称"
                                                autoFocus
                                                className="w-full h-10 rounded-xl border px-3 text-sm text-textPrimary placeholder:text-textSecondary/60 outline-none transition-all duration-300"
                                                style={categoryInputStyle}
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        setIsAddingCategory(false);
                                                        setNewCategoryName('');
                                                        setIsCategoryInputFocused(false);
                                                    }}
                                                    disabled={isSubmittingCategory}
                                                    className="h-8 px-3 rounded-lg text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    取消
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => void handleSubmitCategory()}
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

                            {sidebarExpanded && categories.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-textSecondary italic opacity-50">{t('common.categories')}</div>
                            ) : (
                                <div className="flex flex-col space-y-0.5">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                    >
                                        <SortableContext
                                            items={categories.map(c => c.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <AnimatePresence mode="popLayout">
                                                {categories.map((cat, index) => {
                                                    const navId = `category-${cat.id}`;
                                                    const isActive = activeNav === navId;
                                                    const isPending = pendingCategoryActionId === cat.id;
                                                    const isMenuOpen = categoryMenu?.categoryId === cat.id;
                                                    const isDeleteConfirmOpen = isMenuOpen && categoryMenu.panel === 'confirmDelete';
                                                    const isCustomColorPickerOpen = isMenuOpen && categoryMenu.panel === 'customColor';
                                                    const categoryDisplayColor = getCategoryBaseColor(cat);

                                                    return (
                                                        <SortableItem key={cat.id} id={cat.id}>
                                                            {(sortableProps) => (
                                                                <div ref={sortableProps.setNodeRef} style={sortableProps.style}>
                                                                    <motion.div
                                                                        layout
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                                        transition={{ duration: 0.2, delay: index * 0.03 }}
                                                                        className={clsx("relative group/category px-1 gpu-transform-opacity", sortableProps.isDragging && "z-50")}
                                                                        data-category-menu-root="true"
                                                                    >
                                                                        {editingCategoryId === cat.id ? (
                                                                            <div className="pb-2">
                                                                                <div
                                                                                    className="rounded-2xl border p-2 space-y-2"
                                                                                    style={categoryComposerStyle}
                                                                                >
                                                                                    <input
                                                                                        type="text"
                                                                                        value={editingCategoryName}
                                                                                        onChange={(event) => setEditingCategoryName(event.target.value)}
                                                                                        onBlur={() => void handleSubmitRenameCategory(cat)}
                                                                                        onKeyDown={(event) => {
                                                                                            if (event.key === 'Enter') {
                                                                                                event.preventDefault();
                                                                                                void handleSubmitRenameCategory(cat);
                                                                                            }
                                                                                            if (event.key === 'Escape') {
                                                                                                setEditingCategoryId(null);
                                                                                                setEditingCategoryName('');
                                                                                            }
                                                                                        }}
                                                                                        autoFocus
                                                                                        className="w-full h-10 rounded-xl border px-3 text-sm text-textPrimary placeholder:text-textSecondary/60 outline-none transition-all duration-300"
                                                                                        style={categoryInputStyle}
                                                                                    />
                                                                                    <div className="flex items-center justify-end gap-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                            onClick={() => {
                                                                                                setEditingCategoryId(null);
                                                                                                setEditingCategoryName('');
                                                                                            }}
                                                                                            disabled={isPending}
                                                                                            className="h-8 px-3 rounded-lg text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                                                        >
                                                                                            取消
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                            onClick={() => void handleSubmitRenameCategory(cat)}
                                                                                            disabled={isPending}
                                                                                            className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                                                        >
                                                                                            {isPending ? '保存中...' : '保存'}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => setActiveNav(navId)}
                                                                                    className={clsx(
                                                                                        getNavClass(navId),
                                                                                        sidebarExpanded && "pr-10",
                                                                                        sortableProps.isDragging && "bg-black/[0.03] dark:bg-white/[0.03] text-textPrimary shadow-sm"
                                                                                    )}
                                                                                    title={!sidebarExpanded ? cat.name : undefined}
                                                                                >
                                                                                    {renderActiveIndicator(navId)}
                                                                                    <span className="flex w-[16px] shrink-0 justify-center">
                                                                                        <Folder
                                                                                            size={18}
                                                                                            ref={(node) => {
                                                                                                if (node) {
                                                                                                    categoryIconRefs.current.set(cat.id, node);
                                                                                                    const previewColor = categoryIconPreviewColorsRef.current.get(cat.id);
                                                                                                    applyCategoryIconStyle(node, previewColor || categoryDisplayColor, isActive);
                                                                                                    return;
                                                                                                }

                                                                                                categoryIconRefs.current.delete(cat.id);
                                                                                            }}
                                                                                            className={clsx(
                                                                                                "transition-all duration-300",
                                                                                                isActive ? "scale-110 opacity-100" : "opacity-60 group-hover/category:opacity-100"
                                                                                            )}
                                                                                            style={{
                                                                                                color: categoryDisplayColor || 'var(--accent-color)',
                                                                                                fill: categoryDisplayColor ? `color-mix(in srgb, ${categoryDisplayColor}, transparent 85%)` : 'transparent',
                                                                                                filter: isActive ? `drop-shadow(0 0 4px ${categoryDisplayColor || 'var(--accent-color)'}80)` : 'none'
                                                                                            }}
                                                                                        />
                                                                                    </span>
                                                                                    {renderNavLabel(cat.name)}
                                                                                </button>

                                                                                {sidebarExpanded && (
                                                                                    <>
                                                                                        <div
                                                                                            {...sortableProps.attributes}
                                                                                            {...sortableProps.listeners}
                                                                                            className={clsx(
                                                                                                "absolute right-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing z-20 outline-none",
                                                                                                isMenuOpen
                                                                                                    ? "opacity-100 text-textSecondary"
                                                                                                    : "opacity-0 group-hover/category:opacity-100 text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5"
                                                                                            )}
                                                                                            title="拖动排序"
                                                                                        >
                                                                                            <GripVertical size={14} />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                            onClick={(event) => {
                                                                                                event.stopPropagation();
                                                                                                const rect = event.currentTarget.getBoundingClientRect();
                                                                                                handleToggleCategoryMenu(cat.id, {
                                                                                                    top: rect.top,
                                                                                                    left: rect.right + 8
                                                                                                });
                                                                                            }}
                                                                                            aria-label={`${cat.name} 分类菜单`}
                                                                                            aria-haspopup="menu"
                                                                                            aria-expanded={isMenuOpen}
                                                                                            className={clsx(
                                                                                                "absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 no-drag z-20",
                                                                                                isMenuOpen
                                                                                                    ? "opacity-100 bg-black/5 dark:bg-white/10 text-textPrimary"
                                                                                                    : "opacity-0 group-hover/category:opacity-100 text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5"
                                                                                            )}
                                                                                        >
                                                                                            <MoreHorizontal size={14} />
                                                                                        </button>
                                                                                        <Portal>
                                                                                            <AnimatePresence>
                                                                                                {isMenuOpen && categoryMenu && (
                                                                                                    <motion.div
                                                                                                        ref={categoryMenuRef}
                                                                                                        initial={{ opacity: 0, scale: 0.96, x: -8, y: -4 }}
                                                                                                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                                                                                                        exit={{ opacity: 0, scale: 0.98, x: -6, y: -2 }}
                                                                                                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                                                                                        className="fixed z-[9999] flex rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[color:var(--bg-surface)] shadow-2xl overflow-hidden backdrop-blur-md category-portal-menu gpu-transform-opacity"
                                                                                                        style={{
                                                                                                            top: `${categoryMenu.position.top}px`,
                                                                                                            left: `${categoryMenu.position.left}px`,
                                                                                                            width: 'auto'
                                                                                                        }}
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
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                                                            onClick={() => void handleDeleteCategory(cat)}
                                                                                                                            className="w-full flex items-center justify-center h-8 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                                                                                                        >
                                                                                                                            确定删除
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                                                            onClick={() => openCategoryMenuPanel(cat.id, 'actions')}
                                                                                                                            className="w-full flex items-center justify-center h-8 rounded-xl text-textSecondary hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition-colors"
                                                                                                                        >
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
                                                                                                                        className={clsx(
                                                                                                                            "flex flex-col gap-0.5 p-1.5 w-48",
                                                                                                                            isCustomColorPickerOpen && "border-r border-black/[0.05] dark:border-white/[0.05]"
                                                                                                                        )}
                                                                                                                    >
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                                                            onClick={() => handleStartRenameCategory(cat)}
                                                                                                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-textPrimary hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                                                                                                                        >
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
                                                                                                                                        onClick={() => void handlePickCategoryColor(cat, c)}
                                                                                                                                        className={clsx(
                                                                                                                                            "w-5 h-5 rounded-full border border-black/10 dark:border-white/10 transition-transform hover:scale-125 active:scale-95",
                                                                                                                                            categoryDisplayColor === c && "ring-2 ring-accent ring-offset-2 ring-offset-[color:var(--bg-surface)]"
                                                                                                                                        )}
                                                                                                                                        style={{ backgroundColor: c }}
                                                                                                                                        title={c}
                                                                                                                                    />
                                                                                                                                ))}
                                                                                                                                <button
                                                                                                                                    type="button"
                                                                                                                                    onClick={(e) => {
                                                                                                                                        e.stopPropagation();
                                                                                                                                        handleOpenCustomCategoryColorPicker(cat);
                                                                                                                                    }}
                                                                                                                                    aria-label={`自定义 ${cat.name} 颜色`}
                                                                                                                                    className={clsx(
                                                                                                                                        "w-5 h-5 rounded-full border border-dashed border-textSecondary/40 flex items-center justify-center transition-all hover:scale-125 text-textSecondary",
                                                                                                                                        isCustomColorPickerOpen && "bg-accent/10 border-accent/40 text-accent scale-110"
                                                                                                                                    )}
                                                                                                                                    title="自定义颜色"
                                                                                                                                >
                                                                                                                                    <Plus size={10} />
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                        <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] mx-2 my-1" />
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                                                            onClick={() => handleRequestDeleteCategory(cat.id)}
                                                                                                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-red-500 hover:bg-red-500/[0.08] transition-colors"
                                                                                                                        >
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
                                                                                                                                        onPreviewChange={(color) => {
                                                                                                                                            handlePreviewCustomCategoryColor(cat, color);
                                                                                                                                        }}
                                                                                                                                        onCommit={(color) => void handleCommitCustomCategoryColor(cat, color)}
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
                                                            )}
                                                        </SortableItem>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </LayoutGroup>

            <div className="mt-auto pt-4 border-t border-borderColor/20 dark:border-white/5">
                <span className={getSectionLabelClass('muted')}>{t('common.magic_store.title')}</span>
                <button
                    className={clsx(
                        "w-full h-11 flex items-center rounded-xl border border-dashed border-borderColor hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:border-accent/50 hover:text-accent transition-all duration-300 group no-drag px-3 text-left relative",
                        sidebarExpanded && "pr-10"
                    )}
                    title={!sidebarExpanded ? t('common.magic_store.bucket') : undefined}
                >
                    <span className="flex w-[16px] shrink-0 justify-center">
                        <ArchiveRestore size={18} className="opacity-50 group-hover:opacity-100 no-drag transition-all duration-300 group-hover:scale-110" />
                    </span>
                    {renderNavLabel(t('common.magic_store.bucket'))}
                    {sidebarExpanded && (
                        <span className={clsx(
                            "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold no-drag transition-all duration-300",
                            // Currently hardcoded to 0, use gray style. If > 0, use accent style.
                            "bg-black/[0.06] dark:bg-white/[0.1] text-textSecondary"
                        )}>
                            0
                        </span>
                    )}
                </button>
            </div>

        </motion.aside>
    );
}
