import React, { forwardRef } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface PlusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
}

export const PlusButton = forwardRef<HTMLButtonElement, PlusButtonProps>(
    ({ active, className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={twMerge(
                    clsx(
                        "w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center transition-all duration-200 ease-out no-drag shadow-md focus:outline-none focus:ring-2 focus:ring-accent/50",
                        "hover:shadow-lg hover:scale-105 hover:brightness-110",
                        "active:scale-100 active:brightness-90 active:shadow-sm",
                        active && "scale-100 brightness-90 shadow-inner ring-2 ring-accent/20",
                        className
                    )
                )}
                title="添加新梗图"
                {...props}
            >
                <Plus size={16} strokeWidth={3} className="no-drag" />
            </button>
        );
    }
);

PlusButton.displayName = 'PlusButton';
