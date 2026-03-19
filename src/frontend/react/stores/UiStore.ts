import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SearchQuery {
    keyword: string;
    categoryId?: number;
    tagIds: number[];
    matchMode: 'fuzzy' | 'word' | 'regex';
    mediaType: 'all' | 'image' | 'video' | 'gif';
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
}

export interface SearchHistoryItem {
    term: string;
    count: number;
    lastUsed: number;
}

export interface BrowsingHistoryItem {
    memeId: number;
    categoryId?: number;
    tagIds: number[];
    timestamp: number;
}

export interface ContextMenuState {
    memeId: number;
    x: number;
    y: number;
    anchorRect?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    preferredPlacements?: Array<'right' | 'left' | 'top' | 'bottom'>;
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
    isUrlImportDialogOpen: boolean;
    glassEffect: boolean;
    activeNav: string;
    platformOverride: 'darwin' | 'win32' | 'linux' | 'auto';
    glassBlur: number;
    galleryItemSize: number;
    cornerRadius: number;
    galleryGap: number;
    accentColor: string;
    imageFit: 'contain' | 'cover';
    showTags: boolean;
    inspectorWidth: number;
    sidebarExpanded: boolean;
    language: 'zh-CN' | 'en-US' | 'system';
    searchHistory: SearchHistoryItem[];
    browsingHistory: BrowsingHistoryItem[];
    isAdvancedSearchOpen: boolean;
    contextMenu: ContextMenuState | null;
    lightboxMemeId: number | null;

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
    toggleUrlImportDialog: (isOpen?: boolean) => void;
    toggleGlassEffect: (enabled?: boolean) => void;
    setActiveNav: (nav: string) => void;
    setPlatformOverride: (platform: 'darwin' | 'win32' | 'linux' | 'auto') => void;
    setGlassBlur: (value: number) => void;
    setGalleryItemSize: (value: number) => void;
    setCornerRadius: (value: number) => void;
    setGalleryGap: (value: number) => void;
    setAccentColor: (color: string) => void;
    setImageFit: (fit: 'contain' | 'cover') => void;
    setShowTags: (show: boolean) => void;
    setInspectorWidth: (width: number) => void;
    setSidebarExpanded: (expanded: boolean) => void;
    setLanguage: (lang: 'zh-CN' | 'en-US' | 'system') => void;
    addSearchHistory: (term: string) => void;
    clearSearchHistory: () => void;
    addBrowsingHistory: (meme: { id: number, categoryId?: number, tagIds: number[] }) => void;
    toggleAdvancedSearch: (isOpen?: boolean) => void;
    setContextMenu: (menu: ContextMenuState | null) => void;
    setLightboxMemeId: (id: number | null) => void;
}

export const useUiStore = create<UiState>()(
    persist(
        (set) => ({
            isPanelOpen: false,
            isImporting: false,
            activeTaskId: null,
            selectedMemeIds: [],
            searchQuery: {
                keyword: '',
                tagIds: [],
                matchMode: 'fuzzy',
                mediaType: 'all',
                dateRange: 'all'
            },
            viewMode: 'grid',
            theme: 'system',
            resolvedTheme: 'light',
            isSettingsOpen: false,
            isImportModalOpen: false,
            isUrlImportDialogOpen: false,
            glassEffect: false,
            activeNav: 'all',
            platformOverride: 'auto',
            glassBlur: 20,
            galleryItemSize: 200,
            cornerRadius: 12,
            galleryGap: 16,
            accentColor: '#0066cc',
            imageFit: 'cover',
            showTags: true,
            inspectorWidth: 320,
            sidebarExpanded: true,
            language: 'system',
            searchHistory: [],
            browsingHistory: [],
            isAdvancedSearchOpen: false,
            contextMenu: null,
            lightboxMemeId: null,

            togglePanel: (isOpen) =>
                set((state) => ({ isPanelOpen: isOpen !== undefined ? isOpen : !state.isPanelOpen })),

            setImporting: (isImporting, taskId = null) =>
                set({ isImporting, activeTaskId: taskId }),

            selectMeme: (id, multi = false) =>
                set((state) => {
                    const isSelected = state.selectedMemeIds.includes(id);

                    if (multi) {
                        return {
                            selectedMemeIds: isSelected
                                ? state.selectedMemeIds.filter((m) => m !== id)
                                : [...state.selectedMemeIds, id],
                        };
                    }

                    // Single select logic: deselect if already selected as the only item, 
                    // otherwise set as the only selected item.
                    if (isSelected && state.selectedMemeIds.length === 1) {
                        return { selectedMemeIds: [] };
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

            toggleUrlImportDialog: (isOpen) =>
                set((state) => ({ isUrlImportDialogOpen: isOpen !== undefined ? isOpen : !state.isUrlImportDialogOpen })),

            toggleGlassEffect: (enabled) =>
                set((state) => ({ glassEffect: enabled !== undefined ? enabled : !state.glassEffect })),

            setActiveNav: (nav: string) => set({ activeNav: nav }),

            setPlatformOverride: (platform) => set({ platformOverride: platform }),

            setGlassBlur: (value) => set({ glassBlur: value }),

            setGalleryItemSize: (value) => set({ galleryItemSize: value }),

            setCornerRadius: (value) => set({ cornerRadius: value }),

            setGalleryGap: (value) => set({ galleryGap: value }),

            setAccentColor: (color: string) => set({ accentColor: color }),

            setImageFit: (fit) => set({ imageFit: fit }),

            setShowTags: (show) => set({ showTags: show }),

            setInspectorWidth: (width) => set({ inspectorWidth: width }),

            setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

            setLanguage: (lang) => {
                set({ language: lang });
                // Note: Actual i18n.changeLanguage is often handled in a side-effect (useEffect) 
                // in the root component to ensure the store and i18n stay in sync, 
                // but we can also do it here if we import i18n.
            },

            addSearchHistory: (term) =>
                set((state) => {
                    const cleanTerm = term.trim();
                    if (!cleanTerm) return state;

                    const existingIndex = state.searchHistory.findIndex(h => h.term === cleanTerm);
                    const newHistory = [...state.searchHistory];

                    if (existingIndex >= 0) {
                        const existing = newHistory[existingIndex];
                        newHistory[existingIndex] = {
                            ...existing,
                            count: existing.count + 1,
                            lastUsed: Date.now()
                        };
                    } else {
                        newHistory.unshift({
                            term: cleanTerm,
                            count: 1,
                            lastUsed: Date.now()
                        });
                    }

                    // Sort by frequency (primary) and recency (secondary)
                    newHistory.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);

                    return { searchHistory: newHistory.slice(0, 20) }; // Keep top 20
                }),

            clearSearchHistory: () => set({ searchHistory: [] }),

            addBrowsingHistory: (meme) =>
                set((state) => {
                    const newItem: BrowsingHistoryItem = {
                        memeId: meme.id,
                        categoryId: meme.categoryId,
                        tagIds: meme.tagIds,
                        timestamp: Date.now()
                    };
                    const filtered = state.browsingHistory.filter(h => h.memeId !== meme.id);
                    return {
                        browsingHistory: [newItem, ...filtered].slice(0, 50)
                    };
                }),

            toggleAdvancedSearch: (isOpen) =>
                set((state) => ({ isAdvancedSearchOpen: isOpen !== undefined ? isOpen : !state.isAdvancedSearchOpen })),

            setContextMenu: (menu) => set({ contextMenu: menu }),

            setLightboxMemeId: (id) => set({ lightboxMemeId: id }),
        }),
        {
            name: 'quick-memes-ui-storage',
            storage: createJSONStorage(() => localStorage),
            // Only persist actual user settings, ignore transient UI state
            partialize: (state) => ({
                viewMode: state.viewMode,
                theme: state.theme,
                resolvedTheme: state.resolvedTheme,
                glassEffect: state.glassEffect,
                platformOverride: state.platformOverride,
                glassBlur: state.glassBlur,
                galleryItemSize: state.galleryItemSize,
                cornerRadius: state.cornerRadius,
                galleryGap: state.galleryGap,
                accentColor: state.accentColor,
                imageFit: state.imageFit,
                showTags: state.showTags,
                inspectorWidth: state.inspectorWidth,
                sidebarExpanded: state.sidebarExpanded,
                language: state.language,
                searchHistory: state.searchHistory,
                browsingHistory: state.browsingHistory,
            }),
            version: 1,
            migrate: (persistedState: unknown, version: number) => {
                if (version === 0) {
                    const state = persistedState as { searchHistory?: unknown[] };
                    // Migrate searchHistory from string[] to SearchHistoryItem[]
                    if (state && Array.isArray(state.searchHistory)) {
                        state.searchHistory = state.searchHistory.map((item: unknown) => {
                            if (typeof item === 'string') {
                                return {
                                    term: item,
                                    count: 1,
                                    lastUsed: Date.now()
                                };
                            }
                            return item;
                        });
                    }
                }
                return persistedState;
            },
        }
    )
);
