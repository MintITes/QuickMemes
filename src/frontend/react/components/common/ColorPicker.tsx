import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useUiStore } from '../../stores/UiStore';

interface ColorPickerProps {
    color: string;
    onPreviewChange: (color: string) => void;
    onCommit?: (color: string) => void;
}

type DragTarget = 'sl' | 'hue' | null;

interface HslColor {
    h: number;
    s: number;
    l: number;
}

// Helper to convert hex to hsl
const hexToHsl = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
};

// Helper to convert hsl to hex
const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

export function ColorPicker({ color, onPreviewChange, onCommit }: ColorPickerProps) {
    const cornerRadius = useUiStore(state => state.cornerRadius);
    const [initialH, initialS, initialL] = hexToHsl(color);
    const [draftColor, setDraftColor] = useState(color);
    const [hexInput, setHexInput] = useState(color);
    const [dragTarget, setDragTarget] = useState<DragTarget>(null);
    const [hsl, setHsl] = useState<HslColor>({ h: initialH, s: initialS, l: initialL });

    const hueRef = useRef<HTMLDivElement>(null);
    const slRef = useRef<HTMLDivElement>(null);
    const draftColorRef = useRef(draftColor);
    const activePointerIdRef = useRef<number | null>(null);
    const hslRef = useRef(hsl);

    const applyColor = (nextColor: string, nextHsl: HslColor) => {
        draftColorRef.current = nextColor;
        hslRef.current = nextHsl;
        setDraftColor(nextColor);
        setHexInput(nextColor);
        setHsl(nextHsl);
        onPreviewChange(nextColor);
    };

    const updateHueFromClientX = (clientX: number) => {
        if (!hueRef.current) return;

        const rect = hueRef.current.getBoundingClientRect();
        const relativeX = Math.min(Math.max(0, clientX - rect.left), rect.width);
        const nextH = (relativeX / rect.width) * 360;
        const nextHsl = {
            h: nextH,
            s: hslRef.current.s,
            l: hslRef.current.l,
        };
        applyColor(hslToHex(nextHsl.h, nextHsl.s, nextHsl.l), nextHsl);
    };

    const updateSlFromClientPoint = (clientX: number, clientY: number) => {
        if (!slRef.current) return;

        const rect = slRef.current.getBoundingClientRect();
        const relativeX = Math.min(Math.max(0, clientX - rect.left), rect.width);
        const relativeY = Math.min(Math.max(0, clientY - rect.top), rect.height);
        const nextS = (relativeX / rect.width) * 100;
        const nextL = (1 - relativeY / rect.height) * 100;
        const nextHsl = {
            h: hslRef.current.h,
            s: nextS,
            l: nextL,
        };
        applyColor(hslToHex(nextHsl.h, nextHsl.s, nextHsl.l), nextHsl);
    };

    const finishDrag = (target: HTMLDivElement, pointerId: number) => {
        if (target.hasPointerCapture(pointerId)) {
            target.releasePointerCapture(pointerId);
        }
        activePointerIdRef.current = null;
        setDragTarget(null);
        onCommit?.(draftColorRef.current);
    };

    const handleTrackPointerDown = (targetName: Exclude<DragTarget, null>) => (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();

        activePointerIdRef.current = event.pointerId;
        setDragTarget(targetName);
        event.currentTarget.setPointerCapture(event.pointerId);

        if (targetName === 'sl') {
            updateSlFromClientPoint(event.clientX, event.clientY);
            return;
        }

        updateHueFromClientX(event.clientX);
    };

    const handleTrackPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== event.pointerId || dragTarget === null) {
            return;
        }

        event.preventDefault();

        if (dragTarget === 'sl') {
            updateSlFromClientPoint(event.clientX, event.clientY);
            return;
        }

        updateHueFromClientX(event.clientX);
    };

    const handleTrackPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== event.pointerId || dragTarget === null) {
            return;
        }

        finishDrag(event.currentTarget, event.pointerId);
    };

    const handleTrackPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== event.pointerId || dragTarget === null) {
            return;
        }

        finishDrag(event.currentTarget, event.pointerId);
    };

    const onHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setHexInput(val);
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            const [nextH, nextS, nextL] = hexToHsl(val);
            applyColor(val, { h: nextH, s: nextS, l: nextL });
            onCommit?.(val);
        }
    };

    return (
        <div className="flex flex-col gap-3 p-3">
            {/* SL Area */}
            <div
                ref={slRef}
                className="relative w-full h-32 cursor-crosshair overflow-hidden border border-black/10 dark:border-white/10"
                style={{
                    borderRadius: cornerRadius,
                    touchAction: 'none',
                }}
                onPointerDown={handleTrackPointerDown('sl')}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={handleTrackPointerUp}
                onPointerCancel={handleTrackPointerCancel}
            >
                {/* Background Hue Color */}
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: `hsl(${hsl.h}, 100%, 50%)` }}
                />
                {/* Saturation Gradient (White to Transparent) */}
                <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
                />
                {/* Lightness Gradient (Transparent to Black) */}
                <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, #000, transparent)' }}
                />

                <div
                    className={clsx(
                        "absolute w-3 h-3 border-2 border-white rounded-full shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10",
                        dragTarget === 'sl' ? "transition-none" : "transition-[left,top,background-color] duration-75 ease-out"
                    )}
                    style={{
                        left: `${hsl.s}%`,
                        top: `${100 - hsl.l}%`,
                        backgroundColor: draftColor,
                    }}
                />
            </div>

            {/* Hue Slider */}
            <div
                ref={hueRef}
                className="relative w-full h-3 cursor-pointer overflow-hidden"
                style={{
                    borderRadius: cornerRadius / 2,
                    background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                    touchAction: 'none',
                }}
                onPointerDown={handleTrackPointerDown('hue')}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={handleTrackPointerUp}
                onPointerCancel={handleTrackPointerCancel}
            >
                <div
                    className={clsx(
                        "absolute w-4 h-4 bg-white border-2 border-white rounded-full shadow-lg -top-0.5 -translate-x-1/2 pointer-events-none",
                        dragTarget === 'hue' ? "transition-none" : "transition-[left,background-color] duration-75 ease-out"
                    )}
                    style={{
                        left: `${(hsl.h / 360) * 100}%`,
                        backgroundColor: `hsl(${hsl.h}, 100%, 50%)`,
                    }}
                />
            </div>

            {/* Inputs & Controls */}
            <div className="flex items-center gap-2">
                <div
                    className="w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 shadow-inner shrink-0"
                    style={{ backgroundColor: hexInput, borderRadius: cornerRadius / 2 }}
                />
                <input
                    type="text"
                    value={hexInput}
                    onChange={onHexInputChange}
                    className="flex-1 min-w-0 h-10 px-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[10px] font-mono uppercase text-textPrimary outline-none focus:border-accent/50 transition-colors"
                    style={{ borderRadius: cornerRadius / 2 }}
                />
            </div>
        </div>
    );
}
