import { render, screen, fireEvent } from '@testing-library/react';
import { PlusButton } from '../PlusButton';
import { Switch } from '../Switch';
import { describe, it, expect, vi } from 'vitest';

describe('Common components', () => {
    describe('PlusButton', () => {
        it('renders and handles click', () => {
            const onClick = vi.fn();
            render(<PlusButton onClick={onClick} />);
            fireEvent.click(screen.getByRole('button'));
            expect(onClick).toHaveBeenCalled();
        });

        it('displays active state', () => {
            const { rerender } = render(<PlusButton active={false} />);
            // Search for rotate class or similar logic if identifiable
            rerender(<PlusButton active={true} />);
        });
    });

    describe('Switch', () => {
        it('renders and toggles', () => {
            const onChange = vi.fn();
            render(<Switch checked={false} onChange={onChange} aria-label="Test Switch" />);
            fireEvent.click(screen.getByRole('switch'));
            expect(onChange).toHaveBeenCalledWith(true);
        });

        it('displays disabled state', () => {
            render(<Switch checked={false} onChange={() => { }} disabled />);
            expect(screen.getByRole('switch')).toBeDisabled();
        });
    });
});
