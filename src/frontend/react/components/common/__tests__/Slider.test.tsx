import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from '../Slider';
import { describe, it, expect, vi } from 'vitest';

describe('Slider component', () => {
    it('renders and handles value change', () => {
        const onChange = vi.fn();
        render(<Slider value={50} min={0} max={100} onChange={onChange} label="Volume" />);
        // Slider component renders label like "Volume (50)"
        expect(screen.getByText(/Volume/i)).toBeInTheDocument();

        const input = screen.getByRole('slider', { hidden: true }); // Real input is opacity-0
        fireEvent.change(input, { target: { value: '75' } });
        expect(onChange).toHaveBeenCalledWith(75);
    });

    it('displays min/max values', () => {
        render(<Slider value={50} min={10} max={90} onChange={vi.fn()} />);
        const input = screen.getByRole('slider');
        expect(input).toHaveAttribute('min', '10');
        expect(input).toHaveAttribute('max', '90');
    });
});
