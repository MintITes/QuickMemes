import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastNotification } from '../ToastNotification';
import { ToastContainer } from '../ToastContainer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotificationStore } from '../../../stores/NotificationStore';

describe('Toast components', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders ToastNotification and removes on click', () => {
        const removeMock = vi.fn();
        useNotificationStore.setState({ removeNotification: removeMock });
        const notification = { id: '1', type: 'info' as const, title: 'Toast', timestamp: Date.now(), read: false };

        render(<ToastNotification notification={notification} />);

        expect(screen.getByText('Toast')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Toast')); // Click the container
        expect(removeMock).toHaveBeenCalledWith('1');
    });

    it('auto dismisses ToastNotification after timeout', () => {
        const dismissMock = vi.fn();
        useNotificationStore.setState({ dismissToast: dismissMock });
        const notification = { id: '1', type: 'info' as const, title: 'Toast', timestamp: Date.now(), read: false };

        render(<ToastNotification notification={notification} />);

        act(() => {
            vi.advanceTimersByTime(3000); // info delay is 3000
        });

        expect(dismissMock).toHaveBeenCalledWith('1');
    });

    it('renders ToastContainer with active toasts', () => {
        useNotificationStore.setState({
            activeToasts: [
                { id: '1', type: 'info' as const, title: 'Toast 1', timestamp: Date.now(), read: false },
                { id: '2', type: 'error' as const, title: 'Toast 2', timestamp: Date.now(), read: false }
            ]
        });

        render(<ToastContainer />);
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();
    });
});
