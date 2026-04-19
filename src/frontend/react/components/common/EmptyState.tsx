import React from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: React.ReactNode;
    };
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={clsx(
            "w-full h-full flex flex-col items-center justify-center text-center opacity-90 select-none p-6 animate-in fade-in zoom-in duration-300",
            className
        )}>
            <div className="w-32 h-32 mb-6 border-2 border-dashed border-textSecondary/20 rounded-3xl flex items-center justify-center bg-black/5 dark:bg-white/5 shadow-inner">
                <div className="text-textSecondary/40 group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-2 text-textPrimary">{title}</h2>
            <p className="text-sm text-textSecondary mb-8 max-w-xs leading-relaxed">{description}</p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-2 group"
                >
                    {action.icon}
                    {action.label}
                </button>
            )}
        </div>
    );
}
