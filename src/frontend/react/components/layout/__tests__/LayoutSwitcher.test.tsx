import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutSwitcher } from '../LayoutSwitcher';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';

describe('LayoutSwitcher component', () => {
    const onClose = vi.fn();
    const anchorRef = { current: document.createElement('button') };

    beforeEach(() => {
        vi.clearAllMocks();
        useUiStore.setState({
            sidebarExpanded: true,
            isPanelOpen: true,
            setSidebarExpanded: vi.fn(),
            togglePanel: vi.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    });

    it('renders when open', () => {
        render(<LayoutSwitcher isOpen={true} onClose={onClose} anchorRef={anchorRef} />);
        expect(screen.getByText('左展+右展')).toBeInTheDocument();
        expect(screen.getByText('左展+右隐')).toBeInTheDocument();
    });

    it('handles layout selection', () => {
        render(<LayoutSwitcher isOpen={true} onClose={onClose} anchorRef={anchorRef} />);
        fireEvent.click(screen.getByText('左折+右隐'));
        expect(useUiStore.getState().setSidebarExpanded).toHaveBeenCalledWith(false);
        expect(useUiStore.getState().togglePanel).toHaveBeenCalledWith(false);
        expect(onClose).toHaveBeenCalled();
    });
});
