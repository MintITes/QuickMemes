import { useUiStore } from '../../stores/UiStore';
import { useCategoryStore } from '../../stores/CategoryStore';
import { LayoutList, Tag, Trash2, Clock, Star, Folder, ArchiveRestore, PanelLeft, PanelLeftClose } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export function Sidebar() {
    const activeNav = useUiStore(state => state.activeNav);
    const setActiveNav = useUiStore(state => state.setActiveNav);
    const sidebarExpanded = useUiStore(state => state.sidebarExpanded);
    const setSidebarExpanded = useUiStore(state => state.setSidebarExpanded);
    const categories = useCategoryStore(state => state.categories);

    const getNavClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "flex items-center text-left px-3 py-2 rounded-xl text-sm transition-all duration-200 group relative no-drag mb-0.5",
            isActive
                ? "font-semibold text-textPrimary shadow-sm"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-textPrimary/60 hover:text-textPrimary border border-transparent"
        );
    };

    // Use color-mix for dynamic theme colors with opacity
    const getIconClass = (id: string) => {
        const isActive = activeNav === id;
        return clsx(
            "transition-opacity flex-shrink-0",
            isActive ? "opacity-100 text-accent" : "opacity-60 group-hover:opacity-100 group-hover:text-textPrimary"
        );
    };

    return (
        <motion.aside
            animate={{ width: sidebarExpanded ? 256 : 68 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex-shrink-0 h-full surface-effect flex flex-col p-3 overflow-hidden select-none no-drag"
        >
            {/* Sidebar Toggle Header */}
            <div className={clsx("flex items-center mb-4 px-1", sidebarExpanded ? "justify-between" : "justify-center")}>
                {sidebarExpanded && <span className="text-xs font-bold text-textPrimary/50 px-2 tracking-widest uppercase">Library</span>}
                <IconButton
                    icon={sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarExpanded(!sidebarExpanded)}
                    className="opacity-50 hover:opacity-100"
                    title={sidebarExpanded ? "折叠侧边栏" : "展开侧边栏"}
                />
            </div>

            <div className="flex flex-col overflow-x-hidden">
                {sidebarExpanded && (
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-[0.15em] px-3 mb-3 opacity-60">
                        System
                    </span>
                )}
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
                    <LayoutList size={18} className={clsx(getIconClass('all'), sidebarExpanded && "mr-3")} />
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
                    <Tag size={18} className={clsx(getIconClass('untagged'), sidebarExpanded && "mr-3")} />
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
                    <Trash2 size={18} className={clsx(getIconClass('trash'), sidebarExpanded && "mr-3")} />
                    {sidebarExpanded && <span className="truncate">Trash</span>}
                </button>
            </div>

            <div className="flex flex-col overflow-x-hidden mt-8">
                {sidebarExpanded && (
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-[0.15em] px-3 mb-3 opacity-60">
                        Shortcuts
                    </span>
                )}
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
                    <Clock size={18} className={clsx(getIconClass('recent'), sidebarExpanded && "mr-3")} />
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
                    <Star size={18} className={clsx(getIconClass('starred'), sidebarExpanded && "mr-3")} />
                    {sidebarExpanded && <span className="truncate">Starred</span>}
                </button>
            </div>

            <div className="flex flex-col flex-1 overflow-x-hidden mt-8">
                {sidebarExpanded && (
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-[0.15em] px-3 mb-3 opacity-60">
                        Categories
                    </span>
                )}
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
                                    <Folder size={18} className={clsx(getIconClass(navId), sidebarExpanded && "mr-3")} />
                                    {sidebarExpanded && <span className="truncate">{cat.name}</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-borderColor/20 dark:border-white/5 overflow-x-hidden">
                {sidebarExpanded && (
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-[0.15em] px-3 mb-3 block opacity-50">
                        Magic Store
                    </span>
                )}
                <button className={clsx(
                    "w-full flex items-center rounded-xl border border-dashed border-borderColor hover:bg-bgNested hover:border-accent/50 hover:text-accent transition-colors duration-200 group no-drag",
                    sidebarExpanded ? "px-4 py-3 justify-between text-left" : "px-0 h-10 justify-center"
                )}>
                    <div className="flex items-center no-drag">
                        <ArchiveRestore size={20} className={clsx("opacity-70 group-hover:opacity-100 no-drag", sidebarExpanded && "mr-3")} />
                        {sidebarExpanded && <span className="font-medium text-sm no-drag">Bucket</span>}
                    </div>
                    {sidebarExpanded && <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold shadow-sm no-drag">0</span>}
                </button>
            </div>
        </motion.aside>
    );
}
