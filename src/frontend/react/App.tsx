import { useEffect, useState } from 'react';
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
import { connectWebSocket, disconnectWebSocket, onEvent } from './api/wsClient';
import './index.css';

function App() {
    const {
        theme,
        setResolvedTheme,
        glassEffect,
        glassBlur,
        cornerRadius,
        galleryGap,
        accentColor,
        toggleImportModal,
        activeNav,
        searchQuery,
        language,
    } = useUiStore();

    const { addNotification, clearAll: clearNotifications } = useNotificationStore();
    const { setTask, clearTask } = useTaskStore();
    const { setMemes, setLoading, upsertMeme, removeMemes } = useMemeStore();
    const { setTags, addTag, removeTag } = useTagStore();
    const { setCategories, addCategory, updateCategory, removeCategory } = useCategoryStore();
    const [backendReady, setBackendReady] = useState(false);

    useEffect(() => {
        (window as typeof window & { debug?: unknown }).debug = {
            notify: (type: NotificationType, title: string, description?: string) => {
                addNotification({ type, title, description });
                return `[${type}] ${title}`;
            },
            clearNotifications: () => {
                clearNotifications();
                return 'ok';
            },
        };

        return () => {
            delete (window as typeof window & { debug?: unknown }).debug;
        };
    }, [addNotification, clearNotifications]);

    useEffect(() => {
        const handleGlobalDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleGlobalDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                toggleImportModal(true);
            }
        };

        window.addEventListener('dragover', handleGlobalDragOver);
        window.addEventListener('drop', handleGlobalDrop);

        return () => {
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
        const root = document.documentElement;
        if (glassEffect) {
            root.classList.add('glass-mode');
        } else {
            root.classList.remove('glass-mode');
        }

        root.style.setProperty('--glass-blur', `${glassBlur}px`);
        root.style.setProperty('--corner-radius', `${cornerRadius}px`);
        root.style.setProperty('--gallery-gap', `${galleryGap}px`);
        root.style.setProperty('--accent-color', accentColor);
    }, [glassEffect, glassBlur, cornerRadius, galleryGap, accentColor]);

    useEffect(() => {
        if (language === 'system') {
            i18n.changeLanguage(i18n.services.languageDetector.detect());
        } else {
            i18n.changeLanguage(language);
        }
    }, [language]);

    useEffect(() => {
        let disposed = false;

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
            setTask(task);
        });
        const unsubscribeTaskComplete = onEvent('task:complete', (task) => {
            setTask(task);
            addNotification({
                type: 'success',
                title: '导入完成',
                description: `成功 ${task.succeeded} 项，失败 ${task.failed} 项`,
            });
        });
        const unsubscribeTaskError = onEvent('task:error', (task) => {
            setTask(task);
            addNotification({
                type: 'error',
                title: '导入失败',
                description: task.errors.join('\n') || '任务执行失败',
            });
        });
        const unsubscribeMemeAdded = onEvent('meme:added', (meme) => upsertMeme(meme));
        const unsubscribeMemeUpdated = onEvent('meme:updated', (meme) => upsertMeme(meme));
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
                    const items = await fetchTrashMemes();
                    if (!cancelled) {
                        setMemes(items, items.length);
                    }
                    return;
                }

                const result = await searchMemes(buildBackendSearchQuery(searchQuery, activeNav));
                if (!cancelled) {
                    setMemes(result.items.map((item) => item.meme), result.total);
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
                    setMemes([], 0);
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

    return <MainShell />;
}

export default App;
