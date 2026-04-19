import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect } from 'vitest';

describe('Header component', () => {
    it('renders logo and basic controls', () => {
        render(<Header />);
        expect(screen.getByText('QuickMemes')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/搜索/i)).toBeInTheDocument();
        // Control buttons. The IconButton component doesn't always render title on the button itself if not passed directly, checking aria-label
        expect(screen.getByLabelText(/布局/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/设置/i)).toBeInTheDocument();
    });
});
