import { useMemeStore } from '../../stores/MemeStore';
import { useUiStore } from '../../stores/UiStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { CheckCircle2, Inbox, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { ProgressBar } from './ProgressBar';

export function StatusBar() {
    const totalCount = useMemeStore(state => state.totalCount);
    const selectedMemeIds = useUiStore(state => state.selectedMemeIds);
    const { notifications, togglePanel } = useNotificationStore();

    const hasUnread = notifications.some(n => !n.read);
    const hasFatalOrError = notifications.some(n => n.type === 'fatal' || n.type === 'error');
    const hasWarn = notifications.some(n => n.type === 'warn');
    const hasInfo = notifications.some(n => n.type === 'info' || n.type === 'success' || n.type === 'debug');

    const getStatusColor = () => {
        if (hasFatalOrError) return "bg-red-400";
        if (hasWarn) return "bg-yellow-400";
        if (hasInfo) return "bg-blue-400";
        return "bg-green-400";
    };

    const getStatusText = () => {
        if (hasFatalOrError) return 'System Error';
        if (hasWarn) return 'Warnings';
        if (notifications.length > 0) return 'Notifications';
        return 'Ready';
    };

    const getStatusIcon = () => {
        if (hasFatalOrError) return <AlertCircle size={12} />;
        if (hasWarn) return <AlertTriangle size={12} />;
        if (hasInfo) return <Info size={12} />;
        return <CheckCircle2 size={12} />;
    };

    return (
        <footer className="h-7 w-full flex-shrink-0 bg-accent text-white text-[11px] flex items-center px-4 justify-between select-none z-20 shadow-inner">
            <div className="flex items-center gap-4 opacity-90">
                <div className="flex items-center gap-1.5">
                    <Inbox size={12} />
                    <span>Total: <b className="font-mono">{totalCount}</b> items</span>
                </div>
                {selectedMemeIds.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-sm">Selected: {selectedMemeIds.length}</span>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center overflow-visible">
                <ProgressBar />
            </div>

            <div
                className="flex items-center gap-2 opacity-90 cursor-pointer hover:opacity-100 transition-opacity no-drag"
                onClick={() => togglePanel()}
                title={getStatusText()}
            >
                {getStatusIcon()}
                <span>{getStatusText()}</span>
                <div className="relative flex items-center justify-center w-3 h-3 ml-1">
                    {hasUnread && (
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className={clsx("absolute inset-0 rounded-full", getStatusColor())}
                        />
                    )}
                    <div
                        className={clsx(
                            "w-2 h-2 rounded-full shadow-sm transition-colors border border-white/20 z-10",
                            getStatusColor()
                        )}
                    />
                </div>
            </div>
        </footer>
    );
}
