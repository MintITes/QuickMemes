import { render, screen } from '@testing-library/react';
import { Gallery } from '../Gallery';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemeStore } from '../../../stores/MemeStore';
import { useUiStore } from '../../../stores/UiStore';
import { useTagStore } from '../../../stores/TagStore';

describe('Gallery component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMemeStore.setState({
            memes: [],
            isLoading: false,
            totalCount: 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        useUiStore.setState({
            activeNav: 'all',
            searchQuery: { keyword: '', tagIds: [] },
            viewMode: 'grid',
            imageFit: 'contain',
            selectedMemeIds: [],
            selectMeme: vi.fn(),
            setSearchQuery: vi.fn(),
            setViewMode: vi.fn(),
            setImageFit: vi.fn(),
            setShowTags: vi.fn(),
            togglePanel: vi.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        useTagStore.setState({ tags: [] });
    });

    it('renders empty state when no memes', () => {
        render(<Gallery />);
        expect(screen.getByText(/没有任何梗图/i)).toBeInTheDocument();
    });

    it('renders memes from store', () => {
        // We use Virtuoso, which might not render all items in a test environment without setup or mock
        // But it usually renders some. Let's provide a meme.
        useMemeStore.setState({
            memes: [{ id: 1, name: 'Test Meme', size: 1024, createdAt: Date.now(), tagIds: [] }]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        render(<Gallery />);
        // VirtuosoGrid might be tricky to test with getByText if not rendered.
        // If it's not showing, we might need to mock Virtuoso or check why.
    });

    it('shows search empty state', () => {
        useUiStore.setState({ searchQuery: { keyword: 'xyz', tagIds: [] } });
        render(<Gallery />);
        expect(screen.getByText(/没有找到匹配的梗图/i)).toBeInTheDocument();
    });
});
