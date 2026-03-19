import type { Meme } from '../../types';

interface MemeCardMetaProps {
    meme: Meme;
    isSelected: boolean;
    showTags: boolean;
}

export function MemeCardMeta({ meme, isSelected, showTags }: MemeCardMetaProps) {
    void meme;
    void isSelected;
    void showTags;
    return null;
}
