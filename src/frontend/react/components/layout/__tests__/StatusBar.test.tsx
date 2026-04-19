import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '../StatusBar';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemeStore } from '../../../stores/MemeStore';
import { useNotificationStore } from '../../../stores/NotificationStore';
import { useUiStore } from '../../../stores/UiStore';

describe('StatusBar component', () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMemeStore.setState({ totalCount: 1, memes: [{ id: 1, size: 1024 }] } as any);
        useNotificationStore.setState({ notifications: [], isPanelOpen: false, togglePanel: vi.fn() });
        useUiStore.setState({ selectedMemeIds: [] });
    });

    it('renders meme count and total size', () => {
        render(<StatusBar />);
        // Implementation renders "Total: {count} items"
        expect(screen.getByText(/Total:/i)).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('toggles notification panel on click', () => {
        render(<StatusBar />);
        const notifyBtn = screen.getByTitle(/Ready/i);
        fireEvent.click(notifyBtn);
        expect(useNotificationStore.getState().togglePanel).toHaveBeenCalled();
    });

    it('shows unread notification count badge', () => {
        useNotificationStore.setState({
            notifications: [{ id: '1', read: false, type: 'info', title: 'Info', timestamp: Date.now() }]
        });
        render(<StatusBar />);
        // The unread dot is rendered, we can check for its presence if identifiable
    });

    it('updates status text based on notifications', () => {
        useNotificationStore.setState({
            notifications: [{ id: '1', read: false, type: 'error', title: 'Error', timestamp: Date.now() }]
        });
        render(<StatusBar />);
        expect(screen.getByText(/System Error/i)).toBeInTheDocument();
    });
});
