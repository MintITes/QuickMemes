import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../stores/UiStore';



describe('App', () => {
    beforeEach(() => {
        useUiStore.setState({
            toggleImportModal: vi.fn(),
        });
    });

    it('renders the Main Shell structural components including empty state', () => {
        render(<App />);
        expect(screen.getByPlaceholderText(/搜索梗图/i)).toBeInTheDocument();
        expect(screen.getByText(/还没有任何梗图/i)).toBeInTheDocument();
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

    it('toggles the fps overlay from the debug console hook', () => {
        render(<App />);

        let enableResult = '';
        act(() => {
            enableResult = window.debug?.fps(true) ?? '';
        });
        expect(enableResult).toBe('fps:on');
        expect(screen.getByText('FPS')).toBeInTheDocument();

        let disableResult = '';
        act(() => {
            disableResult = window.debug?.fps(false) ?? '';
        });
        expect(disableResult).toBe('fps:off');

        expect(screen.queryByText('FPS')).not.toBeInTheDocument();
    });
});
