import { startTransition, useEffect, useRef, useState } from 'react';
import { MainShell } from './components/layout/MainShell';
import { useUiStore } from './stores/UiStore';
import i18n from './i18n/config';
import { useNotificationStore, type NotificationType } from './stores/NotificationStore';
import { useTaskStore } from './stores/TaskStore';
import { useMemeStore } from './stores/MemeStore';
import { useTagStore } from './stores/TagStore';
import { useCategoryStore } from './stores/CategoryStore';
import { fetchCategories } from './services/categoryService';
import { fetchTags } from './services/tagService';
import { buildBackendSearchQuery, fetchTrashMemes, searchMemes } from './services/memeService';

export const PAGE_SIZE = 50;
import { connectWebSocket, disconnectWebSocket, onEvent } from './api/wsClient';
import {
    isDuplicateImportErrorMessage,
    isDuplicateImportTaskError,
    mergeImportTaskUpdate,
} from './utils/taskEvents';
import { shouldRefreshVisibleMemes } from './utils/visibleMemes';
import { FpsOverlay } from './components/common/FpsOverlay';
import { useShallow } from 'zustand/react/shallow';
import './index.css';

function ThemeTokenSync() {
    const glassEffect = useUiStore((state) => state.glassEffect);
    const glassBlur = useUiStore((state) => state.glassBlur);
    const cornerRadius = useUiStore((state) => state.cornerRadius);
    const galleryGap = useUiStore((state) => state.galleryGap);
    const accentColor = useUiStore((state) => state.accentColor);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('glass-mode', glassEffect);
        root.style.setProperty('--glass-blur', `${glassBlur}px`);
        root.style.setProperty('--corner-radius', `${cornerRadius}px`);
        root.style.setProperty('--gallery-gap', `${galleryGap}px`);
        root.style.setProperty('--accent-color', accentColor);
    }, [accentColor, cornerRadius, glassBlur, galleryGap, glassEffect]);

    return null;
}

function App() {
    const {
        theme,
        setResolvedTheme,
        toggleImportModal,
        activeNav,
        searchQuery,
        language,
    } = useUiStore(useShallow((state) => ({
        theme: state.theme,
        setResolvedTheme: state.setResolvedTheme,
        toggleImportModal: state.toggleImportModal,
        activeNav: state.activeNav,
        searchQuery: state.searchQuery,
        language: state.language,
    })));

    const { addNotification, clearAll: clearNotifications } = useNotificationStore();
    const { setTask, clearTask } = useTaskStore();
    const { setMemes, setLoading, upsertMeme, removeMemes, appendMemes, setLoadingMore } = useMemeStore();
    const { setTags, addTag, removeTag } = useTagStore();
    const { setCategories, addCategory, updateCategory, removeCategory } = useCategoryStore();
    const [backendReady, setBackendReady] = useState(false);
    const [fpsEnabled, setFpsEnabled] = useState(false);
    const fpsEnabledRef = useRef(false);
    const visibleMemesRefreshTimerRef = useRef<number | null>(null);
    const loadMoreLockRef = useRef(false);

    // 暴露给 Gallery 使用，避免 prop drilling
    useEffect(() => {
        (window as Window & { __loadMoreMemes?: () => void }).__loadMoreMemes = async () => {
            const { isLoadingMore, hasMore, memes } = useMemeStore.getState();
            const { activeNav, searchQuery } = useUiStore.getState();
            // trash 还没有分页支持，跳过
            if (activeNav === 'trash' || isLoadingMore || !hasMore || loadMoreLockRef.current) return;

            loadMoreLockRef.current = true;
            setLoadingMore(true);
            try {
                const result = await searchMemes(
                    buildBackendSearchQuery(searchQuery, activeNav, {
                        limit: PAGE_SIZE,
                        offset: memes.length,
                    })
                );
                appendMemes(result.items.map((item) => item.meme));
            } catch {
                // 静默失败，保持当前列表不变
            } finally {
                setLoadingMore(false);
                loadMoreLockRef.current = false;
            }
        };

        return () => {
            delete (window as Window & { __loadMoreMemes?: () => void }).__loadMoreMemes;
        };
    }, [appendMemes, setLoadingMore]);

    useEffect(() => {
        fpsEnabledRef.current = fpsEnabled;
    }, [fpsEnabled]);

    useEffect(() => () => {
        if (visibleMemesRefreshTimerRef.current) {
            window.clearTimeout(visibleMemesRefreshTimerRef.current);
        }
    }, []);

    useEffect(() => {
        (window as Window & { debug?: NonNullable<Window['debug']> }).debug = {
            notify: (type: NotificationType, title: string, description?: string) => {
                addNotification({ type, title, description });
                return `[${type}] ${title}`;
            },
            clearNotifications: () => {
                clearNotifications();
                return 'ok';
            },
            fps: (enabled?: boolean) => {
                const nextValue = typeof enabled === 'boolean' ? enabled : !fpsEnabledRef.current;
                fpsEnabledRef.current = nextValue;
                setFpsEnabled(nextValue);
                return nextValue ? 'fps:on' : 'fps:off';
            },
        };

        return () => {
            delete (window as Window & { debug?: NonNullable<Window['debug']> }).debug;
        };
    }, [addNotification, clearNotifications]);

    useEffect(() => {
        const isFileDrag = (e: DragEvent) => {
            const types = e.dataTransfer?.types;
            return types ? Array.from(types).includes('Files') : false;
        };

        const openImportModalForFileDrag = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (isFileDrag(e)) {
                toggleImportModal(true);
            }
        };

        const handleGlobalDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleGlobalDragEnter = (e: DragEvent) => {
            openImportModalForFileDrag(e);
        };

        const handleGlobalDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                toggleImportModal(true);
            }
        };

        window.addEventListener('dragenter', handleGlobalDragEnter);
        window.addEventListener('dragover', handleGlobalDragOver);
        window.addEventListener('drop', handleGlobalDrop);

        return () => {
            window.removeEventListener('dragenter', handleGlobalDragEnter);
            window.removeEventListener('dragover', handleGlobalDragOver);
            window.removeEventListener('drop', handleGlobalDrop);
        };
    }, [toggleImportModal]);

    useEffect(() => {
        const root = document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            const isDark = theme === 'system' ? mediaQuery.matches : theme === 'dark';

            if (isDark) {
                root.classList.add('dark');
                setResolvedTheme('dark');
            } else {
                root.classList.remove('dark');
                setResolvedTheme('light');
            }
        };

        applyTheme();

        if (theme === 'system') {
            mediaQuery.addEventListener('change', applyTheme);
            return () => mediaQuery.removeEventListener('change', applyTheme);
        }
    }, [theme, setResolvedTheme]);

    useEffect(() => {
        if (language === 'system') {
            i18n.changeLanguage(i18n.services.languageDetector.detect());
        } else {
            i18n.changeLanguage(language);
        }
    }, [language]);

    useEffect(() => {
        let disposed = false;
        const scheduleVisibleMemesRefresh = () => {
            const { activeNav: currentActiveNav, searchQuery: currentSearchQuery } = useUiStore.getState();
            if (!shouldRefreshVisibleMemes(currentActiveNav, currentSearchQuery)) {
                return;
            }

            if (visibleMemesRefreshTimerRef.current) {
                window.clearTimeout(visibleMemesRefreshTimerRef.current);
            }

            visibleMemesRefreshTimerRef.current = window.setTimeout(() => {
                visibleMemesRefreshTimerRef.current = null;
                const { activeNav: latestActiveNav, searchQuery: latestSearchQuery } = useUiStore.getState();
                if (!shouldRefreshVisibleMemes(latestActiveNav, latestSearchQuery)) {
                    return;
                }

                // 刷新时拉取已加载数量，防止截断用户已滚动到的内容
                const alreadyLoaded = useMemeStore.getState().memes.length;
                const refreshLimit = Math.max(PAGE_SIZE, alreadyLoaded);
                void searchMemes(buildBackendSearchQuery(latestSearchQuery, latestActiveNav, { limit: refreshLimit }))
                    .then((result) => {
                        startTransition(() => {
                            setMemes(result.items.map((item) => item.meme), result.total);
                        });
                    })
                    .catch(() => {
                        // The local optimistic update remains visible if the refresh fails.
                    });
            }, 120);
        };

        const initialize = async () => {
            const status = await window.electronAPI.getBackendStatus();
            if (!status.ready) {
                setBackendReady(false);
                return;
            }
            setBackendReady(true);

            const [categories, tags] = await Promise.all([
                fetchCategories(),
                fetchTags(),
            ]);

            if (disposed) {
                return;
            }

            setCategories(categories);
            setTags(tags);
            await connectWebSocket();
        };

        void initialize();
        const unsubscribeStatus = window.electronAPI.onBackendStatusChange((status) => {
            if (status.ready) {
                setBackendReady(true);
                void initialize();
            } else {
                setBackendReady(false);
            }
            if (status.lastError) {
                addNotification({
                    type: 'error',
                    title: '后端状态异常',
                    description: status.lastError,
                });
            }
        });

        const unsubscribeTaskProgress = onEvent('task:progress', (task) => {
            const nextTask = mergeImportTaskUpdate(task, useTaskStore.getState().activeTask);
            if (nextTask) {
                setTask(nextTask);
            }
        });
        const unsubscribeTaskComplete = onEvent('task:complete', (task) => {
            const nextTask = mergeImportTaskUpdate(task, useTaskStore.getState().activeTask);
            if (!nextTask) {
                return;
            }

            setTask(nextTask);
            const duplicateOnlyFailures = nextTask.failed > 0
                && nextTask.succeeded === 0
                && nextTask.errors.length > 0
                && nextTask.errors.every((message) => isDuplicateImportErrorMessage(message));

            if (duplicateOnlyFailures) {
                addNotification({
                    type: 'info',
                    title: 'Meme已存在',
                    description: `已跳过 ${nextTask.failed} 张重复图片`,
                });
                return;
            }

            addNotification({
                type: 'success',
                title: '导入完成',
                description: `成功 ${nextTask.succeeded} 项，失败 ${nextTask.failed} 项`,
            });
        });
        const unsubscribeTaskError = onEvent('task:error', (task) => {
            const nextTask = mergeImportTaskUpdate(task, useTaskStore.getState().activeTask);
            if (!nextTask) {
                return;
            }

            setTask(nextTask);
            if (isDuplicateImportTaskError(task)) {
                return;
            }
            addNotification({
                type: 'error',
                title: '导入失败',
                description: nextTask.errors.join('\n') || '任务执行失败',
            });
        });
        const unsubscribeMemeAdded = onEvent('meme:added', (meme) => {
            upsertMeme(meme);
            scheduleVisibleMemesRefresh();
        });
        const unsubscribeMemeUpdated = onEvent('meme:updated', (meme) => {
            upsertMeme(meme);
            scheduleVisibleMemesRefresh();
        });
        const unsubscribeMemeDeleted = onEvent('meme:deleted', ({ id }) => removeMemes([id]));
        const unsubscribeMemeUsed = onEvent('meme:used', ({ id, lastUsedAt }) => {
            upsertMeme({
                ...(useMemeStore.getState().memes.find((meme) => meme.id === id) ?? {
                    id,
                    filePath: '',
                    fileHash: '',
                    mimeType: '',
                    fileSize: 0,
                    width: 0,
                    height: 0,
                    sourceName: '',
                    sourceUrl: '',
                    name: '',
                    description: '',
                    ocrText: '',
                    ocrStatus: 'PENDING',
                    aiStatus: 'PENDING',
                    tagIds: [],
                    tags: [],
                    createdAt: 0,
                    updatedAt: 0,
                    lastUsedAt,
                    deletedAt: 0,
                    categoryId: 0,
                }),
                lastUsedAt,
            });

            const { activeNav, searchQuery } = useUiStore.getState();
            if (activeNav !== 'recent') {
                return;
            }

            void searchMemes(buildBackendSearchQuery(searchQuery, activeNav))
                .then((result) => {
                    startTransition(() => {
                        setMemes(result.items.map((item) => item.meme), result.total);
                    });
                })
                .catch(() => {
                    // Keep the optimistic timestamp update if the background refresh fails.
                });
        });
        const unsubscribeTagCreated = onEvent('tag:created', (tag) => addTag(tag));
        const unsubscribeTagDeleted = onEvent('tag:deleted', ({ id }) => removeTag(id));
        const unsubscribeCategoryCreated = onEvent('category:created', (category) => addCategory(category));
        const unsubscribeCategoryUpdated = onEvent('category:updated', (category) => updateCategory(category.id, category));
        const unsubscribeCategoryDeleted = onEvent('category:deleted', ({ id }) => removeCategory(id));

        return () => {
            disposed = true;
            unsubscribeStatus();
            unsubscribeTaskProgress();
            unsubscribeTaskComplete();
            unsubscribeTaskError();
            unsubscribeMemeAdded();
            unsubscribeMemeUpdated();
            unsubscribeMemeDeleted();
            unsubscribeMemeUsed();
            unsubscribeTagCreated();
            unsubscribeTagDeleted();
            unsubscribeCategoryCreated();
            unsubscribeCategoryUpdated();
            unsubscribeCategoryDeleted();
            clearTask();
            disconnectWebSocket();
        };
    }, [
        addCategory,
        addNotification,
        addTag,
        clearTask,
        removeCategory,
        removeMemes,
        removeTag,
        setCategories,
        setMemes,
        setTags,
        setTask,
        updateCategory,
        upsertMeme,
    ]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!backendReady) {
                setLoading(false);
                return;
            }
            setLoading(true);

            try {
                if (activeNav === 'trash') {
                    const result = await fetchTrashMemes();
                    if (!cancelled) {
                        startTransition(() => {
                            setMemes(result.items.map((item) => item.meme), result.total);
                        });
                    }
                    return;
                }

                const result = await searchMemes(buildBackendSearchQuery(searchQuery, activeNav, { limit: PAGE_SIZE }));
                if (!cancelled) {
                    startTransition(() => {
                        setMemes(result.items.map((item) => item.meme), result.total);
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : String(error);
                    if (message.toLowerCase().includes('failed to fetch')) {
                        return;
                    }
                    addNotification({
                        type: 'error',
                        title: '加载失败',
                        description: message,
                    });
                    startTransition(() => {
                        setMemes([], 0);
                    });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [activeNav, addNotification, backendReady, searchQuery, setLoading, setMemes]);

    return (
        <>
            <ThemeTokenSync />
            <MainShell />
            {fpsEnabled && <FpsOverlay />}
        </>
    );
}

export default App;
