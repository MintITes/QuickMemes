import { useEffect, useState } from 'react';

export function FpsOverlay() {
    const [fps, setFps] = useState(0);
    const [frameTime, setFrameTime] = useState(0);

    useEffect(() => {
        let animationFrameId = 0;
        let lastSampleAt = performance.now();
        let frameCount = 0;

        const tick = (now: number) => {
            frameCount += 1;
            const elapsed = now - lastSampleAt;

            if (elapsed >= 500) {
                setFps(Math.round((frameCount * 1000) / elapsed));
                setFrameTime(Math.round((elapsed / frameCount) * 10) / 10);
                lastSampleAt = now;
                frameCount = 0;
            }

            animationFrameId = window.requestAnimationFrame(tick);
        };

        animationFrameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed top-3 right-3 z-[200] pointer-events-none rounded-xl border border-black/10 dark:border-white/10 bg-black/75 text-white px-3 py-2 shadow-xl backdrop-blur-md font-mono text-[11px] leading-tight">
            <div className="font-bold tracking-[0.18em] uppercase">FPS</div>
            <div className="mt-1 tabular-nums">
                <span className="text-base font-semibold">{fps || '--'}</span>
                <span className="ml-1 opacity-70">fps</span>
            </div>
            <div className="mt-0.5 opacity-70 tabular-nums">{frameTime ? `${frameTime} ms` : '-- ms'}</div>
        </div>
    );
}
