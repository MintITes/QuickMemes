import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../UiStore';

describe('UiStore', () => {
    beforeEach(() => {
        // Reset Zustand store state before each test
        useUiStore.setState({
            isPanelOpen: false,
            isImporting: false,
            activeTaskId: null,
            selectedMemeIds: [],
            searchQuery: { keyword: '', tagIds: [], matchMode: 'fuzzy', mediaType: 'all', dateRange: 'all' },
            viewMode: 'grid',
        });
    });

    it('should toggle panel correctly', () => {
        const store = useUiStore.getState();
        expect(store.isPanelOpen).toBe(false);

        useUiStore.getState().togglePanel();
        expect(useUiStore.getState().isPanelOpen).toBe(true);

        useUiStore.getState().togglePanel(false);
        expect(useUiStore.getState().isPanelOpen).toBe(false);
    });

    it('should handle selecting memes with multi-select', () => {
        useUiStore.getState().selectMeme(1);
        expect(useUiStore.getState().selectedMemeIds).toEqual([1]);

        useUiStore.getState().selectMeme(2, true);
        expect(useUiStore.getState().selectedMemeIds).toEqual([1, 2]);

        useUiStore.getState().selectMeme(1, true); // Toggle off 1
        expect(useUiStore.getState().selectedMemeIds).toEqual([2]);

        useUiStore.getState().clearSelection();
        expect(useUiStore.getState().selectedMemeIds).toEqual([]);
    });

    it('should update search query partially', () => {
        useUiStore.getState().setSearchQuery({ keyword: 'test' });
        expect(useUiStore.getState().searchQuery).toEqual({
            keyword: 'test',
            tagIds: [],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all'
        });

        useUiStore.getState().setSearchQuery({ tagIds: [1, 2] });
        expect(useUiStore.getState().searchQuery).toEqual({
            keyword: 'test',
            tagIds: [1, 2],
            matchMode: 'fuzzy',
            mediaType: 'all',
            dateRange: 'all'
        });
    });

    it('should set importing workflow state', () => {
        useUiStore.getState().setImporting(true, 'task-123');
        expect(useUiStore.getState().isImporting).toBe(true);
        expect(useUiStore.getState().activeTaskId).toBe('task-123');
    });
});
