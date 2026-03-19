import { AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../../stores/NotificationStore';
import { ToastNotification } from './ToastNotification';
import { Portal } from '../common/Portal';

export function ToastContainer() {
    const activeToasts = useNotificationStore(state => state.activeToasts);

    return (
        <Portal>
            <div className="fixed bottom-12 right-6 z-[10002] flex flex-col-reverse gap-3 pointer-events-none">
                <div className="flex flex-col-reverse gap-3 pointer-events-auto">
                    <AnimatePresence mode="popLayout">
                        {activeToasts.map((notification) => (
                            <ToastNotification
                                key={notification.id}
                                notification={notification}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </Portal>
    );
}
