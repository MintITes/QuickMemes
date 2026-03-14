import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../SettingsModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';

describe('SettingsModal component', () => {
    beforeEach(() => {
        useUiStore.setState({
            isSettingsOpen: true,
            theme: 'light',
            setTheme: vi.fn(),
            toggleSettings: vi.fn(),
        });
    });

    it('renders when open', () => {
        render(<SettingsModal />);
        expect(screen.getByText(/设置中心/i)).toBeInTheDocument();
    });

    it('handles theme change', () => {
        render(<SettingsModal />);
        const darkThemeBtn = screen.getByText(/暗黑/i);
        fireEvent.click(darkThemeBtn);
        expect(useUiStore.getState().setTheme).toHaveBeenCalledWith('dark');
    });

    it('closes on close button click', () => {
        render(<SettingsModal />);
        const closeBtn = screen.getByLabelText(/Close settings/i);
        fireEvent.click(closeBtn);
        expect(useUiStore.getState().toggleSettings).toHaveBeenCalledWith(false);
    });
});
