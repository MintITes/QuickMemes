import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '../../../stores/CategoryStore';

describe('Sidebar component', () => {
    beforeEach(() => {
        useCategoryStore.setState({ categories: [], isLoading: false });
    });

    it('renders system categories', () => {
        render(<Sidebar />);
        expect(screen.getByText('所有梗图')).toBeInTheDocument();
        expect(screen.getByText('未分类')).toBeInTheDocument();
        expect(screen.getByText('回收站')).toBeInTheDocument();
    });

    it('renders category from store', () => {
        useCategoryStore.setState({
            categories: [{ id: 1, uuid: '1', name: 'Fav Memes', color: '#fff', createdAt: 0, updatedAt: 0 }],
            isLoading: false,
        });
        render(<Sidebar />);
        expect(screen.getByText('Fav Memes')).toBeInTheDocument();
    });
});
