import { useMemeStore } from '../../stores/MemeStore';
import { useUiStore } from '../../stores/UiStore';
import { useNotificationStore } from '../../stores/NotificationStore';
import { CheckCircle2, Inbox, AlertTriangle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

import { ProgressBar } from './ProgressBar';

export function StatusBar() {
    const totalCount = useMemeStore(state => state.totalCount);
    const selectedMemeIds = useUiStore(state => state.selectedMemeIds);
    const { notifications, togglePanel } = useNotificationStore();

    const hasError = notifications.some(n => n.type === 'error');
    const hasWarn = notifications.some(n => n.type === 'warn');

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
            >
                {hasError ? <AlertCircle size={12} /> : hasWarn ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                <span>{hasError ? 'System Error' : hasWarn ? 'Warnings' : notifications.length > 0 ? 'Notifications' : 'Ready'}</span>
                <div
                    className={clsx(
                        "w-2.5 h-2.5 rounded-full ml-1 shadow-lg transition-colors border border-white/20",
                        hasError ? "bg-red-400 shadow-red-500/50" :
                            hasWarn ? "bg-yellow-400 shadow-yellow-500/50" :
                                notifications.length > 0 ? "bg-blue-400 shadow-blue-500/50" :
                                    "bg-green-400 shadow-green-500/50"
                    )}
                    title={hasError ? "Critical Errors" : hasWarn ? "Warnings Pending" : "Status Normal"}
                />
            </div>
        </footer>
    );
}
