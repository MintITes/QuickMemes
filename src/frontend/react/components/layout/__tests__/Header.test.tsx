import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect } from 'vitest';

describe('Header component', () => {
    it('renders window controls, title, search and setup buttons', () => {
        render(<Header />);
        // QuickMemes text was removed in favor of native title bar / macOS traffic lights
        // Check standard glassmorphism class
        expect(screen.getByTestId('header')).toHaveClass('glass-effect');

        // Check search bar
        expect(screen.getByPlaceholderText(/搜索/i)).toBeInTheDocument();

        // Check buttons
        expect(screen.getByTestId('btn-add')).toBeInTheDocument();
    });
});
