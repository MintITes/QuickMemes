import { create } from 'zustand';

export type NotificationType = 'info' | 'warn' | 'error';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    description?: string;
    timestamp: Date;
    read: boolean;
}

interface NotificationState {
    notifications: Notification[];
    isPanelOpen: boolean;

    // Actions
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    clearAll: () => void;
    togglePanel: (isOpen?: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    isPanelOpen: false,

    addNotification: (noti) => set((state) => ({
        notifications: [
            ...state.notifications,
            {
                ...noti,
                id: Math.random().toString(36).substring(7),
                timestamp: new Date(),
                read: false,
            }
        ]
    })),

    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),

    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        )
    })),

    clearAll: () => set({ notifications: [] }),

    togglePanel: (isOpen) => set((state) => ({
        isPanelOpen: isOpen !== undefined ? isOpen : !state.isPanelOpen
    })),
}));
