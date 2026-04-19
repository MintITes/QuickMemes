import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu } from '../DropdownMenu';
import { describe, it, expect, vi } from 'vitest';

describe('DropdownMenu component', () => {
    const onClose = vi.fn();
    const anchorRef = { current: document.createElement('button') };
    const onAction = vi.fn();

    it('renders when open', () => {
        render(<DropdownMenu isOpen={true} onClose={onClose} anchorRef={anchorRef} onAction={onAction} />);
        expect(screen.getByText(/快捷导入/i)).toBeInTheDocument();
        expect(screen.getByText(/从剪贴板导入/i)).toBeInTheDocument();
        expect(screen.getByText(/从文件导入/i)).toBeInTheDocument();
        expect(screen.getByText(/从 URL 导入/i)).toBeInTheDocument();
    });

    it('handles action click', () => {
        render(<DropdownMenu isOpen={true} onClose={onClose} anchorRef={anchorRef} onAction={onAction} />);
        fireEvent.click(screen.getByText(/快捷导入/i));
        expect(onAction).toHaveBeenCalledWith('quick');
        expect(onClose).toHaveBeenCalled();
    });
});
