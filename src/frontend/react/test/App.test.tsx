import { render, screen } from '@testing-library/react';
import App from '../App';
import { describe, it, expect, vi } from 'vitest';

// Mock virtuoso because it heavily manipulates observer APIs
vi.mock('react-virtuoso', () => ({
    VirtuosoGrid: () => <div data-testid="virtuoso-mock">VirtuosoList</div>
}));

describe('App', () => {
    it('renders the Main Shell structural components including empty state', () => {
        render(<App />);
        expect(screen.getByPlaceholderText(/搜索 Meme/i)).toBeInTheDocument();
        expect(screen.getByText(/没有任何梗图/i)).toBeInTheDocument();
    });
});
