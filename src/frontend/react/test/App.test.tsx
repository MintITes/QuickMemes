import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../stores/UiStore';

// Mock virtuoso because it heavily manipulates observer APIs
vi.mock('react-virtuoso', () => ({
    VirtuosoGrid: () => <div data-testid="virtuoso-mock">VirtuosoList</div>
}));

describe('App', () => {
    beforeEach(() => {
        useUiStore.setState({
            toggleImportModal: vi.fn(),
        });
    });

    it('renders the Main Shell structural components including empty state', () => {
        render(<App />);
        expect(screen.getByPlaceholderText(/搜索 Meme/i)).toBeInTheDocument();
        expect(screen.getByText(/没有任何梗图/i)).toBeInTheDocument();
    });

    it('opens import modal when a file is dragged into the window', () => {
        render(<App />);

        fireEvent.dragEnter(window, {
            dataTransfer: {
                types: ['Files'],
                files: [new File(['x'], 'dragged.png', { type: 'image/png' })],
            },
        });

        expect(useUiStore.getState().toggleImportModal).toHaveBeenCalledWith(true);
    });
});
