import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Inspector } from '../Inspector';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';
import { useMemeStore } from '../../../stores/MemeStore';
import { useTagStore } from '../../../stores/TagStore';
import { useNotificationStore } from '../../../stores/NotificationStore';
import { HttpError } from '../../../api/httpClient';

const createTagMock = vi.fn();
const fetchTagsMock = vi.fn();
const addTagToMemeMock = vi.fn();
const removeTagFromMemeMock = vi.fn();
const updateMemeMock = vi.fn();

vi.mock('../../../services/tagService', () => ({
    createTag: (...args: unknown[]) => createTagMock(...args),
    fetchTags: (...args: unknown[]) => fetchTagsMock(...args),
    addTagToMeme: (...args: unknown[]) => addTagToMemeMock(...args),
    removeTagFromMeme: (...args: unknown[]) => removeTagFromMemeMock(...args),
}));

vi.mock('../../../services/memeService', () => ({
    updateMeme: (...args: unknown[]) => updateMemeMock(...args),
}));

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
        createTagMock.mockReset();
        fetchTagsMock.mockReset();
        addTagToMemeMock.mockReset();
        removeTagFromMemeMock.mockReset();
        updateMemeMock.mockReset();
        updateMemeMock.mockImplementation(async (id: number, patch: Record<string, unknown>) => ({
            ...mockMemes.find((meme) => meme.id === id)!,
            ...patch,
        }));
        useUiStore.setState({
            selectedMemeIds: [],
            isPanelOpen: true,
            inspectorWidth: 300,
            togglePanel: vi.fn(),
            setInspectorWidth: vi.fn(),
            selectMeme: vi.fn(),
        } as never);
        useMemeStore.setState({ memes: mockMemes, isLoading: false, totalCount: 2 } as never);
        useTagStore.setState({ tags: [], isLoading: false } as never);
        useNotificationStore.setState({ notifications: [], activeToasts: [], isPanelOpen: false } as never);
    });

    it('renders empty state when no selection', () => {
        render(<Inspector />);
        expect(screen.getByText(/未选择/i)).toBeInTheDocument();
    });

    it('renders meme details for single selection', () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        render(<Inspector />);
        expect(screen.getByDisplayValue('Meme 1')).toBeInTheDocument();
        expect(screen.getAllByDisplayValue('Hello World')).not.toHaveLength(0);
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

    it('submits tag once when Enter is followed by blur', async () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        createTagMock.mockResolvedValue({
            id: 9,
            name: 'funny',
            color: '#000000',
            createdAt: Date.now(),
        });
        addTagToMemeMock.mockResolvedValue(null);

        render(<Inspector />);

        fireEvent.click(await screen.findByRole('button', { name: '+' }));
        const input = await screen.findByPlaceholderText('New tag...');
        fireEvent.change(input, { target: { value: 'funny' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.blur(input, { target: { value: 'funny' } });

        await waitFor(() => {
            expect(createTagMock).toHaveBeenCalledTimes(1);
        });
        expect(addTagToMemeMock).toHaveBeenCalledTimes(1);
        expect(addTagToMemeMock).toHaveBeenCalledWith(1, 9);
    });

    it('reuses existing tag after duplicate-name conflict', async () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        createTagMock.mockRejectedValue(new HttpError(409, 'duplicate'));
        fetchTagsMock.mockResolvedValue([
            { id: 5, name: 'Funny', color: '#000000', createdAt: Date.now() },
        ]);
        addTagToMemeMock.mockResolvedValue(null);

        render(<Inspector />);

        fireEvent.click(await screen.findByRole('button', { name: '+' }));
        const input = await screen.findByPlaceholderText('New tag...');
        fireEvent.change(input, { target: { value: 'funny' } });
        fireEvent.blur(input, { target: { value: 'funny' } });

        await waitFor(() => {
            expect(fetchTagsMock).toHaveBeenCalledTimes(1);
        });
        expect(addTagToMemeMock).toHaveBeenCalledWith(1, 5);
        expect(useTagStore.getState().tags).toEqual([
            { id: 5, name: 'Funny', color: '#000000', createdAt: expect.any(Number) },
        ]);
    });

    it('updates meme name in store immediately on blur', async () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        render(<Inspector />);

        const input = screen.getByDisplayValue('Meme 1');
        fireEvent.change(input, { target: { value: 'Renamed Meme' } });
        fireEvent.blur(input);

        expect(useMemeStore.getState().memes.find((meme) => meme.id === 1)?.name).toBe('Renamed Meme');
        await waitFor(() => {
            expect(updateMemeMock).toHaveBeenCalledWith(1, { name: 'Renamed Meme' });
        });
    });

    it('syncs name input when meme store updates externally', async () => {
        useUiStore.setState({ selectedMemeIds: [1] } as never);
        render(<Inspector />);

        useMemeStore.getState().updateMeme(1, { name: 'Store Updated Name' });

        await waitFor(() => {
            expect(screen.getByDisplayValue('Store Updated Name')).toBeInTheDocument();
        });
    });
});
