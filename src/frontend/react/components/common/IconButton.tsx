import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'ghost' | 'glass' | 'solid';
    active?: boolean;
}

export function IconButton({
    icon,
    size = 'md',
    variant = 'glass',
    active = false,
    className,
    disabled,
    ...props
}: IconButtonProps) {
    const sizeClasses = {
        sm: 'w-7 h-7 rounded-lg',
        md: 'w-9 h-9 rounded-xl',
        lg: 'w-11 h-11 rounded-2xl',
        xl: 'w-14 h-14 rounded-2xl',
    };

    const variantClasses = {
        ghost: 'hover:bg-black/5 dark:hover:bg-white/10',
        glass: 'glass-effect bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-white/10 dark:border-black/10',
        solid: 'bg-accent text-white hover:bg-accent/90 shadow-md',
    };

    return (
        <button
            className={twMerge(
                clsx(
                    "flex items-center justify-center transition-all duration-200 ease-out outline-none no-drag select-none group",
                    sizeClasses[size],
                    variantClasses[variant],
                    active && "bg-black/10 dark:bg-white/15 border-accent/30 text-accent",
                    disabled ? "opacity-40 grayscale pointer-events-none" : "hover:scale-105 active:scale-95 active:bg-black/20 dark:active:bg-white/20",
                    className
                )
            )}
            disabled={disabled}
            {...props}
        >
            <span className={clsx(
                "transition-transform",
                !disabled && "group-hover:scale-110"
            )}>
                {icon}
            </span>
        </button>
    );
}
