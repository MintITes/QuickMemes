import { useUiStore } from '../../stores/UiStore';
import { Info, Tag as TagIcon, FileText, Image as ImageIcon, X, Copy, Edit2 } from 'lucide-react';

export function Inspector() {
    const selectedMemeIds = useUiStore(state => state.selectedMemeIds);
    // Temporary mocked state setup
    // In actual implementation we would fetch details using `selectedMemeIds[0]`

    if (selectedMemeIds.length === 0) {
        return null; // Hidden when nothing is selected
    }

    return (
        <aside className="w-72 flex-shrink-0 h-full surface-effect flex flex-col overflow-y-auto z-10 box-border">
            {/* Preview Image Area */}
            <div className="h-56 bg-black/5 dark:bg-black/20 flex flex-col items-center justify-center p-4 relative">
                <div className="w-full h-full rounded-lg shadow-sm bg-black/10 dark:bg-white/5 flex items-center justify-center border border-white/10">
                    <ImageIcon className="text-textSecondary/30" size={48} />
                </div>
            </div>

            <div className="p-5 flex flex-col gap-6">
                {/* Information Section */}
                <section>
                    <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-3 flex items-center px-1">
                        <Info size={14} className="mr-1.5" /> Information
                    </h3>
                    <div className="inner-container-effect p-3 shadow-sm">
                        <div className="text-xs grid grid-cols-[70px_1fr] gap-y-2 gap-x-2">
                            <span className="opacity-60 text-right">Name</span>
                            <span className="truncate font-medium" title="example_meme_v2.png">example_meme_v2.png</span>
                            <span className="opacity-60 text-right">Size</span>
                            <span className="font-medium">2.4 MB</span>
                            <span className="opacity-60 text-right">Format</span>
                            <span className="font-medium">PNG</span>
                            <span className="opacity-60 text-right">Added</span>
                            <span className="font-medium opacity-80">2024-03-12</span>
                        </div>
                    </div>
                </section>

                {/* Tags Section */}
                <section>
                    <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-3 flex items-center">
                        <TagIcon size={14} className="mr-1.5" /> Tags
                    </h3>
                    <div className="bg-bgPrimary/60 rounded-xl p-3 border border-white/10 dark:border-white/5 shadow-sm">
                        <div className="flex gap-2 flex-wrap mb-3">
                            <span className="px-2.5 py-1 rounded-md bg-accent/15 text-accent text-xs font-medium flex items-center group cursor-pointer hover:bg-accent/25 transition-colors">
                                funny
                                <X size={12} className="ml-1 opacity-50 group-hover:opacity-100" />
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-accent/15 text-accent text-xs font-medium flex items-center group cursor-pointer hover:bg-accent/25 transition-colors">
                                reaction
                                <X size={12} className="ml-1 opacity-50 group-hover:opacity-100" />
                            </span>
                        </div>
                        <input
                            type="text"
                            placeholder="Add new tag..."
                            className="w-full px-3 py-1.5 rounded-lg border border-borderColor bg-white/50 dark:bg-black/20 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-textSecondary/60"
                        />
                    </div>
                </section>

                {/* OCR Text Section */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[11px] font-bold text-textSecondary uppercase tracking-wider flex items-center">
                            <FileText size={14} className="mr-1.5" /> OCR Text
                        </h3>
                        <div className="flex gap-1">
                            <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-textSecondary transition-colors" title="Edit OCR">
                                <Edit2 size={12} />
                            </button>
                            <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-textSecondary transition-colors" title="Copy Text">
                                <Copy size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="w-full min-h-[80px] p-3 rounded-xl border border-white/10 dark:border-white/5 bg-bgPrimary/60 text-xs opacity-80 leading-relaxed shadow-sm">
                        <span className="italic opacity-60">No text detected in this image.</span>
                    </div>
                </section>
            </div>
        </aside>
    );
}
