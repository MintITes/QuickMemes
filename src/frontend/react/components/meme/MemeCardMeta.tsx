import type { Meme } from '../../types';
import { useTagStore } from '../../stores/TagStore';
import { useUiStore } from '../../stores/UiStore';

interface MemeCardMetaProps {
    meme: Meme;
    isSelected: boolean;
    showTags: boolean;
}

export function MemeCardMeta({ meme, isSelected, showTags }: MemeCardMetaProps) {
    const tags = useTagStore((state) => state.tags);
    const { accentColor } = useUiStore();
    const memeTags = tags.filter((entry) => meme.tagIds.includes(entry.id));

    const shouldShowTags = showTags && memeTags.length > 0;

    if (!shouldShowTags) return null;

    return (
        <div className="px-2 py-2 flex flex-col gap-1.5 overflow-hidden">
            <div className="flex flex-wrap gap-1 overflow-hidden max-h-[36px]">
                {memeTags.slice(0, 3).map((tagEntry) => (
                    <span
                        key={tagEntry.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all duration-300 border border-transparent bg-black/5 dark:bg-white/5"
                        style={{
                            backgroundColor: isSelected ? `${accentColor}15` : undefined,
                            color: isSelected ? accentColor : 'var(--text-secondary)',
                            opacity: 0.9
                        }}
                    >
                        {tagEntry.name}
                    </span>
                ))}
                {memeTags.length > 3 && (
                    <span className="text-[10px] font-bold text-textSecondary/40 px-1 self-center">
                        +{memeTags.length - 3}
                    </span>
                )}
            </div>
        </div>
    );
}
