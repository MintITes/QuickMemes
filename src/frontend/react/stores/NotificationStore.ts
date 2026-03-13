import { create } from 'zustand';

export type NotificationType = 'info' | 'warn' | 'error' | 'debug' | 'success' | 'fatal';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    description?: string;
    timestamp: number;
    read: boolean;
}

interface NotificationState {
    notifications: AppNotification[];
    activeToasts: AppNotification[];
    isPanelOpen: boolean;

    // Actions
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    clearAll: () => void;
    togglePanel: (isOpen?: boolean) => void;
    dismissToast: (id: string) => void;
    markAllAsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    activeToasts: [],
    isPanelOpen: false,

    addNotification: (noti) => {
        const id = Math.random().toString(36).substring(7);
        const newNotification: AppNotification = {
            ...noti,
            id,
            timestamp: Date.now(),
            read: false,
        };
        set((state) => ({
            notifications: [newNotification, ...state.notifications],
            activeToasts: state.isPanelOpen ? state.activeToasts : [newNotification, ...state.activeToasts]
        }));
    },

    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        activeToasts: state.activeToasts.filter((n) => n.id !== id)
    })),

    dismissToast: (id) => set((state) => ({
        activeToasts: state.activeToasts.filter((n) => n.id !== id),
    })),

    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        )
    })),

    clearAll: () => set({ notifications: [], activeToasts: [] }),

    togglePanel: (isOpen) => set((state) => {
        const nextOpen = isOpen !== undefined ? isOpen : !state.isPanelOpen;
        // Mark all as read when opening the panel
        const notifications = nextOpen
            ? state.notifications.map(n => ({ ...n, read: true }))
            : state.notifications;

        return {
            isPanelOpen: nextOpen,
            notifications
        };
    }),

    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true }))
    })),
}));
