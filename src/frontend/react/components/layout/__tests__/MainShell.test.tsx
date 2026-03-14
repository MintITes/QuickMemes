import { render, screen } from '@testing-library/react';
import { MainShell } from '../MainShell';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';

// Mock components to simplify MainShell tests
vi.mock('../Header', () => ({ Header: () => <div data-testid="header-mock">Header</div> }));
vi.mock('../Sidebar', () => ({ Sidebar: () => <div data-testid="sidebar-mock">Sidebar</div> }));
vi.mock('../Gallery', () => ({ Gallery: () => <div data-testid="gallery-mock">Gallery</div> }));
vi.mock('../Inspector', () => ({ Inspector: () => <div data-testid="inspector-mock">Inspector</div> }));
vi.mock('../StatusBar', () => ({ StatusBar: () => <div data-testid="statusbar-mock">StatusBar</div> }));
vi.mock('../settings/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('../settings/ImportModal', () => ({ ImportModal: () => null }));
vi.mock('../NotificationPanel', () => ({ NotificationPanel: () => null }));
vi.mock('../ToastContainer', () => ({ ToastContainer: () => null }));

describe('MainShell component', () => {
    beforeEach(() => {
        useUiStore.setState({ isPanelOpen: false });
    });

    it('renders core layout parts', () => {
        render(<MainShell />);
        expect(screen.getByTestId('header-mock')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
        expect(screen.getByTestId('gallery-mock')).toBeInTheDocument();
        expect(screen.getByTestId('statusbar-mock')).toBeInTheDocument();
    });

    it('shows/hides inspector based on store state', () => {
        const { rerender } = render(<MainShell />);
        expect(screen.queryByTestId('inspector-mock')).not.toBeInTheDocument();

        useUiStore.setState({ isPanelOpen: true });
        rerender(<MainShell />);
        expect(screen.getByTestId('inspector-mock')).toBeInTheDocument();
    });
});
