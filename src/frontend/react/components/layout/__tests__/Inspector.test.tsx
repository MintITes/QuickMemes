import { render, screen, fireEvent } from '@testing-library/react';
import { Inspector } from '../Inspector';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';
import { useMemeStore } from '../../../stores/MemeStore';

const mockMemes = [
    { id: 1, name: 'Meme 1', format: 'png', size: 1024, width: 800, height: 600, createdAt: Date.now(), updatedAt: Date.now(), tagIds: [], filePath: '/test.png', ocrText: 'Hello World', sourceUrl: 'http://example.com' },
    { id: 2, name: 'Meme 2', format: 'jpg', size: 2048, width: 1024, height: 768, createdAt: Date.now(), updatedAt: Date.now(), tagIds: [], filePath: '/test2.jpg' }
];

describe('Inspector component', () => {
    beforeEach(() => {
        useUiStore.setState({
            selectedMemeIds: [],
            isPanelOpen: true,
            inspectorWidth: 300,
            togglePanel: vi.fn(),
            setInspectorWidth: vi.fn(),
            selectMeme: vi.fn(),
        });
        useMemeStore.setState({ memes: mockMemes, updateMeme: vi.fn(), removeMemes: vi.fn() });
    });

    it('renders empty state when no selection', () => {
        render(<Inspector />);
        expect(screen.getByText(/No selection/i)).toBeInTheDocument();
    });

    it('renders meme details for single selection', () => {
        useUiStore.setState({ selectedMemeIds: [1] });
        render(<Inspector />);
        expect(screen.getByText('Meme 1')).toBeInTheDocument();
        expect(screen.getByText('Hello World')).toBeInTheDocument();
        expect(screen.getByDisplayValue('http://example.com')).toBeInTheDocument();
    });

    it('renders batch actions for multiple selection', () => {
        useUiStore.setState({ selectedMemeIds: [1, 2] });
        render(<Inspector />);
        expect(screen.getByText(/Batch Editing/i)).toBeInTheDocument();
        expect(screen.getByText(/You have selected 2 memes/i)).toBeInTheDocument();
    });

    it('toggles panel close', () => {
        render(<Inspector />);
        // Find by X size 16 or aria-label if it had one. Let's try to find by closing the button itself.
        const btns = screen.getAllByRole('button');
        const closeIconBtn = btns.find(b => b.querySelector('svg'));
        if (closeIconBtn) fireEvent.click(closeIconBtn);

        expect(useUiStore.getState().togglePanel).toHaveBeenCalledWith(false);
    });

    it('handles batch delete', () => {
        window.confirm = vi.fn(() => true);
        useUiStore.setState({ selectedMemeIds: [1, 2] });
        render(<Inspector />);

        const deleteBtn = screen.getByText(/Move to Recycle Bin/i);
        fireEvent.click(deleteBtn);

        expect(window.confirm).toHaveBeenCalled();
        expect(useMemeStore.getState().removeMemes).toHaveBeenCalledWith([1, 2]);
    });
});
