import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as LinkIcon, X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/UiStore';
import { IconButton } from './IconButton';
import { importUrls } from '../../services/importService';
import { useNotificationStore } from '../../stores/NotificationStore';
import { useTaskStore } from '../../stores/TaskStore';

export function UrlImportDialog() {
    const { t } = useTranslation();
    const { isUrlImportDialogOpen, toggleUrlImportDialog, setImporting } = useUiStore();
    const [url, setUrl] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const addNotification = useNotificationStore(state => state.addNotification);

    const [prevOpen, setPrevOpen] = useState(isUrlImportDialogOpen);
    if (!isUrlImportDialogOpen && prevOpen) {
        setUrl('');
        setPrevOpen(false);
    } else if (isUrlImportDialogOpen && !prevOpen) {
        setPrevOpen(true);
    }

    // Auto-focus input when dialog opens
    useEffect(() => {
        if (isUrlImportDialogOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isUrlImportDialogOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isUrlImportDialogOpen) {
                toggleUrlImportDialog(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isUrlImportDialogOpen, toggleUrlImportDialog]);

    const handleImport = async () => {
        if (!url.trim()) return;
        try {
            const task = await importUrls([url.trim()]);
            setImporting(true, task.taskId);
            useTaskStore.getState().setTask(task);
            addNotification({
                type: 'info',
                title: t('import.processing'),
                description: `任务 ${task.taskId} 已开始`,
            });
            toggleUrlImportDialog(false);
        } catch (error) {
            addNotification({
                type: 'error',
                title: t('import.failed'),
                description: error instanceof Error ? error.message : String(error),
            });
        }
    };

    return (
        <AnimatePresence>
            {isUrlImportDialogOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                        onClick={() => toggleUrlImportDialog(false)}
                    />

                    {/* Dialog Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-[400px] surface-effect shadow-2xl overflow-hidden flex flex-col no-drag"
                        style={{ borderRadius: 'var(--corner-radius)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-borderColor bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-textPrimary">
                                <LinkIcon size={18} className="text-accent" />
                                <span className="text-sm font-bold tracking-tight">
                                    {t('import.url_dialog_title')}
                                </span>
                            </div>
                            <IconButton
                                icon={<X size={16} />}
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleUrlImportDialog(false)}
                            />
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col gap-4">
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder={t('import.url_placeholder')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                                    className="w-full bg-black/10 dark:bg-black/20 border border-borderColor rounded-xl px-4 py-3 text-sm text-textPrimary placeholder:text-textSecondary outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none">
                                    <Download size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-borderColor bg-black/5 flex items-center justify-end gap-2">
                            <button
                                onClick={() => toggleUrlImportDialog(false)}
                                className="px-4 py-2 text-sm font-medium text-textSecondary hover:text-textPrimary hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
                            >
                                {t('import.cancel')}
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!url.trim()}
                                className="px-6 py-2 text-sm font-bold text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent rounded-xl shadow-lg shadow-accent/20 transition-all duration-200"
                            >
                                {t('import.confirm')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
