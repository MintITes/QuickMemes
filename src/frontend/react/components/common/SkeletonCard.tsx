import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface SkeletonCardProps {
    viewMode: 'grid' | 'masonry';
    /** 瀑布流模式下传入真实宽高比，例如 "16 / 9" */
    aspectRatio?: string;
    index?: number;
}

const MORANDI_COLORS = [
    '#B8C4BB', // Sage Green
    '#C9BBC8', // Muted Lavender
    '#E5D3B3', // Soft Sand
    '#D2B48C', // Tan
    '#A9B2C3', // Steel Blue
];

export function SkeletonCard({ viewMode, aspectRatio, index = 0 }: SkeletonCardProps) {
    const bgColor = useMemo(() => {
        return MORANDI_COLORS[index % MORANDI_COLORS.length];
    }, [index]);

    return (
        <motion.div
            className={clsx(
                'w-full rounded-xl border border-borderColor/10 relative overflow-hidden',
                // grid: 1:1 正方形；masonry 有比例用比例，无比例兜底 min-height
                viewMode === 'grid' ? 'aspect-square' : (!aspectRatio ? 'min-h-[150px]' : '')
            )}
            style={{ backgroundColor: bgColor, aspectRatio: viewMode === 'masonry' ? aspectRatio : undefined }}
            animate={{
                opacity: [0.4, 0.6, 0.4],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        >
            {/* Shimmer Effect */}
            <motion.div
                className="absolute inset-0 z-10"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                    width: '200%',
                }}
                animate={{
                    x: ['-100%', '100%'],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                }}
            />
        </motion.div>
    );
}
