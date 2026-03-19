import { describe, expect, it } from 'vitest';
import { resolveContextMenuPosition } from '../contextMenuPosition';

describe('resolveContextMenuPosition', () => {
    it('优先放到按钮右侧', () => {
        const result = resolveContextMenuPosition(
            {
                memeId: 1,
                x: 280,
                y: 160,
                anchorRect: {
                    left: 252,
                    top: 132,
                    right: 280,
                    bottom: 160,
                },
                preferredPlacements: ['right', 'left', 'top', 'bottom'],
            },
            { width: 800, height: 600 }
        );

        expect(result.placement).toBe('right');
        expect(result.left).toBe(288);
    });

    it('右侧放不下时回退到左侧', () => {
        const result = resolveContextMenuPosition(
            {
                memeId: 1,
                x: 760,
                y: 220,
                anchorRect: {
                    left: 732,
                    top: 192,
                    right: 760,
                    bottom: 220,
                },
                preferredPlacements: ['right', 'left', 'top', 'bottom'],
            },
            { width: 800, height: 600 }
        );

        expect(result.placement).toBe('left');
        expect(result.left).toBe(504);
    });
});
