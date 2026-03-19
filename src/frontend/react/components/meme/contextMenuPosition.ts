import type { ContextMenuState } from '../../stores/UiStore';

type Placement = 'right' | 'left' | 'top' | 'bottom';

interface ViewportSize {
    width: number;
    height: number;
}

interface MenuSize {
    width: number;
    height: number;
}

interface ResolvedMenuPosition {
    left: number;
    top: number;
    placement: Placement;
}

const DEFAULT_MENU_SIZE: MenuSize = {
    width: 220,
    height: 260,
};

const DEFAULT_PADDING = 12;
const DEFAULT_GAP = 8;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getFallbackPosition(
    menuInfo: ContextMenuState,
    viewport: ViewportSize,
    menuSize: MenuSize,
    padding: number
): ResolvedMenuPosition {
    const maxLeft = Math.max(padding, viewport.width - menuSize.width - padding);
    const maxTop = Math.max(padding, viewport.height - menuSize.height - padding);

    return {
        left: clamp(menuInfo.x, padding, maxLeft),
        top: clamp(menuInfo.y, padding, maxTop),
        placement: 'left',
    };
}

export function resolveContextMenuPosition(
    menuInfo: ContextMenuState,
    viewport: ViewportSize,
    menuSize: MenuSize = DEFAULT_MENU_SIZE,
    padding = DEFAULT_PADDING,
    gap = DEFAULT_GAP
): ResolvedMenuPosition {
    if (!menuInfo.anchorRect || !menuInfo.preferredPlacements?.length) {
        return getFallbackPosition(menuInfo, viewport, menuSize, padding);
    }

    const maxLeft = Math.max(padding, viewport.width - menuSize.width - padding);
    const maxTop = Math.max(padding, viewport.height - menuSize.height - padding);
    const clampedTop = clamp(menuInfo.anchorRect.bottom - menuSize.height, padding, maxTop);
    const clampedBottomLeft = clamp(menuInfo.anchorRect.right - menuSize.width, padding, maxLeft);

    const candidates: Record<Placement, { left: number; top: number }> = {
        right: {
            left: menuInfo.anchorRect.right + gap,
            top: clampedTop,
        },
        left: {
            left: menuInfo.anchorRect.left - menuSize.width - gap,
            top: clampedTop,
        },
        top: {
            left: clampedBottomLeft,
            top: menuInfo.anchorRect.top - menuSize.height - gap,
        },
        bottom: {
            left: clampedBottomLeft,
            top: menuInfo.anchorRect.bottom + gap,
        },
    };

    for (const placement of menuInfo.preferredPlacements) {
        const candidate = candidates[placement];
        const fitsHorizontally = candidate.left >= padding && candidate.left + menuSize.width <= viewport.width - padding;
        const fitsVertically = candidate.top >= padding && candidate.top + menuSize.height <= viewport.height - padding;
        if (fitsHorizontally && fitsVertically) {
            return {
                ...candidate,
                placement,
            };
        }
    }

    const preferredPlacement = menuInfo.preferredPlacements[0];
    const fallbackCandidate = candidates[preferredPlacement];

    return {
        left: clamp(fallbackCandidate.left, padding, maxLeft),
        top: clamp(fallbackCandidate.top, padding, maxTop),
        placement: preferredPlacement,
    };
}
