import { useMemeStore } from '../../stores/MemeStore';
import { VirtuosoGrid } from 'react-virtuoso';
import { ChevronLeft, ChevronRight, Grid2X2, Tags, ImagePlus, MoreHorizontal, Copy } from 'lucide-react';
import { IconButton } from '../common/IconButton';
export function Gallery() {
    const memes = useMemeStore(state => state.memes);

    return (
        <main className="flex-1 h-full bg-bgSurface rounded-tl-2xl border-l border-t border-black/20 dark:border-borderColor shadow-[-8px_0_30px_rgba(0,0,0,0.04)] dark:shadow-[-4px_-4px_15px_rgba(0,0,0,0.2)] flex flex-col relative z-0 overflow-hidden">
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
                {memes.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-80 select-none">
                        <div className="w-32 h-32 mb-6 border-2 border-dashed border-textSecondary/30 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/5">
                            <ImagePlus size={48} className="text-textSecondary/50" />
                        </div>
                        <h2 className="text-lg font-semibold tracking-wide mb-2">没有任何梗图</h2>
                        <p className="text-sm text-textSecondary mb-6 max-w-xs">快把好玩的图拖拽进来，或者点击下方的按钮导入吧！</p>
                        <button className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium text-sm transition-all shadow-md active:scale-95 flex items-center">
                            <ImagePlus size={16} className="mr-2" />
                            导入第一张梗图
                        </button>
                    </div>
                ) : (
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
