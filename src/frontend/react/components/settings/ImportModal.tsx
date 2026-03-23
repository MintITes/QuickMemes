import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/UiStore';
import { IconButton } from '../common/IconButton';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { importFiles } from '../../services/importService';
import { useNotificationStore } from '../../stores/NotificationStore';
import { useTaskStore } from '../../stores/TaskStore';

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'];

function extractPathsFromFileList(files: File[]) {
    return files
        .map((file) => {
            const path = window.electronAPI.getPathForFile(file);
            return path?.trim() ?? '';
        })
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function extractPathsFromUriList(raw: string) {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('file://'))
        .map((line) => {
            try {
                return decodeURIComponent(new URL(line).pathname);
            } catch {
                return '';
            }
        })
        .filter((value) => value.length > 0);
}

export function ImportModal() {
    const { isImportModalOpen, toggleImportModal, setImporting } = useUiStore();
    const [isDragging, setIsDragging] = useState(false);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const { t } = useTranslation();
    const addNotification = useNotificationStore(state => state.addNotification);

    useEffect(() => {
        if (!isImportModalOpen) {
            // Reset status when modal closes
            setTimeout(() => {
                setImportStatus('idle');
                setErrorMessage('');
            }, 300);
        }
    }, [isImportModalOpen]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const rawUriList = e.dataTransfer.getData('text/uri-list');
        void processFiles(files, rawUriList);
    };

    const submitImport = async (inputPaths: string[]) => {
        if (inputPaths.length === 0) {
            setImportStatus('error');
            setErrorMessage('无法读取文件绝对路径，请改用“选择文件”导入。');
            return;
        }

        try {
            const task = await importFiles(inputPaths);
            setImportStatus('success');
            setImporting(true, task.taskId);
            useTaskStore.getState().setTask(task);
            addNotification({
                type: 'info',
                title: t('import.processing'),
                description: `任务 ${task.taskId} 已开始`,
            });

            setTimeout(() => {
                toggleImportModal(false);
            }, 1000);
        } catch (error) {
            setImportStatus('error');
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
    };

    const processFiles = async (files: File[], rawUriList?: string) => {
        const validFiles = files.filter((f) => SUPPORTED_TYPES.includes(f.type));

        if (validFiles.length === 0) {
            setImportStatus('error');
            setErrorMessage(t('import.invalid_format'));
            return;
        }

        const explicitPaths = extractPathsFromFileList(validFiles);
        const uriPaths = rawUriList ? extractPathsFromUriList(rawUriList) : [];
        const inputPaths = explicitPaths.length > 0 ? explicitPaths : uriPaths;
        await submitImport(inputPaths);
    };

    const handleOpenFileDialog = async () => {
        try {
            const paths = await window.electronAPI.openFileDialog({
                title: t('import.title'),
                properties: ['openFile', 'multiSelections'],
            });

            if (paths.length === 0) {
                return;
            }

            await submitImport(paths);
        } catch (error) {
            setImportStatus('error');
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <AnimatePresence>
            {isImportModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden gpu-transform-opacity"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm gpu-layer"
                        onClick={() => toggleImportModal(false)}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-[480px] glass-effect surface-effect flex flex-col no-drag gpu-transform-opacity"
                        style={{ borderRadius: 'var(--corner-radius)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 dark:border-black/10">
                            <h3 className="text-[15px] font-bold tracking-tight">{t('import.title')}</h3>
                            <IconButton
                                icon={<X size={16} />}
                                onClick={() => toggleImportModal(false)}
                                size="sm"
                                variant="ghost"
                                className="opacity-70 hover:opacity-100"
                            />
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Drop Zone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                data-testid="import-drop-zone"
                                className={clsx(
                                    "relative h-56 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-3 transition-all duration-300",
                                    isDragging
                                        ? "border-accent bg-accent/10 scale-[0.98]"
                                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                                )}
                            >
                                <div className={clsx(
                                    "w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300",
                                    importStatus === 'success' ? "bg-green-500/20 text-green-500" :
                                        importStatus === 'error' ? "bg-red-500/20 text-red-500" :
                                            "bg-accent/20 text-accent"
                                )}>
                                    {importStatus === 'success' ? <CheckCircle2 size={32} /> :
                                        importStatus === 'error' ? <AlertCircle size={32} /> :
                                            <Upload size={32} className={clsx(isDragging && "translate-y-[-4px] animate-bounce")} />}
                                </div>

                                <div className="text-center">
                                    <p className="font-semibold text-sm">
                                        {importStatus === 'success' ? t('import.success') :
                                            importStatus === 'error' ? t('import.failed') :
                                                (isDragging ? t('import.drop_zone_active') : t('import.drop_zone'))}
                                    </p>
                                    <p className="text-xs text-textSecondary mt-1">
                                        {importStatus === 'error' ? errorMessage : t('import.formats_desc')}
                                    </p>
                                </div>

                                {/* Drag Overlay visual */}
                                {isDragging && (
                                    <div className="absolute inset-0 bg-accent/5 pointer-events-none rounded-2xl animate-pulse" />
                                )}
                            </div>

                            <div className="flex flex-col items-center gap-4">
                                <span className="text-xs text-textSecondary font-medium">{t('import.or')}</span>
                                <button
                                    onClick={() => void handleOpenFileDialog()}
                                    className="px-8 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all active:scale-95 disabled:opacity-50"
                                    disabled={importStatus === 'success'}
                                >
                                    {t('import.select_file')}
                                </button>
                            </div>
                        </div>

                        {/* Status Bar for quick feedback */}
                        {importStatus !== 'idle' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className={clsx(
                                    "px-4 py-2 text-[11px] font-bold text-center text-white gpu-transform-opacity",
                                    importStatus === 'success' ? "bg-green-500" : "bg-red-500"
                                )}
                            >
                                {importStatus === 'success' ? t('import.processing') : errorMessage}
                            </motion.div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
