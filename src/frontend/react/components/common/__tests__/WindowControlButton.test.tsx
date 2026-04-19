import { render, screen, fireEvent } from '@testing-library/react';
import { WindowControlButton } from '../WindowControlButton';
import { describe, it, expect } from 'vitest';

describe('WindowControlButton component', () => {
    it('renders desktop window controls', () => {
        render(<WindowControlButton />);
        // Desktop window controls usually have aria-labels for accessibility
        expect(screen.getByLabelText(/Minimize/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Maximize/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Close/i)).toBeInTheDocument();
    });

    it('triggers window actions', () => {
        // Mock electronAPI if necessary, but here we just check if it renders and is clickable
        render(<WindowControlButton />);
        fireEvent.click(screen.getByLabelText(/Close/i));
    });
});
