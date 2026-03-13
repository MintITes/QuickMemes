import { useMemeStore } from '../../stores/MemeStore';
import { VirtuosoGrid } from 'react-virtuoso';
import { ChevronLeft, ChevronRight, Grid2X2, Tags, ImagePlus, SearchX, Inbox, Sparkles, Copy, MoreHorizontal } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { EmptyState } from '../common/EmptyState';
import { useUiStore } from '../../stores/UiStore';

export function Gallery() {
    const memes = useMemeStore(state => state.memes);
    const activeNav = useUiStore(state => state.activeNav);
    const searchQuery = useUiStore(state => state.searchQuery);
    const setSearchQuery = useUiStore(state => state.setSearchQuery);

    const renderEmptyState = () => {
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
                <div className="flex gap-2">
                    <IconButton
                        icon={<ChevronLeft size={18} className="opacity-70" />}
                        size="sm"
                        variant="ghost"
                        aria-label="Back"
                    />
                    <IconButton
                        icon={<ChevronRight size={18} />}
                        size="sm"
                        variant="ghost"
                        aria-label="Forward"
                        disabled
                    />
                </div>
                <div className="flex gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-lg border border-black/5 dark:border-white/5">
                    <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-[#333] shadow-sm flex items-center">
                        <Grid2X2 size={14} className="mr-1.5 opacity-70" />
                        Grid
                    </button>
                    <button className="px-3 py-1.5 rounded-md text-xs font-medium text-textSecondary hover:text-textPrimary flex items-center transition-colors">
                        <Tags size={14} className="mr-1.5" />
                        Tags
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6">
                {memes.length === 0 ? renderEmptyState() : (
                    <VirtuosoGrid
                        totalCount={memes.length}
                        listClassName="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
                        itemClassName="h-48"
                        itemContent={index => {
                            const meme = memes[index];
                            return (
                                <div className="w-full h-full bg-white dark:bg-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-borderColor flex items-center justify-center relative group overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                                    <span className="text-sm font-medium text-textPrimary">{meme.name}</span>
                                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/40 rounded-xl transition-colors pointer-events-none" />

                                    {/* Hover overlay controls */}
                                    <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
                                        <IconButton
                                            icon={<Copy size={14} />}
                                            size="sm"
                                            className="bg-white/80 dark:bg-black/60 shadow-sm border border-white/20"
                                            onClick={(e) => { e.stopPropagation(); /* Mock copy */ }}
                                            title="复制图片"
                                        />
                                        <IconButton
                                            icon={<MoreHorizontal size={14} />}
                                            size="sm"
                                            className="bg-white/80 dark:bg-black/60 shadow-sm border border-white/20"
                                            onClick={(e) => { e.stopPropagation(); /* Mock menu */ }}
                                            title="更多"
                                        />
                                    </div>
                                </div>
                            );
                        }}
                    />
                )}
            </div>
        </main>
    );
}
