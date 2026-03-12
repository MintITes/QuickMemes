import { useMemeStore } from '../../stores/MemeStore';
import { useUiStore } from '../../stores/UiStore';
import { CheckCircle2, Inbox } from 'lucide-react';

export function StatusBar() {
    const totalCount = useMemeStore(state => state.totalCount);
    const selectedMemeIds = useUiStore(state => state.selectedMemeIds);

    return (
        <footer className="h-7 w-full flex-shrink-0 bg-accent text-white text-[11px] flex items-center px-4 justify-between select-none z-20 shadow-inner">
            <div className="flex items-center gap-4 opacity-90">
                <div className="flex items-center gap-1.5">
                    <Inbox size={12} />
                    <span>Total: <b className="font-mono">{totalCount}</b> items</span>
                </div>
                {selectedMemeIds.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-sm">Selected: {selectedMemeIds.length}</span>
                )}
            </div>

            <div className="flex items-center justify-center flex-1">
                {/* Placeholder for task progress */}
            </div>

            <div className="flex items-center gap-2 opacity-90 cursor-pointer hover:opacity-100 transition-opacity">
                <CheckCircle2 size={12} />
                <span>Ready</span>
                <div className="w-2 h-2 rounded-full bg-green-400 ml-1 shadow-[0_0_8px_rgba(74,222,128,0.8)]" title="System Ready" />
            </div>
        </footer>
    );
}
