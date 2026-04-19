import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../NotificationStore';

describe('NotificationStore', () => {
    beforeEach(() => {
        useNotificationStore.setState({
            notifications: [],
            activeToasts: [],
            isPanelOpen: false,
        });
    });

    it('should add notification and toast correctly', () => {
        const noti = { type: 'info' as const, title: 'Test', description: 'Desc' };
        useNotificationStore.getState().addNotification(noti);

        const state = useNotificationStore.getState();
        expect(state.notifications.length).toBe(1);
        expect(state.activeToasts.length).toBe(1);
        expect(state.notifications[0]).toMatchObject(noti);
        expect(state.notifications[0].id).toBeDefined();
        expect(state.notifications[0].read).toBe(false);
    });

    it('should not add toast when panel is open', () => {
        useNotificationStore.setState({ isPanelOpen: true });
        useNotificationStore.getState().addNotification({ type: 'info', title: 'Test' });

        expect(useNotificationStore.getState().activeToasts.length).toBe(0);
    });

    it('should remove notification', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: 'Test' });
        const id = useNotificationStore.getState().notifications[0].id;

        useNotificationStore.getState().removeNotification(id);
        expect(useNotificationStore.getState().notifications.length).toBe(0);
        expect(useNotificationStore.getState().activeToasts.length).toBe(0);
    });

    it('should mark as read', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: 'Test' });
        const id = useNotificationStore.getState().notifications[0].id;

        useNotificationStore.getState().markAsRead(id);
        expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });

    it('should toggle panel and mark all as read', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: 'Test' });
        expect(useNotificationStore.getState().notifications[0].read).toBe(false);

        useNotificationStore.getState().togglePanel(true);
        expect(useNotificationStore.getState().isPanelOpen).toBe(true);
        expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });

    it('should dismiss toast', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: 'Test' });
        const id = useNotificationStore.getState().activeToasts[0].id;

        useNotificationStore.getState().dismissToast(id);
        expect(useNotificationStore.getState().activeToasts.length).toBe(0);
        expect(useNotificationStore.getState().notifications.length).toBe(1);
    });

    it('should mark all as read', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: '1' });
        useNotificationStore.getState().addNotification({ type: 'info', title: '2' });

        useNotificationStore.getState().markAllAsRead();
        expect(useNotificationStore.getState().notifications.every(n => n.read)).toBe(true);
    });

    it('should clear all', () => {
        useNotificationStore.getState().addNotification({ type: 'info', title: '1' });
        useNotificationStore.getState().clearAll();

        expect(useNotificationStore.getState().notifications.length).toBe(0);
        expect(useNotificationStore.getState().activeToasts.length).toBe(0);
    });
});
