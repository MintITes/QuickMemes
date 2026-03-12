import { useUiStore } from '../../stores/UiStore';
import { motion } from 'framer-motion';
import { Heart, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

export function LivePreview() {
    const { glassBlur, cornerRadius, galleryGap, accentColor, resolvedTheme, glassEffect } = useUiStore();

    return (
        <div className="flex flex-col gap-3 pointer-events-none select-none">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">实时预览 Live Preview</span>

            <div
                className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center p-6"
            >
                {/* Abstract Background Shapes */}
                <div className="absolute top-4 left-4 w-20 h-20 bg-accent/30 rounded-full blur-2xl" style={{ backgroundColor: `${accentColor}4d` }}></div>
                <div className="absolute bottom-4 right-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl"></div>

                {/* Demo Card */}
                <motion.div
                    animate={{
                        borderRadius: cornerRadius,
                        backdropFilter: glassEffect ? `blur(${glassBlur}px)` : 'blur(0px)',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={clsx(
                        "relative w-full max-w-[200px] aspect-square flex flex-col shadow-2xl border border-white/20 overflow-hidden",
                        resolvedTheme === 'dark' ? "bg-black/40" : "bg-white/60"
                    )}
                >
                    {/* Placeholder Image Area */}
                    <div className="flex-1 bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-tr from-gray-500/10 to-gray-500/5 flex items-center justify-center">
                            <span className="text-[10px] font-bold opacity-20">MEME PREVIEW</span>
                        </div>
                    </div>

                    {/* Card Content Area */}
                    <div className="p-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div
                                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm"
                                style={{ backgroundColor: accentColor }}
                            >
                                DEMO TAG
                            </div>
                            <div className="h-1 flex-1 bg-black/10 dark:bg-white/10 rounded-full"></div>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex gap-2 opacity-40">
                                <Heart size={12} />
                                <MessageSquare size={12} />
                            </div>
                            <div className="w-8 h-3 bg-black/10 dark:bg-white/10 rounded-sm"></div>
                        </div>
                    </div>
                </motion.div>

                {/* Spacing Indicator */}
                <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-40"
                    style={{ gap: galleryGap / 2 }}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                </div>
            </div>

            <p className="text-[11px] text-center opacity-50 px-4 leading-relaxed">
                此卡片展示了毛玻璃、圆角和强调色的实时组合效果。
            </p>
        </div>
    );
}
