import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../Sidebar';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCategoryStore } from '../../../stores/CategoryStore';
import { useUiStore } from '../../../stores/UiStore';
import { fetchCategories, updateCategory } from '../../../services/categoryService';

vi.mock('../../../services/categoryService', () => ({
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    fetchCategories: vi.fn(),
    updateCategory: vi.fn(),
}));

describe('Sidebar component', () => {
    beforeEach(() => {
        useCategoryStore.setState({ categories: [], isLoading: false });
        useUiStore.setState({ sidebarExpanded: true, activeNav: 'all' } as never);
        vi.mocked(fetchCategories).mockResolvedValue([]);
        vi.mocked(updateCategory).mockReset();
    });

    it('renders system categories', () => {
        render(<Sidebar />);
        expect(screen.getByText('所有梗图')).toBeInTheDocument();
        expect(screen.getByText('未分类')).toBeInTheDocument();
        expect(screen.getByText('回收站')).toBeInTheDocument();
    });

    it('renders category from store', () => {
        useCategoryStore.setState({
            categories: [{ id: 1, uuid: '1', name: 'Fav Memes', color: '#fff', position: 1, createdAt: 0, updatedAt: 0 }],
            isLoading: false,
        });
        render(<Sidebar />);
        expect(screen.getByText('Fav Memes')).toBeInTheDocument();
    });

    it('keeps category click navigation after enabling sortable rows', async () => {
        const user = userEvent.setup();
        useCategoryStore.setState({
            categories: [{ id: 1, uuid: '1', name: 'Fav Memes', color: '#fff', position: 1, createdAt: 0, updatedAt: 0 }],
            isLoading: false,
        });

        render(<Sidebar />);

        await user.click(screen.getByRole('button', { name: 'Fav Memes' }));

        expect(useUiStore.getState().activeNav).toBe('category-1');
    });

    it('auto-saves custom category color when hex input becomes valid', async () => {
        const user = userEvent.setup();
        const updatedCategory = {
            id: 1,
            uuid: '1',
            name: 'Fav Memes',
            color: '#123456',
            position: 1,
            createdAt: 0,
            updatedAt: 0,
        };
        vi.mocked(updateCategory).mockResolvedValue(updatedCategory);
        vi.mocked(fetchCategories).mockResolvedValue([updatedCategory]);
        useCategoryStore.setState({
            categories: [{ id: 1, uuid: '1', name: 'Fav Memes', color: '#ffffff', position: 1, createdAt: 0, updatedAt: 0 }],
            isLoading: false,
        });

        render(<Sidebar />);

        await user.click(screen.getByRole('button', { name: 'Fav Memes 分类菜单' }));
        await user.click(screen.getByRole('button', { name: '自定义 Fav Memes 颜色' }));

        const hexInput = await screen.findByRole('textbox');
        fireEvent.change(hexInput, { target: { value: '#123456' } });

        await waitFor(() => {
            expect(updateCategory).toHaveBeenCalledWith(1, { color: '#123456' });
        });
        expect(screen.getByRole('textbox')).toHaveValue('#123456');
    });
});
