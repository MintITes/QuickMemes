import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { describe, it, expect, vi } from 'vitest';
import { Inbox } from 'lucide-react';

describe('EmptyState component', () => {
    it('renders title and description', () => {
        render(<EmptyState icon={<Inbox />} title="Empty Title" description="Empty Description" />);
        expect(screen.getByText('Empty Title')).toBeInTheDocument();
        expect(screen.getByText('Empty Description')).toBeInTheDocument();
    });

    it('renders action button when provided', () => {
        const handleClick = vi.fn();
        render(
            <EmptyState
                icon={<Inbox />}
                title="Title"
                description="Desc"
                action={{ label: 'Click Me', onClick: handleClick }}
            />
        );

        const button = screen.getByText('Click Me');
        expect(button).toBeInTheDocument();

        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies custom className', () => {
        const { container } = render(
            <EmptyState icon={<Inbox />} title="Title" description="Desc" className="custom-test-class" />
        );
        expect(container.firstChild).toHaveClass('custom-test-class');
    });
});
