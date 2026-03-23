import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportModal } from '../ImportModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';
import { importFiles } from '../../../services/importService';

vi.mock('../../../services/importService', () => ({
    importFiles: vi.fn().mockResolvedValue({ taskId: 'task-1' }),
}));

describe('ImportModal component', () => {
    beforeEach(() => {
        vi.mocked(importFiles).mockClear();
        vi.mocked(window.electronAPI.getPathForFile).mockReturnValue('/tmp/test.png');
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

    it('imports dropped files using electron path lookup', async () => {
        render(<ImportModal />);

        const dropZone = screen.getByTestId('import-drop-zone');

        const droppedFile = new File(['file-content'], 'test.png', { type: 'image/png' });
        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [droppedFile],
                getData: vi.fn().mockReturnValue(''),
            },
        });

        await waitFor(() => {
            expect(window.electronAPI.getPathForFile).toHaveBeenCalledWith(droppedFile);
            expect(importFiles).toHaveBeenCalledWith(['/tmp/test.png']);
        });
    });
});
