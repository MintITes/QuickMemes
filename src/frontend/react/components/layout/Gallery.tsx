import { useEffect, useState } from 'react';
import { useMemeStore } from '../../stores/MemeStore';
import { VirtuosoGrid } from 'react-virtuoso';
import {
    ArrowLeft,
    ArrowRight,
    LayoutGrid,
    Columns3,
    Box,
    Crop,
    Tag,
    ImagePlus,
    SearchX,
    Inbox,
    Sparkles,
    Copy,
    MoreHorizontal,
    Check,
    Info,
    Image as ImageIcon,
} from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { EmptyState } from '../common/EmptyState';
import { useUiStore } from '../../stores/UiStore';
import { useTagStore } from '../../stores/TagStore';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { getThumbnailUrl, revokeAssetUrl } from '../../services/assetService';
import { useNotificationStore } from '../../stores/NotificationStore';

function MemeCardImage({ memeId, alt, imageFit }: { memeId: number; alt: string; imageFit: 'contain' | 'cover' }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        void getThumbnailUrl(memeId).then((nextUrl) => {
            if (!cancelled) {
                setSrc(nextUrl);
            }
        }).catch(() => {
            if (!cancelled) {
                setSrc(null);
            }
        });

        return () => {
            cancelled = true;
            revokeAssetUrl(`thumb:${memeId}`);
            revokeAssetUrl(`file:${memeId}`);
        };
    }, [memeId]);

    if (!src) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5">
                <ImageIcon className="text-textSecondary/40" size={36} />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={clsx(
                'w-full h-full transition-transform duration-300',
                imageFit === 'contain' ? 'object-contain p-4' : 'object-cover'
            )}
        />
    );
}

export function Gallery() {
    const { t } = useTranslation();
    const memes = useMemeStore((state) => state.memes);
    const activeNav = useUiStore((state) => state.activeNav);
    const searchQuery = useUiStore((state) => state.searchQuery);
    const setSearchQuery = useUiStore((state) => state.setSearchQuery);
    const tags = useTagStore((state) => state.tags);
    const addNotification = useNotificationStore((state) => state.addNotification);

    const {
        viewMode,
        setViewMode,
        imageFit,
        setImageFit,
        showTags,
        setShowTags,
        selectedMemeIds,
        selectMeme,
        togglePanel,
        toggleImportModal,
    } = useUiStore();

    const renderEmptyState = () => {
        if (searchQuery.keyword) {
            return (
                <EmptyState
                    icon={<SearchX size={48} />}
                    title={t('gallery.empty.search_no_results')}
                    description={t('gallery.empty.search_no_results_desc', { keyword: searchQuery.keyword })}
                    action={{
                        label: t('gallery.empty.clear_search'),
                        onClick: () => setSearchQuery({ keyword: '' }),
                        icon: <SearchX size={16} />,
                    }}
                />
            );
        }

        if (activeNav === 'trash') {
            return (
                <EmptyState
                    icon={<Inbox size={48} />}
                    title={t('gallery.empty.trash_empty')}
                    description={t('gallery.empty.trash_empty_desc')}
                />
            );
        }

        if (activeNav === 'untagged') {
            return (
                <EmptyState
                    icon={<Sparkles size={48} />}
                    title={t('gallery.empty.untagged_empty')}
                    description={t('gallery.empty.untagged_empty_desc')}
                />
            );
        }

        return (
            <EmptyState
                icon={<ImagePlus size={48} />}
                title={t('gallery.empty.no_memes')}
                description={t('gallery.empty.no_memes_desc')}
                action={{
                    label: t('gallery.empty.import_first'),
                    onClick: () => toggleImportModal(true),
                    icon: <ImagePlus size={16} />,
                }}
            />
        );
    };

    return (
        <main className="flex-1 h-full surface-effect flex flex-col relative z-0 overflow-hidden shadow-none box-border">
            <div className="h-12 mx-4 mt-3 mb-2 rounded-xl border border-borderColor flex px-4 items-center justify-between glass-effect z-10 sticky top-3">
                <div className="flex gap-1.5">
                    <IconButton icon={<ArrowLeft size={18} />} size="sm" variant="ghost" title={t('gallery.controls.back')} />
                    <IconButton icon={<ArrowRight size={18} />} size="sm" variant="ghost" disabled title={t('gallery.controls.forward')} />
                </div>

                <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 items-center">
                    <div className="flex">
                        <IconButton
                            icon={imageFit === 'contain' ? <Box size={16} /> : <Crop size={16} />}
                            size="sm"
                            variant="ghost"
                            active={imageFit === 'contain'}
                            onClick={() => setImageFit(imageFit === 'contain' ? 'cover' : 'contain')}
                            title={imageFit === 'contain' ? t('gallery.controls.original_ratio') : t('gallery.controls.fill_crop')}
                            className="rounded-lg"
                        />
                        <IconButton
                            icon={<Tag size={16} />}
                            size="sm"
                            variant="ghost"
                            active={showTags}
                            onClick={() => setShowTags(!showTags)}
                            title={showTags ? t('gallery.controls.hide_tags') : t('gallery.controls.show_tags')}
                            className="rounded-lg"
                        />
                    </div>

                    <div className="w-px h-3 bg-borderColor/40 mx-1.5" />

                    <div className="flex">
                        <IconButton
                            icon={<LayoutGrid size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                            className="rounded-lg"
                            title={t('gallery.controls.grid_view')}
                        />
                        <IconButton
                            icon={<Columns3 size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'masonry'}
                            onClick={() => setViewMode('masonry')}
                            className="rounded-lg"
                            title={t('gallery.controls.masonry_view')}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {memes.length === 0 ? renderEmptyState() : (
                    <VirtuosoGrid
                        totalCount={memes.length}
                        listClassName={clsx(
                            'grid gap-4 w-full pb-8',
                            viewMode === 'grid'
                                ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
                                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                        )}
                        itemContent={(index) => {
                            const meme = memes[index];
                            const isSelected = selectedMemeIds.includes(meme.id);
                            const memeTags = tags.filter((entry) => meme.tagIds.includes(entry.id));

                            return (
                                <div
                                    className={clsx(
                                        'flex flex-col gap-2 group cursor-pointer',
                                        viewMode === 'masonry' && 'mb-4'
                                    )}
                                    onClick={(event) => selectMeme(meme.id, event.metaKey || event.ctrlKey)}
                                >
                                    <div className={clsx(
                                        'w-full bg-white dark:bg-white/5 rounded-xl border flex items-center justify-center relative group overflow-hidden transition-[box-shadow,transform] duration-300',
                                        isSelected ? 'border-accent ring-2 ring-accent/30 shadow-lg' : 'border-borderColor hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1',
                                        viewMode === 'grid' ? 'aspect-square' : 'min-h-[150px]'
                                    )}>
                                        <MemeCardImage memeId={meme.id} alt={meme.name} imageFit={imageFit} />

                                        <div className={clsx(
                                            'absolute inset-0 border-2 rounded-xl transition-colors pointer-events-none',
                                            isSelected ? 'border-accent/40' : 'border-transparent group-hover:border-accent/30'
                                        )} />

                                        {isSelected && (
                                            <div className="absolute top-2 left-2 w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center shadow-md">
                                                <Check size={12} strokeWidth={4} />
                                            </div>
                                        )}

                                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
                                            <IconButton
                                                icon={<Copy size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={async (event) => {
                                                    event.stopPropagation();
                                                    try {
                                                        await window.electronAPI.writeClipboardImageFromMeme(meme.id);
                                                        addNotification({
                                                            type: 'success',
                                                            title: t('gallery.item.copy_image'),
                                                            description: meme.name,
                                                        });
                                                    } catch (error) {
                                                        addNotification({
                                                            type: 'error',
                                                            title: t('gallery.item.copy_image'),
                                                            description: error instanceof Error ? error.message : String(error),
                                                        });
                                                    }
                                                }}
                                                title={t('gallery.item.copy_image')}
                                            />
                                            <IconButton
                                                icon={<Info size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    selectMeme(meme.id);
                                                    togglePanel(true);
                                                }}
                                                title={t('gallery.item.view_details')}
                                            />
                                            <IconButton
                                                icon={<MoreHorizontal size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={(event) => event.stopPropagation()}
                                                title={t('gallery.item.more')}
                                            />
                                        </div>
                                    </div>

                                    {(showTags || viewMode === 'grid') && (
                                        <div className="px-1 flex flex-col gap-0.5">
                                            <span className={clsx(
                                                'text-xs font-medium truncate transition-colors',
                                                isSelected ? 'text-accent' : 'text-textPrimary'
                                            )}>
                                                {meme.name}
                                            </span>
                                            {showTags && memeTags.length > 0 && (
                                                <div className="flex gap-1 overflow-hidden flex-wrap">
                                                    {memeTags.slice(0, 3).map((tagEntry) => (
                                                        <span
                                                            key={tagEntry.id}
                                                            className="text-[10px] text-accent font-medium px-1.5 py-0.5 bg-accent/10 rounded-md"
                                                        >
                                                            {tagEntry.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }}
                    />
                )}
            </div>
        </main>
    );
}
