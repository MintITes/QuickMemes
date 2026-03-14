import { render, screen, fireEvent } from '@testing-library/react';
import { ImportModal } from '../ImportModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';

describe('ImportModal component', () => {
    beforeEach(() => {
        useUiStore.setState({
            isImportModalOpen: true,
            toggleImportModal: vi.fn(),
        });
    });

    it('renders when open', () => {
        render(<ImportModal />);
        expect(screen.getByText(/快捷导入/i)).toBeInTheDocument();
    });

    it('handles close', () => {
        render(<ImportModal />);
        // If name is empty, let's just find the one that isn't "选择文件"
        const buttons = screen.getAllByRole('button');
        const headerClose = buttons.find(b => !b.textContent || b.textContent === '或');
        fireEvent.click(headerClose || buttons[0]);
        expect(useUiStore.getState().toggleImportModal).toHaveBeenCalledWith(false);
    });
});
