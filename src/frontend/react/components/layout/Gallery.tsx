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
} from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { EmptyState } from '../common/EmptyState';
import { useUiStore } from '../../stores/UiStore';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MemeCard } from './MemeCard';


export function Gallery() {
    const { t } = useTranslation();
    const memes = useMemeStore((state) => state.memes);
    const activeNav = useUiStore((state) => state.activeNav);
    const searchQuery = useUiStore((state) => state.searchQuery);
    const setSearchQuery = useUiStore((state) => state.setSearchQuery);

    const {
        viewMode,
        setViewMode,
        imageFit,
        setImageFit,
        showTags,
        setShowTags,
        selectedMemeIds,
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
                            if (!meme) {
                                return null;
                            }
                            const isSelected = selectedMemeIds.includes(meme.id);

                            return (
                                <MemeCard
                                    key={meme.id}
                                    meme={meme}
                                    isSelected={isSelected}
                                    viewMode={viewMode}
                                    imageFit={imageFit}
                                    showTags={showTags}
                                />
                            );
                        }}
                    />
                )}
            </div>
        </main>
    );
}
