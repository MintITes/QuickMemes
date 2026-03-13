import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface SliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    label?: string;
    unit?: string;
    disabled?: boolean;
    className?: string;
    warning?: string;
}

export function Slider({
    value,
    min,
    max,
    step = 1,
    onChange,
    label,
    unit = '',
    disabled = false,
    className,
    warning
}: SliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // High-precision local value for smooth visual tracking
    const [localValue, setLocalValue] = useState(value);

    const calculateValueFromEvent = useCallback((clientX: number) => {
        if (!containerRef.current) return localValue;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        return min + (x / rect.width) * (max - min);
    }, [localValue, min, max]);

    const handleInteraction = useCallback((clientX: number) => {
        const newValue = calculateValueFromEvent(clientX);
        setLocalValue(newValue);

        // Logical rounding for the store
        const steppedValue = Math.round(newValue / step) * step;
        if (steppedValue !== value) {
            onChange(Number(steppedValue.toFixed(2)));
        }
    }, [calculateValueFromEvent, step, value, onChange]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => handleInteraction(e.clientX);
        const handleTouchMove = (e: TouchEvent) => handleInteraction(e.touches[0].clientX);
        const handleEnd = () => setIsDragging(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, handleInteraction]);

    const displayedValue = isDragging ? localValue : value;
    const percentage = ((displayedValue - min) / (max - min)) * 100;

    return (
        <div className={clsx("space-y-2 select-none", className, disabled && "opacity-50 pointer-events-none")}>
            <div className="flex justify-between items-center px-1">
                {label && (
                    <span className="text-xs font-medium opacity-60">
                        {label} ({value}{unit})
                    </span>
                )}
                {warning && !disabled && (
                    <span className="text-orange-500 font-bold text-[10px] animate-pulse">
                        {warning}
                    </span>
                )}
            </div>

            <div
                ref={containerRef}
                className="relative h-6 flex items-center cursor-pointer group"
                onMouseDown={(e) => {
                    if (disabled) return;
                    setIsDragging(true);
                    handleInteraction(e.clientX);
                }}
                onTouchStart={(e) => {
                    if (disabled) return;
                    setIsDragging(true);
                    handleInteraction(e.touches[0].clientX);
                }}
            >
                {/* Track Background */}
                <div className="absolute w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    {/* Progress Fill */}
                    <div
                        className="h-full bg-accent"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Hidden Real Input for Accessibility */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    disabled={disabled}
                />

                {/* Animated Thumb */}
                <motion.div
                    className="absolute w-4 h-4 bg-white dark:bg-white border-2 border-accent rounded-full shadow-lg z-0"
                    style={{
                        left: `calc(${percentage}% - 8px)`,
                    }}
                    animate={{
                        scale: isDragging ? 1.2 : 1,
                    }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 400 }}
                />
            </div>
        </div>
    );
}
