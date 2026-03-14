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
    Info
} from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { EmptyState } from '../common/EmptyState';
import { useUiStore } from '../../stores/UiStore';
import { useTagStore } from '../../stores/TagStore';
import clsx from 'clsx';

export function Gallery() {
    const memes = useMemeStore(state => state.memes);
    const activeNav = useUiStore(state => state.activeNav);
    const searchQuery = useUiStore(state => state.searchQuery);
    const setSearchQuery = useUiStore(state => state.setSearchQuery);
    const tags = useTagStore(state => state.tags);

    const {
        viewMode, setViewMode,
        imageFit, setImageFit,
        showTags, setShowTags,
        selectedMemeIds, selectMeme,
        togglePanel
    } = useUiStore();

    const renderEmptyState = () => {
        // ... (preserving existing renderEmptyState logic)
        // 1. Search Results Empty
        if (searchQuery.keyword) {
            return (
                <EmptyState
                    icon={<SearchX size={48} />}
                    title="没有找到匹配的梗图"
                    description={`未发现与 "${searchQuery.keyword}" 相关的梗图...`}
                    action={{
                        label: "清除搜索",
                        onClick: () => setSearchQuery({ keyword: '' }),
                        icon: <SearchX size={16} />
                    }}
                />
            );
        }

        // 2. Trash Empty
        if (activeNav === 'trash') {
            return (
                <EmptyState
                    icon={<Inbox size={48} />}
                    title="回收站是空的"
                    description="保持整洁是个好习惯！回收站目前没有任何内容。"
                />
            );
        }

        // 3. Untagged Empty
        if (activeNav === 'untagged') {
            return (
                <EmptyState
                    icon={<Sparkles size={48} />}
                    title="所有梗图都已打上标签"
                    description="真棒！库里所有的梗图都有了分类标识。"
                />
            );
        }

        // 4. Default Empty (Initial Library Empty)
        return (
            <EmptyState
                icon={<ImagePlus size={48} />}
                title="没有任何梗图"
                description="快把好玩的图拖拽进来，或者点击下方的按钮导入吧！"
                action={{
                    label: "导入第一张梗图",
                    onClick: () => { /* Logic for import */ },
                    icon: <ImagePlus size={16} />
                }}
            />
        );
    };

    return (
        <main className="flex-1 h-full surface-effect flex flex-col relative z-0 overflow-hidden shadow-none box-border">
            <div className="h-12 mx-4 mt-3 mb-2 rounded-xl border border-borderColor flex px-4 items-center justify-between glass-effect z-10 sticky top-3">
                {/* Left: Navigation Controls (Standalone) */}
                <div className="flex gap-1.5">
                    <IconButton
                        icon={<ArrowLeft size={18} />}
                        size="sm"
                        variant="ghost"
                        title="后退"
                    />
                    <IconButton
                        icon={<ArrowRight size={18} />}
                        size="sm"
                        variant="ghost"
                        disabled
                        title="前进"
                    />
                </div>

                {/* Right Island: Display Controls */}
                <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 items-center">
                    {/* Image Toggles */}
                    <div className="flex">
                        <IconButton
                            icon={imageFit === 'contain' ? <Box size={16} /> : <Crop size={16} />}
                            size="sm"
                            variant="ghost"
                            active={imageFit === 'contain'}
                            onClick={() => setImageFit(imageFit === 'contain' ? 'cover' : 'contain')}
                            title={imageFit === 'contain' ? "原始比例 (Contain)" : "填充裁剪 (Cover)"}
                            className="rounded-lg"
                        />
                        <IconButton
                            icon={<Tag size={16} />}
                            size="sm"
                            variant="ghost"
                            active={showTags}
                            onClick={() => setShowTags(!showTags)}
                            title={showTags ? "隐藏标签" : "显示主标签"}
                            className="rounded-lg"
                        />
                    </div>

                    {/* Subtle Separator */}
                    <div className="w-px h-3 bg-borderColor/40 mx-1.5" />

                    {/* View Selection */}
                    <div className="flex">
                        <IconButton
                            icon={<LayoutGrid size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                            className="rounded-lg"
                            title="网格视图"
                        />
                        <IconButton
                            icon={<Columns3 size={16} />}
                            size="sm"
                            variant="ghost"
                            active={viewMode === 'masonry'}
                            onClick={() => setViewMode('masonry')}
                            className="rounded-lg"
                            title="瀑布流视图"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {memes.length === 0 ? renderEmptyState() : (
                    <VirtuosoGrid
                        totalCount={memes.length}
                        listClassName={clsx(
                            "grid gap-4 w-full pb-8",
                            viewMode === 'grid'
                                ? "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
                                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                        )}
                        itemContent={index => {
                            const meme = memes[index];
                            const isSelected = selectedMemeIds.includes(meme.id);
                            const memeTags = tags.filter(t => meme.tagIds.includes(t.id));

                            return (
                                <div
                                    className={clsx(
                                        "flex flex-col gap-2 group cursor-pointer",
                                        viewMode === 'masonry' && "mb-4"
                                    )}
                                    onClick={(e) => selectMeme(meme.id, e.metaKey || e.ctrlKey)}
                                >
                                    <div className={clsx(
                                        "w-full bg-white dark:bg-white/5 rounded-xl border flex items-center justify-center relative group overflow-hidden transition-all duration-300",
                                        isSelected ? "border-accent ring-2 ring-accent/30 shadow-lg" : "border-borderColor hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1",
                                        viewMode === 'grid' ? "aspect-square" : "min-h-[150px]"
                                    )}>
                                        {/* Mock Image Placeholder */}
                                        <div className={clsx(
                                            "w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5",
                                            imageFit === 'contain' ? "p-4" : "p-0"
                                        )}>
                                            <div className={clsx(
                                                "w-full h-full bg-accent/10 flex items-center justify-center text-accent/40 font-bold text-xl transition-all duration-500",
                                                imageFit === 'contain' ? "rounded-lg" : "scale-110 group-hover:scale-100"
                                            )}>
                                                IMG
                                            </div>
                                        </div>

                                        <div className={clsx(
                                            "absolute inset-0 border-2 rounded-xl transition-colors pointer-events-none",
                                            isSelected ? "border-accent/40" : "border-transparent group-hover:border-accent/30"
                                        )} />

                                        {/* Selection mark */}
                                        {isSelected && (
                                            <div className="absolute top-2 left-2 w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                                                <Check size={12} strokeWidth={4} />
                                            </div>
                                        )}

                                        {/* Hover overlay controls */}
                                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
                                            <IconButton
                                                icon={<Copy size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={(e) => { e.stopPropagation(); }}
                                                title="复制图片"
                                            />
                                            <IconButton
                                                icon={<Info size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectMeme(meme.id);
                                                    togglePanel(true);
                                                }}
                                                title="查看详情"
                                            />
                                            <IconButton
                                                icon={<MoreHorizontal size={14} />}
                                                size="sm"
                                                className="bg-white/90 dark:bg-black/80 shadow-lg border border-white/20"
                                                onClick={(e) => { e.stopPropagation(); }}
                                                title="更多"
                                            />
                                        </div>
                                    </div>

                                    {(showTags || viewMode === 'grid') && (
                                        <div className="px-1 flex flex-col gap-0.5">
                                            <span className={clsx(
                                                "text-xs font-medium truncate transition-colors",
                                                isSelected ? "text-accent" : "text-textPrimary"
                                            )}>{meme.name}</span>
                                            {showTags && memeTags.length > 0 && (
                                                <div className="flex gap-1 overflow-hidden">
                                                    <span className="text-[10px] text-accent font-medium px-1.5 py-0.5 bg-accent/10 rounded-md">
                                                        #{memeTags[0].name}
                                                    </span>
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
