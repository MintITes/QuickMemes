import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { LayoutList, Tag, Trash2, Clock, Star, Folder, ArchiveRestore } from 'lucide-react';
import clsx from 'clsx';

export function Sidebar() {
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const categories = useCategoryStore(state => state.categories);

    const getNavClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "flex items-center text-left px-3 py-2 rounded-xl text-sm transition-colors duration-200 group relative no-drag",
            isActive
                ? "bg-black/5 dark:bg-white/10 font-semibold text-textPrimary shadow-sm border border-black/5 dark:border-white/10"
                : "hover:bg-black/5 dark:hover:bg-white/10 text-textPrimary border border-transparent"
        );
    };

    const getIconClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "mr-3 transition-opacity",
            isActive ? "opacity-100 text-accent" : "opacity-60 group-hover:opacity-100 group-hover:text-textPrimary"
        );
    };

    return (
        <aside className="w-64 flex-shrink-0 h-full surface-effect flex flex-col p-4 space-y-6 overflow-y-auto select-none no-drag">
            <div className="flex flex-col space-y-1">
                <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2">System</span>
                <button
                    onClick={() => setActiveNav('all')}
                    className={getNavClass('all')}
                >
                    <LayoutList size={16} className={getIconClass('all')} />
                    <span>All Memes</span>
                </button>
                <button
                    onClick={() => setActiveNav('untagged')}
                    className={getNavClass('untagged')}
                >
                    <Tag size={16} className={getIconClass('untagged')} />
                    <span>Untagged</span>
                </button>
                <button
                    onClick={() => setActiveNav('trash')}
                    className={getNavClass('trash')}
                >
                    <Trash2 size={16} className={getIconClass('trash')} />
                    <span>Trash</span>
                </button>
            </div>

            <div className="flex flex-col space-y-1">
                <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2">Shortcuts</span>
                <button
                    onClick={() => setActiveNav('recent')}
                    className={getNavClass('recent')}
                >
                    <Clock size={16} className={getIconClass('recent')} />
                    <span>Recent</span>
                </button>
                <button
                    onClick={() => setActiveNav('starred')}
                    className={getNavClass('starred')}
                >
                    <Star size={16} className={getIconClass('starred')} />
                    <span>Starred</span>
                </button>
            </div>

            <div className="flex flex-col space-y-1 flex-1">
                <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2">Categories</span>
                <div className="space-y-1">
                    {categories.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-textSecondary italic">No categories yet</div>
                    ) : (
                        categories.map(cat => {
                            const navId = `category-${cat.id}`;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveNav(navId)}
                                    className={getNavClass(navId)}
                                >
                                    <Folder size={16} className={getIconClass(navId)} />
                                    <span>{cat.name}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/5">
                <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-3 block">Magic Bucket</span>
                <button className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl border border-dashed border-gray-400 dark:border-gray-600 hover:bg-black/5 dark:hover:bg-white/10 hover:border-accent/50 hover:text-accent transition-all duration-200 group no-drag">
                    <div className="flex items-center no-drag">
                        <ArchiveRestore size={18} className="mr-3 opacity-70 group-hover:opacity-100 no-drag" />
                        <span className="font-medium text-sm no-drag">Bucket</span>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold shadow-sm no-drag">0</span>
                </button>
            </div>
        </aside>
    );
}
