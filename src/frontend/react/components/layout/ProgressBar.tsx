import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../../stores/TaskStore';
import { useEffect, useState } from 'react';

export function ProgressBar() {
    const activeTask = useTaskStore(state => state.activeTask);
    const clearTask = useTaskStore(state => state.clearTask);
    const [showShine, setShowShine] = useState(false);

    useEffect(() => {
        if (activeTask?.status === 'completed') {
            const timer = setTimeout(() => {
                setShowShine(true);
            }, 0);
            const clearTimer = setTimeout(() => {
                clearTask();
            }, 1500);
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
                setShowShine(false);
            };
        } else {
            const timer = setTimeout(() => {
                setShowShine(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [activeTask?.status, clearTask]);

    return (
        <AnimatePresence>
            {activeTask && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex items-center justify-center relative w-full h-full overflow-visible px-4"
                >
                    {/* Visual Progress Bar - Fixed in center */}
                    <div className="relative w-44 group/progress h-1.5 shrink-0">
                        {/* Background Track - Minimalist thin rounded bar */}
                        <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                            {activeTask.progress === null ? (
                                <motion.div
                                    className="absolute inset-0"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                                    }}
                                    animate={{
                                        x: ['-100%', '100%']
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 1.5,
                                        ease: "linear"
                                    }}
                                />
                            ) : (
                                <>
                                    <motion.div
                                        className="absolute top-0 left-0 h-full bg-white relative rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${activeTask.progress}%`,
                                        }}
                                        transition={{
                                            type: "spring",
                                            bounce: 0,
                                            duration: 0.5
                                        }}
                                    />
                                    <motion.div
                                        className="absolute inset-0 z-10"
                                        style={{
                                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                                            width: '100%'
                                        }}
                                        animate={{
                                            x: ['-100%', '100%']
                                        }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 2.5,
                                            ease: "easeInOut"
                                        }}
                                    />
                                </>
                            )}
                        </div>

                        {/* Shine Overflow Effect on Completion */}
                        <AnimatePresence>
                            {showShine && (
                                <motion.div
                                    initial={{ x: '-50%', opacity: 0, scaleX: 0.5 }}
                                    animate={{ x: '150%', opacity: [0, 1, 1, 0], scaleX: 1.5 }}
                                    transition={{ duration: 0.8, ease: "circIn" }}
                                    className="absolute inset-y-0 w-full z-20 pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.8), transparent)',
                                        filter: 'blur(4px)',
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Task Description & Meta */}
                    <div className="absolute left-[calc(50%+100px)] flex items-center gap-2 whitespace-nowrap leading-none select-none h-4">
                        <span className="text-[10px] font-bold tracking-tight text-white max-w-[120px] truncate leading-none">
                            {activeTask.name}
                        </span>

                        <div className="w-px h-2.5 bg-white/20 shrink-0 mx-0.5" />

                        <div className="flex items-center gap-2 leading-none">
                            {activeTask.progress !== null ? (
                                <span className="text-[10px] text-white/50 font-medium leading-none">
                                    {Math.round(activeTask.progress)}%
                                </span>
                            ) : activeTask.description && (
                                <span className="text-[10px] text-white/40 truncate max-w-[100px] leading-none">
                                    {activeTask.description}
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
