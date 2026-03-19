import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemeCard } from '../MemeCard';
import { useUiStore } from '../../../stores/UiStore';
import { useTagStore } from '../../../stores/TagStore';
import { useNotificationStore } from '../../../stores/NotificationStore';

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

describe('MemeCard component', () => {
    beforeEach(() => {
        useTagStore.setState({ tags: [], isLoading: false } as never);
        useNotificationStore.setState({ notifications: [], activeToasts: [], isPanelOpen: false } as never);
    });

    it('keeps selection when opening card menu for the already selected card', () => {
        const selectMeme = vi.fn();
        const togglePanel = vi.fn();
        const setContextMenu = vi.fn();

        useUiStore.setState({
            selectedMemeIds: [1],
            selectMeme,
            togglePanel,
            setContextMenu,
        } as never);

        render(
            <MemeCard
                meme={meme}
                isSelected
                viewMode="grid"
                imageFit="contain"
                showTags
            />
        );

        fireEvent.click(screen.getByTitle('更多'));

        expect(selectMeme).not.toHaveBeenCalled();
        expect(togglePanel).not.toHaveBeenCalled();
        expect(setContextMenu).toHaveBeenCalledTimes(1);
        expect(setContextMenu).toHaveBeenCalledWith(expect.objectContaining({ memeId: 1 }));
    });
});
