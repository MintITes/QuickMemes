import { render, screen } from '@testing-library/react';
import { Gallery } from '../Gallery';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemeStore } from '../../../stores/MemeStore';
import { useUiStore } from '../../../stores/UiStore';
import { useTagStore } from '../../../stores/TagStore';



vi.mock('../../../services/assetService', () => ({
    getThumbnailUrl: vi.fn().mockResolvedValue('blob:test'),
    revokeAssetUrl: vi.fn(),
}));

const meme = {
    id: 1,
    name: 'Test Meme',
    filePath: '/1.png',
    fileHash: 'hash1',
    mimeType: 'image/png',
    fileSize: 1024,
    width: 100,
    height: 100,
    sourceName: '',
    sourceUrl: '',
    description: '',
    ocrText: '',
    ocrStatus: 'PENDING' as const,
    aiStatus: 'PENDING' as const,
    tagIds: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastUsedAt: 0,
    deletedAt: 0,
    categoryId: 0,
};

describe('Gallery component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMemeStore.setState({ memes: [], isLoading: false, totalCount: 0 } as never);
        useUiStore.setState({
            activeNav: 'all',
            searchQuery: { keyword: '', tagIds: [], matchMode: 'fuzzy', mediaType: 'all', dateRange: 'all' },
            viewMode: 'grid',
            imageFit: 'contain',
            selectedMemeIds: [],
            selectMeme: vi.fn(),
            setSearchQuery: vi.fn(),
            setViewMode: vi.fn(),
            setImageFit: vi.fn(),
            setShowTags: vi.fn(),
            togglePanel: vi.fn(),
            toggleImportModal: vi.fn(),
            showTags: true,
        } as never);
        useTagStore.setState({ tags: [], isLoading: false });
    });

    it('renders empty state when no memes', () => {
        render(<Gallery />);
        expect(screen.getByText(/没有任何梗图/i)).toBeInTheDocument();
    });

    it('renders memes from store', async () => {
        useMemeStore.setState({ memes: [meme], isLoading: false, totalCount: 1 } as never);
        render(<Gallery />);
        expect(await screen.findByTitle('更多')).toBeInTheDocument();
    });
});
