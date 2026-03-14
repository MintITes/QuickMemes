import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '../../../stores/CategoryStore';

describe('Sidebar component', () => {
    beforeEach(() => {
        useCategoryStore.setState({ categories: [] });
    });

    it('renders system and shortcuts categories', () => {
        render(<Sidebar />);
        expect(screen.getByText('All Memes')).toBeInTheDocument();
        expect(screen.getByText('Untagged')).toBeInTheDocument();
        expect(screen.getByText('Trash')).toBeInTheDocument();
        // The bucket is labeled as "Bucket" internally in implementation, or "Magic Store" header
        expect(screen.getByText(/Bucket/i)).toBeInTheDocument();
    });

    it('renders category from store', () => {
        useCategoryStore.setState({
            categories: [{ id: 1, name: 'Fav Memes', order: 1 }]
        });
        render(<Sidebar />);
        expect(screen.getByText('Fav Memes')).toBeInTheDocument();
    });
});
