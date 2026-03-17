import { render, screen, fireEvent } from '@testing-library/react';
import { Inspector } from '../Inspector';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';
import { useMemeStore } from '../../../stores/MemeStore';

vi.mock('../../../services/assetService', () => ({
    getFileUrl: vi.fn().mockResolvedValue('blob:test'),
    revokeAssetUrl: vi.fn(),
}));

const mockMemes = [
    {
        id: 1,
        name: 'Meme 1',
        filePath: '/test.png',
        fileHash: 'hash1',
        mimeType: 'image/png',
        fileSize: 1024,
        width: 800,
        height: 600,
        sourceName: '',
        sourceUrl: 'http://example.com',
        description: 'Hello World',
        ocrText: 'Hello World',
        ocrStatus: 'DONE' as const,
        aiStatus: 'DONE' as const,
        tagIds: [],
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastUsedAt: 0,
        deletedAt: 0,
        categoryId: 0,
    },
    {
        id: 2,
        name: 'Meme 2',
        filePath: '/test2.jpg',
        fileHash: 'hash2',
        mimeType: 'image/jpeg',
        fileSize: 2048,
        width: 1024,
        height: 768,
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
    },
];

describe('Inspector component', () => {
    beforeEach(() => {
        useUiStore.setState({
            selectedMemeIds: [],
            isPanelOpen: true,
            inspectorWidth: 300,
            togglePanel: vi.fn(),
            setInspectorWidth: vi.fn(),
            selectMeme: vi.fn(),
        } as never);
        useMemeStore.setState({ memes: mockMemes, isLoading: false, totalCount: 2 } as never);
    });

    it('renders empty state when no selection', () => {
        render(<Inspector />);
        expect(screen.getByText(/未选中/i)).toBeInTheDocument();
    });

    it('renders meme details for single selection', () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        render(<Inspector />);
        expect(screen.getByText('Meme 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument();
        expect(screen.getByDisplayValue('http://example.com')).toBeInTheDocument();
    });

    it('renders batch actions for multiple selection', () => {
        useUiStore.setState({ selectedMemeIds: [1, 2] } as never);
        render(<Inspector />);
        expect(screen.getByText(/批量编辑/i)).toBeInTheDocument();
    });

    it('toggles panel close', () => {
        render(<Inspector />);
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(useUiStore.getState().togglePanel).toHaveBeenCalledWith(false);
    });
});
