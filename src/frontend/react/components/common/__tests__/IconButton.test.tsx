import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from '../IconButton';
import { describe, it, expect, vi } from 'vitest';
import { Search } from 'lucide-react';

describe('IconButton component', () => {
    it('renders with icon', () => {
        render(<IconButton icon={<Search data-testid="search-icon" />} />);
        expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('handles click events', () => {
        const handleClick = vi.fn();
        render(<IconButton icon={<Search />} onClick={handleClick} />);

        fireEvent.click(screen.getByRole('button'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('can be disabled', () => {
        const handleClick = vi.fn();
        render(<IconButton icon={<Search />} onClick={handleClick} disabled />);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveClass('opacity-30');

        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies active class when active prop is true', () => {
        render(<IconButton icon={<Search />} active />);
        expect(screen.getByRole('button')).toHaveClass('text-accent');
    });

    it('applies correct size classes', () => {
        const { rerender } = render(<IconButton icon={<Search />} size="sm" />);
        expect(screen.getByRole('button')).toHaveClass('w-7 h-7');

        rerender(<IconButton icon={<Search />} size="xl" />);
        expect(screen.getByRole('button')).toHaveClass('w-14 h-14');
    });
});
