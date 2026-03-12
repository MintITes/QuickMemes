import { create } from 'zustand';

export interface SearchQuery {
    keyword: string;
    categoryId?: string;
    tagIds: number[];
}

export interface UiState {
    isPanelOpen: boolean;
    isImporting: boolean;
    activeTaskId: string | null;
    selectedMemeIds: number[]; // Support multi-select, replaced selectedMemeId
    searchQuery: SearchQuery;
    viewMode: 'grid' | 'masonry' | 'list';
    theme: 'light' | 'dark' | 'system';
    resolvedTheme: 'light' | 'dark';
    isSettingsOpen: boolean;
    isImportModalOpen: boolean;
    glassEffect: boolean;
    activeNav: string;
    platformOverride: 'darwin' | 'win32' | 'linux' | 'auto';
    glassBlur: number;
    cornerRadius: number;
    galleryGap: number;
    accentColor: string;

    // Actions
    togglePanel: (isOpen?: boolean) => void;
    setImporting: (isImporting: boolean, taskId?: string | null) => void;
    selectMeme: (id: number, multi?: boolean, range?: boolean) => void;
    clearSelection: () => void;
    setSearchQuery: (query: Partial<SearchQuery>) => void;
    setViewMode: (mode: 'grid' | 'masonry' | 'list') => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setResolvedTheme: (theme: 'light' | 'dark') => void;
    toggleSettings: (isOpen?: boolean) => void;
    toggleImportModal: (isOpen?: boolean) => void;
    toggleGlassEffect: (enabled?: boolean) => void;
    setActiveNav: (nav: string) => void;
    setPlatformOverride: (platform: 'darwin' | 'win32' | 'linux' | 'auto') => void;
    setGlassBlur: (value: number) => void;
    setCornerRadius: (value: number) => void;
    setGalleryGap: (value: number) => void;
    setAccentColor: (color: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
    isPanelOpen: false,
    isImporting: false,
    activeTaskId: null,
    selectedMemeIds: [],
    searchQuery: { keyword: '', tagIds: [] },
    viewMode: 'grid',
    theme: 'system',
    resolvedTheme: 'light',
    isSettingsOpen: false,
    isImportModalOpen: false,
    glassEffect: false,
    activeNav: 'all',
    platformOverride: 'auto',
    glassBlur: 20,
    cornerRadius: 12,
    galleryGap: 16,
    accentColor: '#0066cc',

    togglePanel: (isOpen) =>
        set((state) => ({ isPanelOpen: isOpen !== undefined ? isOpen : !state.isPanelOpen })),

    setImporting: (isImporting, taskId = null) =>
        set({ isImporting, activeTaskId: taskId }),

    selectMeme: (id, multi = false) =>
        set((state) => {
            if (multi) {
                const isSelected = state.selectedMemeIds.includes(id);
                return {
                    selectedMemeIds: isSelected
                        ? state.selectedMemeIds.filter((m) => m !== id)
                        : [...state.selectedMemeIds, id],
                };
            }
            return { selectedMemeIds: [id] };
        }),

    clearSelection: () => set({ selectedMemeIds: [] }),

    setSearchQuery: (query) =>
        set((state) => ({ searchQuery: { ...state.searchQuery, ...query } })),

    setViewMode: (mode) => set({ viewMode: mode }),

    setTheme: (theme) => set({ theme }),

    setResolvedTheme: (theme) => set({ resolvedTheme: theme }),

    toggleSettings: (isOpen) =>
        set((state) => ({ isSettingsOpen: isOpen !== undefined ? isOpen : !state.isSettingsOpen })),

    toggleImportModal: (isOpen) =>
        set((state) => ({ isImportModalOpen: isOpen !== undefined ? isOpen : !state.isImportModalOpen })),

    toggleGlassEffect: (enabled) =>
        set((state) => ({ glassEffect: enabled !== undefined ? enabled : !state.glassEffect })),

    setActiveNav: (nav: string) => set({ activeNav: nav }),

    setPlatformOverride: (platform) => set({ platformOverride: platform }),

    setGlassBlur: (value) => set({ glassBlur: value }),

    setCornerRadius: (value) => set({ cornerRadius: value }),

    setGalleryGap: (value) => set({ galleryGap: value }),

    setAccentColor: (color) => set({ accentColor: color }),
}));
