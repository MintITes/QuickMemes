import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { LayoutList, Tag, Trash2, Clock, Star, Folder, ArchiveRestore } from 'lucide-react';
import clsx from 'clsx';

export function Sidebar() {
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const sidebarExpanded = useUiStore(state => state.sidebarExpanded);
    const categories = useCategoryStore(state => state.categories);

    const getNavClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "flex items-center text-left px-3 py-2 rounded-xl text-sm transition-colors duration-200 group relative no-drag",
            isActive
                ? "font-semibold text-textPrimary shadow-sm"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-textPrimary/70 hover:text-textPrimary border border-transparent"
        );
    };

    // Use color-mix for dynamic theme colors with opacity
    const getIconClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "mr-3 transition-opacity",
            isActive ? "opacity-100 text-accent" : "opacity-60 group-hover:opacity-100 group-hover:text-textPrimary"
        );
    };

    return (
        <aside
            className={clsx(
                "flex-shrink-0 h-full surface-effect flex flex-col p-4 transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden select-none no-drag",
                sidebarExpanded ? "w-64" : "w-20"
            )}
        >
            <div className="flex flex-col space-y-1 overflow-x-hidden">
                <span className={clsx(
                    "text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2 transition-opacity duration-200",
                    !sidebarExpanded && "opacity-0 h-0 my-0 mb-0 px-0 pointer-events-none"
                )}>
                    System
                </span>
                <button
                    onClick={() => setActiveNav('all')}
                    className={clsx(getNavClass('all'), !sidebarExpanded && "justify-center px-0 h-10")}
                    style={activeNav === 'all' ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                        borderWidth: '1px'
                    } : {}}
                    title={!sidebarExpanded ? "All Memes" : undefined}
                >
                    <LayoutList size={16} className={clsx(getIconClass('all'), !sidebarExpanded && "mr-0")} />
                    {sidebarExpanded && <span className="truncate">All Memes</span>}
                </button>
                <button
                    onClick={() => setActiveNav('untagged')}
                    className={clsx(getNavClass('untagged'), !sidebarExpanded && "justify-center px-0 h-10")}
                    style={activeNav === 'untagged' ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                        borderWidth: '1px'
                    } : {}}
                    title={!sidebarExpanded ? "Untagged" : undefined}
                >
                    <Tag size={16} className={clsx(getIconClass('untagged'), !sidebarExpanded && "mr-0")} />
                    {sidebarExpanded && <span className="truncate">Untagged</span>}
                </button>
                <button
                    onClick={() => setActiveNav('trash')}
                    className={clsx(getNavClass('trash'), !sidebarExpanded && "justify-center px-0 h-10")}
                    style={activeNav === 'trash' ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                        borderWidth: '1px'
                    } : {}}
                    title={!sidebarExpanded ? "Trash" : undefined}
                >
                    <Trash2 size={16} className={clsx(getIconClass('trash'), !sidebarExpanded && "mr-0")} />
                    {sidebarExpanded && <span className="truncate">Trash</span>}
                </button>
            </div>

            <div className="flex flex-col space-y-1 overflow-x-hidden mt-6">
                <span className={clsx(
                    "text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2 transition-opacity duration-200",
                    !sidebarExpanded && "opacity-0 h-0 my-0 mb-0 px-0 pointer-events-none"
                )}>
                    Shortcuts
                </span>
                <button
                    onClick={() => setActiveNav('recent')}
                    className={clsx(getNavClass('recent'), !sidebarExpanded && "justify-center px-0 h-10")}
                    style={activeNav === 'recent' ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                        borderWidth: '1px'
                    } : {}}
                    title={!sidebarExpanded ? "Recent" : undefined}
                >
                    <Clock size={16} className={clsx(getIconClass('recent'), !sidebarExpanded && "mr-0")} />
                    {sidebarExpanded && <span className="truncate">Recent</span>}
                </button>
                <button
                    onClick={() => setActiveNav('starred')}
                    className={clsx(getNavClass('starred'), !sidebarExpanded && "justify-center px-0 h-10")}
                    style={activeNav === 'starred' ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                        borderWidth: '1px'
                    } : {}}
                    title={!sidebarExpanded ? "Starred" : undefined}
                >
                    <Star size={16} className={clsx(getIconClass('starred'), !sidebarExpanded && "mr-0")} />
                    {sidebarExpanded && <span className="truncate">Starred</span>}
                </button>
            </div>

            <div className="flex flex-col space-y-1 flex-1 overflow-x-hidden mt-6">
                <span className={clsx(
                    "text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-2 transition-opacity duration-200",
                    !sidebarExpanded && "opacity-0 h-0 my-0 mb-0 px-0 pointer-events-none"
                )}>
                    Categories
                </span>
                <div className="space-y-1">
                    {categories.length === 0 ? (
                        sidebarExpanded && <div className="px-3 py-2 text-sm text-textSecondary italic">No categories yet</div>
                    ) : (
                        categories.map(cat => {
                            const navId = `category-${cat.id}`;
                            const isActive = activeNav === navId;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveNav(navId)}
                                    className={clsx(getNavClass(navId), !sidebarExpanded && "justify-center px-0 h-10")}
                                    style={isActive ? {
                                        backgroundColor: 'color-mix(in srgb, var(--accent-color), transparent 85%)',
                                        borderColor: 'color-mix(in srgb, var(--accent-color), transparent 70%)',
                                        borderWidth: '1px'
                                    } : {}}
                                    title={!sidebarExpanded ? cat.name : undefined}
                                >
                                    <Folder size={16} className={clsx(getIconClass(navId), !sidebarExpanded && "mr-0")} />
                                    {sidebarExpanded && <span className="truncate">{cat.name}</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-borderColor/20 dark:border-white/5 overflow-x-hidden">
                <span className={clsx(
                    "text-[11px] font-bold text-textSecondary uppercase tracking-wider px-3 mb-3 block transition-opacity duration-200",
                    !sidebarExpanded && "opacity-0 h-0 my-0 mb-0 pointer-events-none"
                )}>
                    Magic Bucket
                </span>
                <button className={clsx(
                    "w-full flex items-center justify-between text-left rounded-xl border border-dashed border-borderColor hover:bg-bgNested hover:border-accent/50 hover:text-accent transition-colors duration-200 group no-drag",
                    sidebarExpanded ? "px-4 py-3" : "px-0 h-10 justify-center"
                )}>
                    <div className="flex items-center no-drag">
                        <ArchiveRestore size={18} className={clsx("opacity-70 group-hover:opacity-100 no-drag", sidebarExpanded ? "mr-3" : "mr-0")} />
                        {sidebarExpanded && <span className="font-medium text-sm no-drag">Bucket</span>}
                    </div>
                    {sidebarExpanded && <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold shadow-sm no-drag">0</span>}
                </button>
            </div>
        </aside>
    );
}
