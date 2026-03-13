import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { type AppNotification, useNotificationStore } from '../../stores/NotificationStore';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

interface ToastNotificationProps {
    notification: AppNotification;
}

export function ToastNotification({ notification }: ToastNotificationProps) {
    const dismissToast = useNotificationStore(state => state.dismissToast);
    const removeNotification = useNotificationStore(state => state.removeNotification);

    useEffect(() => {
        // Delay based on severity
        const delays = {
            info: 3000,
            warn: 4000,
            error: 5000
        };

        const timer = setTimeout(() => {
            dismissToast(notification.id);
        }, delays[notification.type]);

        return () => clearTimeout(timer);
    }, [notification, dismissToast]);

    const handleAction = () => {
        // If handled, ignore (remove from history entirely)
        removeNotification(notification.id);
    };

    const icons = {
        info: <Info size={16} className="text-blue-500" />,
        warn: <AlertTriangle size={16} className="text-yellow-500" />,
        error: <AlertCircle size={16} className="text-red-500" />
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 120, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.12 } }}
            transition={{
                type: "spring",
                stiffness: 600,
                damping: 35,
                mass: 0.6
            }}
            className={clsx(
                "group relative flex items-start gap-3 p-4 min-w-[300px] max-w-[400px] overflow-hidden",
                "bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-white/20 dark:border-white/10",
                "rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
                "cursor-pointer hover:border-accent/40 active:scale-[0.98] transition-all"
            )}
            onClick={handleAction}
        >
            <div className="mt-0.5">{icons[notification.type]}</div>
            <div className="flex-1 min-w-0 pr-4">
                <div className="font-semibold text-sm leading-tight mb-1">{notification.title}</div>
                {notification.description && (
                    <div className="text-xs opacity-70 leading-normal line-clamp-2">
                        {notification.description}
                    </div>
                )}
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(notification.id);
                }}
                className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
            >
                <X size={14} className="opacity-60" />
            </button>

            {/* Progress bar visual for timer */}
            <motion.div
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{
                    duration: ({ info: 3, warn: 4, error: 5 })[notification.type],
                    ease: "linear"
                }}
                className="absolute bottom-0 left-0 h-0.5 bg-accent opacity-30"
            />
        </motion.div>
    );
}
