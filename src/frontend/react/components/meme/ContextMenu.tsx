import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, Save, Tags, Maximize2, FolderInput, Trash2, ChevronRight, Folder, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import clsx from 'clsx';
import { Portal } from '../common/Portal';
import { resolveContextMenuPosition } from './contextMenuPosition';
import { moveMemeToTrash, restoreMemeFromTrash, moveMemesToTrash, restoreMemesFromTrash, exportMemes, moveMemesToCategory, updateMeme as updateMemeService } from '../../services/memeService';

// ContextMenuItem
interface ContextMenuItemProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    danger?: boolean;
    hasSubMenu?: boolean;
    isActive?: boolean;
    onMouseEnter?: () => void;
}

function ContextMenuItem({ icon, label, onClick, danger, hasSubMenu, isActive, onMouseEnter }: ContextMenuItemProps) {
    return (
        <button
            className={clsx(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors duration-150 outline-none cursor-default",
                danger
                    ? "text-red-500 hover:bg-red-500/10 focus:bg-red-500/10"
                    : "text-textPrimary hover:bg-black/5 dark:hover:bg-white/10 focus:bg-black/5 dark:focus:bg-white/10",
                isActive && !danger && "bg-black/5 dark:bg-white/10",
                isActive && danger && "bg-red-500/10"
            )}
            onClick={() => {
                if (onClick) onClick();
            }}
            onMouseEnter={onMouseEnter}
            tabIndex={-1}
        >
            <div className="flex items-center gap-3">
                <span className="opacity-80">{icon}</span>
                <span className="font-medium">{label}</span>
            </div>
            {hasSubMenu && <ChevronRight size={16} className="opacity-50" />}
        </button>
    );
}

// Main ContextMenu Component
export function ContextMenu() {

    const { t } = useTranslation();
    const menuInfo = useUiStore(state => state.contextMenu);
    const setContextMenu = useUiStore(state => state.setContextMenu);
    const setLightboxMemeId = useUiStore(state => state.setLightboxMemeId);
    const selectMeme = useUiStore(state => state.selectMeme);
    const selectedMemeIds = useUiStore(state => state.selectedMemeIds);
    const activeNav = useUiStore(state => state.activeNav);
    const togglePanel = useUiStore(state => state.togglePanel);
    const updateMeme = useMemeStore(state => state.updateMeme);
    const removeMemes = useMemeStore(state => state.removeMemes);
    const memes = useMemeStore(state => state.memes);
    const categories = useCategoryStore(state => state.categories);
    const addNotification = useNotificationStore(state => state.addNotification);

    const menuRef = useRef<HTMLDivElement>(null);
    const subMenuTimerRef = useRef<number | null>(null);

    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [subMenuFocusedIndex, setSubMenuFocusedIndex] = useState(-1);
    const isTrashView = activeNav === 'trash';
    const isMultiSelect = selectedMemeIds.length > 1;

    // Calculate smart positioning
    const { position, subMenuPosition } = useMemo(() => {
        if (!menuInfo) return { position: { top: 0, left: 0 }, subMenuPosition: { side: 'right' as const } };

        const menuWidth = 220;
        const menuHeight = isMultiSelect ? 160 : 260; // Shorter for multi-select
        const subMenuWidth = 200;
        const padding = 12;
        const resolvedPosition = resolveContextMenuPosition(
            menuInfo,
            { width: window.innerWidth, height: window.innerHeight },
            { width: menuWidth, height: menuHeight },
            padding
        );
        const left = resolvedPosition.left;
        const top = resolvedPosition.top;

        let subMenuSide: 'left' | 'right' = 'right';
        if (left + menuWidth + subMenuWidth + padding > window.innerWidth) {
            subMenuSide = 'left';
        }

        return {
            position: { left, top },
            subMenuPosition: { side: subMenuSide }
        };
    }, [menuInfo, isMultiSelect]);

    const closeMenu = useCallback(() => {
        setContextMenu(null);
        setIsSubMenuOpen(false);
        setFocusedIndex(-1);
        setSubMenuFocusedIndex(-1);
    }, [setContextMenu]);

    // Close on outside click or scroll or blur
    useEffect(() => {
        if (!menuInfo) return;

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeMenu();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };

        // Defer attachment to prevent immediate close if opened via click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('touchstart', handleOutsideClick);
            document.addEventListener('keydown', handleEscape);
            window.addEventListener('scroll', closeMenu, { capture: true });
            window.addEventListener('resize', closeMenu);
            window.addEventListener('blur', closeMenu);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', closeMenu, { capture: true });
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('blur', closeMenu);
        };
    }, [menuInfo, closeMenu]);


    const handleMouseEnterMenuItem = (index: number, hasSubMenu: boolean) => {
        setFocusedIndex(index);

        if (subMenuTimerRef.current) {
            clearTimeout(subMenuTimerRef.current);
        }

        if (hasSubMenu) {
            subMenuTimerRef.current = window.setTimeout(() => {
                setIsSubMenuOpen(true);
            }, 300); // 300ms hover delay to open
        } else {
            subMenuTimerRef.current = window.setTimeout(() => {
                setIsSubMenuOpen(false);
            }, 200); // 200ms grace period before closing
        }
    };

    const targetMeme = useMemo(() => {
        return menuInfo ? memes.find(m => m.id === menuInfo.memeId) : null;
    }, [menuInfo, memes]);

    const executeAction = async (index: number) => {
        if (!targetMeme) return;

        const idsToProcess = isMultiSelect ? selectedMemeIds : [targetMeme.id];

        switch (index) {
            case 0: // Copy
                if (isMultiSelect) break; // Disabled in UI, but safety check
                try {
                    await window.electronAPI.writeClipboardImageFromMeme(targetMeme.id);
                    addNotification({
                        type: 'success',
                        title: t('gallery.item.copy_success'),
                        description: targetMeme.name,
                    });
                } catch {
                    addNotification({ type: 'error', title: t('common.copy_failed') });
                }
                break;
            case 1: // Export
                try {
                    const destDir = await window.electronAPI.openDirectoryDialog({
                        title: t('gallery.context_menu.export_title') || 'Select Export Directory'
                    });
                    if (!destDir) break;

                    const result = await exportMemes(idsToProcess, destDir);
                    addNotification({
                        type: result.failed === 0 ? 'success' : 'info',
                        title: t('gallery.context_menu.export_success'),
                        description: t('gallery.context_menu.export_result', {
                            success: result.succeeded,
                            failed: result.failed
                        }),
                    });
                } catch (error) {
                    addNotification({
                        type: 'error',
                        title: t('common.export_failed'),
                        description: error instanceof Error ? error.message : String(error)
                    });
                }
                break;
            case 2: // Edit tags
                if (isMultiSelect) break;
                if (selectedMemeIds.length !== 1 || selectedMemeIds[0] !== targetMeme.id) {
                    selectMeme(targetMeme.id);
                }
                togglePanel(true);
                break;
            case 3: // View original
                if (isMultiSelect) break;
                setLightboxMemeId(targetMeme.id);
                break;
            case 4: // Move to (Handled by submenu hover)
                setIsSubMenuOpen(!isSubMenuOpen);
                return; // Do not close menu yet
            case 5:
                if (isTrashView) {
                    try {
                        if (isMultiSelect) {
                            await restoreMemesFromTrash(selectedMemeIds);
                            removeMemes(selectedMemeIds);
                        } else {
                            await restoreMemeFromTrash(targetMeme.id);
                            removeMemes([targetMeme.id]);
                        }
                        addNotification({
                            type: 'success',
                            title: t('gallery.context_menu.restore_success'),
                            description: isMultiSelect ? t('gallery.context_menu.n_items', { count: selectedMemeIds.length }) : targetMeme.name,
                        });
                    } catch (error) {
                        addNotification({
                            type: 'error',
                            title: t('gallery.context_menu.restore'),
                            description: error instanceof Error ? error.message : String(error),
                        });
                    }
                    break;
                }

                try {
                    if (isMultiSelect) {
                        await moveMemesToTrash(selectedMemeIds);
                        removeMemes(selectedMemeIds);
                    } else {
                        await moveMemeToTrash(targetMeme.id);
                        removeMemes([targetMeme.id]);
                    }
                    addNotification({
                        type: 'success',
                        title: t('gallery.context_menu.trash_success'),
                        description: isMultiSelect ? t('gallery.context_menu.n_items', { count: selectedMemeIds.length }) : targetMeme.name,
                    });
                } catch (error) {
                    addNotification({
                        type: 'error',
                        title: t('gallery.context_menu.move_to_trash'),
                        description: error instanceof Error ? error.message : String(error),
                    });
                }
                break;
        }

        if (index !== 4) closeMenu();
    };

    const handleMoveToCategory = async (categoryId: number) => {
        if (!targetMeme) return;
        const idsToProcess = isMultiSelect ? selectedMemeIds : [targetMeme.id];

        try {
            if (isMultiSelect) {
                await moveMemesToCategory(idsToProcess, categoryId);
            } else {
                await updateMemeService(targetMeme.id, { categoryId });
            }

            // Decide whether to remove or update in store based on current view
            let shouldRemove = false;
            if (activeNav === 'untagged') {
                shouldRemove = true;
            } else if (activeNav.startsWith('category-')) {
                const currentCatId = parseInt(activeNav.replace('category-', ''));
                if (currentCatId !== categoryId) {
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                removeMemes(idsToProcess);
            } else {
                idsToProcess.forEach(id => updateMeme(id, { categoryId }));
            }

            addNotification({
                type: 'success',
                title: t('gallery.context_menu.move_success'),
                description: isMultiSelect ? t('gallery.context_menu.n_items', { count: idsToProcess.length }) : targetMeme.name,
            });
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('gallery.context_menu.move_failed'),
            });
        }
        closeMenu();
    };




    // Handle Keyboard Navigation
    useEffect(() => {
        if (!menuInfo) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const menuLength = 6; // Number of items in main menu
            const subMenuLength = categories.length;

            if (isSubMenuOpen) {
                // Navigating SubMenu
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSubMenuFocusedIndex(prev => (prev + 1) % subMenuLength);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSubMenuFocusedIndex(prev => (prev - 1 + subMenuLength) % subMenuLength);
                } else if (e.key === 'ArrowLeft' && subMenuPosition.side === 'right') {
                    e.preventDefault();
                    setIsSubMenuOpen(false);
                } else if (e.key === 'ArrowRight' && subMenuPosition.side === 'left') {
                    e.preventDefault();
                    setIsSubMenuOpen(false);
                } else if (e.key === 'Enter' && subMenuFocusedIndex >= 0) {
                    e.preventDefault();
                    handleMoveToCategory(categories[subMenuFocusedIndex].id);
                }
            } else {
                // Navigating MainMenu
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev + 1) % menuLength);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev - 1 + menuLength) % menuLength);
                } else if (e.key === 'ArrowRight' && focusedIndex === 4 && subMenuPosition.side === 'right') {
                    e.preventDefault();
                    setIsSubMenuOpen(true);
                    setSubMenuFocusedIndex(0);
                } else if (e.key === 'ArrowLeft' && focusedIndex === 4 && subMenuPosition.side === 'left') {
                    e.preventDefault();
                    setIsSubMenuOpen(true);
                    setSubMenuFocusedIndex(0);
                } else if (e.key === 'Enter' && focusedIndex >= 0) {
                    e.preventDefault();
                    executeAction(focusedIndex);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuInfo, isSubMenuOpen, focusedIndex, subMenuFocusedIndex, categories, subMenuPosition, selectedMemeIds, isTrashView]);

    if (!menuInfo || !targetMeme) return null;

    return (
        <Portal>
            <AnimatePresence>
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="fixed z-[9999] w-[220px] rounded-xl p-1.5 shadow-2xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-black/10 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5"
                    style={{ left: position.left, top: position.top }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div className="flex flex-col gap-0.5">
                        {!isMultiSelect && (
                            <>
                                <ContextMenuItem
                                    icon={<Clipboard size={16} />}
                                    label={t('gallery.context_menu.copy')}
                                    isActive={focusedIndex === 0}
                                    onMouseEnter={() => handleMouseEnterMenuItem(0, false)}
                                    onClick={() => executeAction(0)}
                                />
                                <div className="h-px bg-black/5 dark:bg-white/10 my-0.5" />
                                <ContextMenuItem
                                    icon={<Tags size={16} />}
                                    label={t('gallery.context_menu.edit_tags')}
                                    isActive={focusedIndex === 2}
                                    onMouseEnter={() => handleMouseEnterMenuItem(2, false)}
                                    onClick={() => executeAction(2)}
                                />
                                <ContextMenuItem
                                    icon={<Maximize2 size={16} />}
                                    label={t('gallery.context_menu.view_original')}
                                    isActive={focusedIndex === 3}
                                    onMouseEnter={() => handleMouseEnterMenuItem(3, false)}
                                    onClick={() => executeAction(3)}
                                />
                                <div className="h-px bg-black/5 dark:bg-white/10 my-0.5" />
                            </>
                        )}

                        <ContextMenuItem
                            icon={<Save size={16} />}
                            label={t('gallery.context_menu.export')}
                            isActive={focusedIndex === 1}
                            onMouseEnter={() => handleMouseEnterMenuItem(1, false)}
                            onClick={() => executeAction(1)}
                        />

                        {/* SubMenu anchor */}
                        <div className="relative">
                            <ContextMenuItem
                                icon={<FolderInput size={16} />}
                                label={t('gallery.context_menu.move_to')}
                                hasSubMenu
                                isActive={focusedIndex === 4 || isSubMenuOpen}
                                onMouseEnter={() => handleMouseEnterMenuItem(4, true)}
                                onClick={() => executeAction(4)}
                            />

                            {/* SubMenu Rendering */}
                            <AnimatePresence>
                                {isSubMenuOpen && categories.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: subMenuPosition.side === 'right' ? -10 : 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: subMenuPosition.side === 'right' ? -10 : 10 }}
                                        transition={{ duration: 0.15 }}
                                        className={clsx(
                                            "absolute top-0 w-[200px] rounded-xl p-1.5 shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl border border-black/10 dark:border-white/10 max-h-[300px] overflow-y-auto scrollbar-hide",
                                            subMenuPosition.side === 'right' ? "left-full ml-1.5" : "right-full mr-1.5"
                                        )}
                                        onMouseEnter={() => {
                                            if (subMenuTimerRef.current) clearTimeout(subMenuTimerRef.current);
                                            setIsSubMenuOpen(true);
                                        }}
                                        onMouseLeave={() => {
                                            subMenuTimerRef.current = window.setTimeout(() => setIsSubMenuOpen(false), 300);
                                        }}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            {categories.map((cat, i) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => handleMoveToCategory(cat.id)}
                                                    onMouseEnter={() => setSubMenuFocusedIndex(i)}
                                                    className={clsx(
                                                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors outline-none",
                                                        (subMenuFocusedIndex === i) ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10",
                                                        (!isMultiSelect && targetMeme.categoryId === cat.id) ? "opacity-50 cursor-not-allowed" : "cursor-default text-textPrimary"
                                                    )}
                                                    disabled={!isMultiSelect && targetMeme.categoryId === cat.id}
                                                >
                                                    <div className="flex items-center gap-3 truncate">
                                                        <Folder size={14} className="opacity-80 flex-shrink-0" />
                                                        <span className="truncate">{cat.name}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="h-px bg-black/5 dark:bg-white/10 my-0.5" />
                        <ContextMenuItem
                            icon={isTrashView ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                            label={isTrashView ? t('gallery.context_menu.restore') : t('gallery.context_menu.move_to_trash')}
                            danger={!isTrashView}
                            isActive={focusedIndex === 5}
                            onMouseEnter={() => handleMouseEnterMenuItem(5, false)}
                            onClick={() => executeAction(5)}
                        />
                    </div>

                </motion.div>
            </AnimatePresence>
        </Portal>
    );
}
