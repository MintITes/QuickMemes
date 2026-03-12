import { motion } from 'framer-motion';
import clsx from 'clsx';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
}

export function Switch({ checked, onChange, disabled, className, 'aria-label': ariaLabel }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={clsx(
                "group relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent shadow-inner",
                checked ? "bg-accent" : "bg-black/20 dark:bg-white/20",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            <motion.div
                layout
                transition={{
                    type: "spring",
                    stiffness: 700,
                    damping: 30
                }}
                className={clsx(
                    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    checked ? "translate-x-[22px]" : "translate-x-0.5"
                )}
            />
        </button>
    );
}
