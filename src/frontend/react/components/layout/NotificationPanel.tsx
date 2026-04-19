import { useNotificationStore, type NotificationType } from '../../stores/NotificationStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertTriangle, AlertCircle, Trash2, Terminal, CheckCircle2, Bomb } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

const severityOrder: Record<NotificationType, number> = {
    'fatal': 0,
    'error': 1,
    'warn': 2,
    'info': 3,
    'success': 4,
    'debug': 5
};

export function NotificationPanel() {
    const {
        notifications,
        isPanelOpen,
        togglePanel,
        removeNotification,
        clearAll
    } = useNotificationStore();
    const { t } = useTranslation();

    // Sort notifications: Severity first (Fatal > Error > Warn > Info > Success > Debug), then Newest first
    const sortedNotifications = [...notifications].sort((a, b) => {
        if (a.type !== b.type) {
            return severityOrder[a.type] - severityOrder[b.type];
        }
        return b.timestamp - a.timestamp;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPanelOpen) {
                togglePanel(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPanelOpen, togglePanel]);

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'info': return <Info size={16} className="text-blue-500" />;
            case 'warn': return <AlertTriangle size={16} className="text-yellow-500" />;
            case 'error': return <AlertCircle size={16} className="text-red-500" />;
            case 'debug': return <Terminal size={16} className="text-gray-500" />;
            case 'success': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'fatal': return <Bomb size={16} className="text-red-600" />;
        }
    };

    return (
        <AnimatePresence>
            {isPanelOpen && (
                <>
                    {/* Backdrop for closing */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] bg-transparent"
                        onClick={() => togglePanel(false)}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-12 right-4 w-80 max-h-[500px] surface-effect z-[10001] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10"
                        style={{ borderRadius: 'var(--corner-radius)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-borderColor bg-white/5">
                            <span className="text-sm font-bold opacity-80 px-1">{t('notifications.title')}</span>
                            <IconButton
                                icon={<X size={14} />}
                                size="sm"
                                variant="ghost"
                                onClick={() => togglePanel(false)}
                            />
                        </div>

                        {/* Notifications List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {sortedNotifications.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center opacity-40 text-xs">
                                    <Info size={24} className="mb-2" />
                                    <span>{t('notifications.empty')}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {sortedNotifications.map((noti) => (
                                        <motion.div
                                            key={noti.id}
                                            layout
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="bg-white/5 border border-borderColor p-3 rounded-lg flex gap-3 group relative cursor-pointer hover:bg-white/10 transition-colors"
                                            onClick={() => removeNotification(noti.id)}
                                        >
                                            <div className="mt-0.5">{getIcon(noti.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium leading-tight">{noti.title}</div>
                                                {noti.description && (
                                                    <div className="text-xs opacity-60 mt-1 line-clamp-2">{noti.description}</div>
                                                )}
                                                <div className="text-[10px] opacity-40 mt-1.5">
                                                    {new Date(noti.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X size={12} className="opacity-40" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-2 border-t border-borderColor bg-white/5 flex justify-center">
                                <button
                                    onClick={clearAll}
                                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 size={12} />
                                    <span>{t('notifications.clear_all')}</span>
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
