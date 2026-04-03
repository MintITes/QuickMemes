import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Archive, Trash2, X, ArchiveRestore, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import { useMemeStore } from '../../stores/MemeStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { useShallow } from 'zustand/react/shallow';
import {
    exportMemes,
    moveMemesToTrash,
    restoreMemesFromTrash,
    permanentlyDeleteMemes,
} from '../../services/memeService';

// ─── FloatActionBar ────────────────────────────────────────────────────────
// 仅当 selectedMemeIds.length >= 2 时从主区域底部居中弹出。
// 选项：复制（仅单选时启用，此处置灰提示）、导出、存入收集桶、删除

export function FloatActionBar() {
    const { t } = useTranslation();

    const { selectedMemeIds, clearSelection, activeNav } = useUiStore(
        useShallow((state) => ({
            selectedMemeIds: state.selectedMemeIds,
            clearSelection: state.clearSelection,
            activeNav: state.activeNav,
        }))
    );

    const removeMemes = useMemeStore((state) => state.removeMemes);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const isVisible = selectedMemeIds.length >= 2;
    const count = selectedMemeIds.length;
    const isTrashView = activeNav === 'trash';

    // ── 导出 ──────────────────────────────────────────────────────────────
    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const destDir = await window.electronAPI.openDirectoryDialog({
                title: t('gallery.context_menu.export_title') || 'Select Export Directory',
            });
            if (!destDir) return;

            const result = await exportMemes(selectedMemeIds, destDir);
            addNotification({
                type: result.failed === 0 ? 'success' : 'info',
                title: t('gallery.context_menu.export_success'),
                description: t('gallery.context_menu.export_result', {
                    success: result.succeeded,
                    failed: result.failed,
                }),
            });
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.export_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsExporting(false);
        }
    };

    // ── 存入收集桶 ────────────────────────────────────────────────────────
    const handleAddToBucket = () => {
        // 当前魔法桶功能尚未完整实现，给出功能提示
        addNotification({
            type: 'info',
            title: t('fab.bucket_added', { count }),
            description: t('fab.bucket_added_desc'),
        });
        clearSelection();
    };

    // ── 恢复 ──────────────────────────────────────────────────────────────
    const handleRestore = async () => {
        if (isRestoring) return;
        setIsRestoring(true);
        try {
            await restoreMemesFromTrash(selectedMemeIds);
            // 局部刷新或全局更新：此处目前由 MemeStore 接管逻辑（或者后端返回后手动更新）
            // 在回收站视图恢复后，这些梗图应该从列表中移除（因为它们不再属于 trash）
            removeMemes(selectedMemeIds);
            addNotification({
                type: 'success',
                title: t('gallery.context_menu.restore_success'),
                description: t('fab.restore_success', { count }),
            });
            clearSelection();
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('common.save_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsRestoring(false);
        }
    };

    // ── 删除 / 永久删除 ───────────────────────────────────────────────────
    const handleDelete = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            if (isTrashView) {
                // 彻底删除
                const { succeeded, failed } = await permanentlyDeleteMemes(selectedMemeIds);
                removeMemes(selectedMemeIds);
                addNotification({
                    type: succeeded > 0 ? 'success' : 'error',
                    title: succeeded > 0 ? t('fab.delete_permanently_success', { count: succeeded }) : t('fab.delete_failed'),
                    description: failed > 0 ? `Failed: ${failed}` : undefined,
                });
            } else {
                // 移入回收站
                await moveMemesToTrash(selectedMemeIds);
                removeMemes(selectedMemeIds);
                addNotification({
                    type: 'success',
                    title: t('gallery.context_menu.trash_success'),
                    description: t('gallery.context_menu.n_items', { count }),
                });
            }
            clearSelection();
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('fab.delete_failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key="float-action-bar"
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.97 }}
                    transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                    // ⚠️ 不使用 backdrop-blur：<main> 有 gpu-layer 形成独立合成层，
                    // backdrop-blur 在其内部会将文字/图标纳入采样导致内容模糊，
                    // 动画结束后 will-change 撤销又产生闪烁。改用纯固体色彻底规避。
                    className="absolute bottom-6 left-1/2 z-30 pointer-events-auto"
                    style={{ translateX: '-50%' }}
                >
                    {/* 外层容器：与灯箱操作条相同的暗色底 + 细白边 + 强阴影语言 */}
                    <div
                        className="flex items-center bg-zinc-800 dark:bg-zinc-900 border border-white/10 rounded-2xl p-1.5 shadow-2xl"
                    >
                        {/* ── 计数区 ── */}
                        <div className="flex items-center justify-center gap-1.5 px-2 border-r border-white/10 select-none">
                            <span className="text-[15px] font-black text-white tabular-nums leading-none">
                                {count}
                            </span>
                            <span className="text-[11px] font-medium text-white/50 leading-none">
                                {t('fab.selected')}
                            </span>
                        </div>

                        {/* ── 操作按钮组（普通操作） ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-white/10">
                            {/* ── 复制（多选时置灰） ── */}
                            {!isTrashView && (
                                <FabButton
                                    icon={<Copy size={16} />}
                                    label={t('fab.copy')}
                                    disabled
                                    title={t('fab.copy_disabled_hint')}
                                />
                            )}

                            {/* ── 导出 ── */}
                            <FabButton
                                icon={<Download size={16} />}
                                label={t('fab.export')}
                                loading={isExporting}
                                onClick={handleExport}
                            />

                            {/* ── 存入收集桶 ── */}
                            {!isTrashView && (
                                <FabButton
                                    icon={<Archive size={16} />}
                                    label={t('fab.bucket')}
                                    onClick={handleAddToBucket}
                                    accent
                                />
                            )}

                            {/* ── 恢复 (回收站专用) ── */}
                            {isTrashView && (
                                <FabButton
                                    icon={<ArchiveRestore size={16} />}
                                    label={t('fab.restore')}
                                    loading={isRestoring}
                                    onClick={handleRestore}
                                    accent
                                />
                            )}
                        </div>

                        {/* ── 危险操作区 ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-white/10">
                            <FabButton
                                icon={isTrashView ? <AlertCircle size={16} /> : <Trash2 size={16} />}
                                label={isTrashView ? t('fab.delete_permanently') : t('fab.delete')}
                                danger
                                loading={isDeleting}
                                onClick={handleDelete}
                            />
                        </div>

                        {/* ── 取消选择 ── */}
                        <div className="flex items-center px-1">
                            <button
                                onClick={clearSelection}
                                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none"
                                title={t('fab.cancel_selection')}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── FabButton ─────────────────────────────────────────────────────────────

interface FabButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    accent?: boolean;
    loading?: boolean;
    title?: string;
}

function FabButton({ icon, label, onClick, disabled, danger, accent, loading, title }: FabButtonProps) {
    // 与灯箱操作条保持相同的按钮语言：水平排列图标+文字，白色文字层
    const stateClasses = (() => {
        if (disabled) return 'text-white/25 cursor-not-allowed';
        if (danger)   return 'text-red-400 hover:text-red-300 hover:bg-red-500/15';
        if (accent)   return 'text-sky-300 hover:text-sky-200 hover:bg-white/10';
        return 'text-white/70 hover:text-white hover:bg-white/10';
    })();

    return (
        <button
            className={[
                'flex items-center justify-center gap-1.5 px-2.5 py-2',
                'rounded-xl transition-colors duration-150 active:scale-95',
                'outline-none focus-visible:ring-1 focus-visible:ring-white/50',
                'select-none whitespace-nowrap',
                stateClasses,
            ].join(' ')}
            onClick={disabled || loading ? undefined : onClick}
            disabled={disabled || loading}
            title={title}
        >
            <span className={loading ? 'animate-pulse' : ''}>{icon}</span>
            <span className="text-sm">
                {loading ? '...' : label}
            </span>
        </button>
    );
}
