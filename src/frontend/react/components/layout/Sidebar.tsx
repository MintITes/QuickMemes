import { useState, memo } from 'react';
import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { LayoutList, Tag, Trash2, Clock, Star, ArchiveRestore, PanelLeft, PanelLeftClose, Plus, type LucideIcon } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { fetchCategories, updateCategory as updateCategoryRequest } from '../../services/categoryService';
import { useNotificationStore } from '../../stores/NotificationStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { CSSProperties, ReactNode } from 'react';

import { SidebarCategoryCreator } from './SidebarCategoryCreator';
import { SidebarCategoryItem } from './SidebarCategoryItem';

const layoutTransition = {
    duration: 0.3,
    ease: [0.23, 1, 0.32, 1] as const,
};

function SortableItem({
    id,
    children,
}: {
    id: number;
    children: (props: {
        attributes: DraggableAttributes;
        listeners: SyntheticListenerMap | undefined;
        setNodeRef: (node: HTMLElement | null) => void;
        style: CSSProperties;
        isDragging: boolean;
    }) => ReactNode;
}) {
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

type SidebarNavItemData = {
    id: string;
    label: string;
    title?: string;
    icon: LucideIcon;
};

const SidebarNavItem = memo(({ item, sidebarExpanded }: { item: SidebarNavItemData, sidebarExpanded: boolean }) => {
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const isActive = activeNav === String(item.id);

    return (
        <button
            onClick={() => setActiveNav(item.id)}
            className={clsx(
                "w-full flex h-9 items-center text-left rounded-lg text-[13px] transition-all duration-300 group relative no-drag mb-0.5 px-3 select-none",
                isActive
                    ? "font-semibold text-textPrimary z-10"
                    : "text-textPrimary/60 hover:text-textPrimary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:translate-x-1"
            )}
            title={item.title}
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
                <item.icon size={18} className={clsx(
                    "transition-all duration-300 flex-shrink-0",
                    isActive ? "scale-110 text-accent opacity-100" : "opacity-50 group-hover:opacity-100 group-hover:scale-105"
                )} />
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
                {item.label}
            </motion.span>
        </button>
    );
});

export function Sidebar() {
    const { t } = useTranslation();
    const sidebarExpanded = useUiStore(state => state.sidebarExpanded);
    const setSidebarExpanded = useUiStore(state => state.setSidebarExpanded);
    const categories = useCategoryStore(state => state.categories);
    const setCategories = useCategoryStore(state => state.setCategories);
    const addNotification = useNotificationStore(state => state.addNotification);

    const [isAddingCategory, setIsAddingCategory] = useState(false);

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

    const refreshCategoriesInBackground = () => {
        void fetchCategories()
            .then((nextCategories) => {
                setCategories(nextCategories);
            })
            .catch(() => { });
    };

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

    const getSectionLabelClass = (tone: 'default' | 'muted' = 'default') => clsx(
        "block px-3 text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden leading-4 transition-[height,margin,opacity] duration-300",
        tone === 'default' ? "text-textSecondary" : "text-textSecondary",
        sidebarExpanded
            ? clsx(tone === 'default' ? "opacity-60 h-4 mb-3" : "opacity-50 h-4 mb-3")
            : "opacity-0 h-0 mb-0 pointer-events-none"
    );

    const renderNavLabel = (label: string) => (
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
            {label}
        </motion.span>
    );

    const handleStartCreateCategory = () => {
        if (!sidebarExpanded) {
            setSidebarExpanded(true);
        }
        setIsAddingCategory(true);
    };

    const MAIN_NAV_ITEMS: SidebarNavItemData[] = [
        { id: 'all', label: t('sidebar.all_memes_nav'), title: !sidebarExpanded ? t('sidebar.all_memes_nav') : undefined, icon: LayoutList },
        { id: 'untagged', label: t('sidebar.untagged'), title: !sidebarExpanded ? t('sidebar.untagged') : undefined, icon: Tag },
        { id: 'trash', label: t('sidebar.trash'), title: !sidebarExpanded ? t('common.trash') : undefined, icon: Trash2 },
    ];

    const SHORTCUT_NAV_ITEMS: SidebarNavItemData[] = [
        { id: 'recent', label: t('sidebar.recent'), title: !sidebarExpanded ? t('common.recent') : undefined, icon: Clock },
        { id: 'starred', label: t('sidebar.starred'), title: !sidebarExpanded ? t('common.starred') : undefined, icon: Star },
    ];

    const renderNavSection = (items: readonly SidebarNavItemData[]) => (
        <>
            {items.map(item => (
                <SidebarNavItem key={item.id} item={item} sidebarExpanded={sidebarExpanded} />
            ))}
        </>
    );

    return (
        <motion.aside
            initial={false}
            animate={{ width: sidebarExpanded ? 256 : 68 }}
            transition={layoutTransition}
            className="flex-shrink-0 h-full surface-effect gpu-transform flex flex-col p-3 relative select-none no-drag overflow-hidden"
            style={{ willChange: 'width' }}
        >
            <motion.div
                layout
                transition={layoutTransition}
                className={clsx("flex items-center mb-4 px-1 h-8", sidebarExpanded ? "justify-between" : "justify-center")}
            >
                <AnimatePresence mode="popLayout">
                    {sidebarExpanded && (
                        <motion.div
                            key="title"
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 0.5, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={layoutTransition}
                            className="flex items-center min-w-0 overflow-hidden"
                        >
                            <span className="text-xs font-bold text-textPrimary px-2 tracking-widest uppercase truncate">
                                {t('common.all_memes')}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
                <motion.div layout transition={layoutTransition}>
                    <IconButton
                        icon={sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarExpanded(!sidebarExpanded)}
                        className="opacity-50 hover:opacity-100 shrink-0"
                        title={sidebarExpanded ? "折叠侧边栏" : "展开侧边栏"}
                    />
                </motion.div>
            </motion.div>

            <LayoutGroup id="sidebar-active-nav">
                <div className="flex flex-col space-y-1">
                    <span className={getSectionLabelClass()}>{t('sidebar.repository_title')}</span>
                    {renderNavSection(MAIN_NAV_ITEMS)}
                </div>

                <div className="flex flex-col mt-8 space-y-1">
                    <span className={getSectionLabelClass()}>{t('sidebar.shortcuts')}</span>
                    {renderNavSection(SHORTCUT_NAV_ITEMS)}
                </div>

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
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <div className="space-y-1">
                            <SidebarCategoryCreator
                                sidebarExpanded={sidebarExpanded}
                                isAddingCategory={isAddingCategory}
                                setIsAddingCategory={setIsAddingCategory}
                                refreshCategoriesInBackground={refreshCategoriesInBackground}
                            />

                            <div className="flex flex-col space-y-0.5">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                >
                                    <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                        <AnimatePresence mode="popLayout">
                                            {categories.map((cat, index) => (
                                                <SortableItem key={cat.id} id={cat.id}>
                                                    {(sortableProps) => (
                                                        <SidebarCategoryItem
                                                            cat={cat}
                                                            index={index}
                                                            sortableProps={sortableProps}
                                                            sidebarExpanded={sidebarExpanded}
                                                            refreshCategoriesInBackground={refreshCategoriesInBackground}
                                                        />
                                                    )}
                                                </SortableItem>
                                            ))}
                                        </AnimatePresence>
                                    </SortableContext>
                                </DndContext>
                            </div>
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
