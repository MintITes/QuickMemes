import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationPanel } from '../NotificationPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotificationStore } from '../../../stores/NotificationStore';

describe('NotificationPanel component', () => {
    beforeEach(() => {
        useNotificationStore.setState({
            notifications: [
                { id: '1', type: 'info', title: 'Test Notification', timestamp: Date.now(), read: false }
            ],
            isPanelOpen: true,
            togglePanel: vi.fn(),
            removeNotification: vi.fn(),
            clearAll: vi.fn()
        });
    });

    it('renders notifications when open', () => {
        render(<NotificationPanel />);
        expect(screen.getByText('Test Notification')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
        useNotificationStore.setState({ notifications: [] });
        render(<NotificationPanel />);
        expect(screen.getByText(/暂无通知/i)).toBeInTheDocument();
    });

    it('handles remove single notification', () => {
        render(<NotificationPanel />);
        // Click the whole notification card
        fireEvent.click(screen.getByText('Test Notification'));
        expect(useNotificationStore.getState().removeNotification).toHaveBeenCalledWith('1');
    });

    it('handles clear all notifications', () => {
        render(<NotificationPanel />);
        const clearBtn = screen.getByText(/全部清除/i);
        fireEvent.click(clearBtn);
        expect(useNotificationStore.getState().clearAll).toHaveBeenCalled();
    });

    it('handles close panel', () => {
        render(<NotificationPanel />);
        const closeBtns = screen.getAllByRole('button');
        fireEvent.click(closeBtns[0]); // Header close button
        expect(useNotificationStore.getState().togglePanel).toHaveBeenCalledWith(false);
    });
});
