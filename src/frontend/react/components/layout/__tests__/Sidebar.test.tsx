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
        expect(screen.getByText('所有梗图')).toBeInTheDocument();
        expect(screen.getByText('未分类')).toBeInTheDocument();
        expect(screen.getByText('回收站')).toBeInTheDocument();
        // The bucket is labeled as "Bucket" internally in implementation, or "Magic Store" header
        expect(screen.getByText(/暂存箱/i)).toBeInTheDocument();
    });

    it('renders category from store', () => {
        useCategoryStore.setState({
            categories: [{ id: 1, name: 'Fav Memes', order: 1 }]
        });
        render(<Sidebar />);
        expect(screen.getByText('Fav Memes')).toBeInTheDocument();
    });
});
