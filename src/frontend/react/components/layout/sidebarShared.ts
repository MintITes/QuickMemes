import type { CSSProperties } from 'react';

export const categoryComposerStyle: CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    borderColor: 'color-mix(in srgb, var(--accent-color), transparent 80%)',
    boxShadow: '0 8px 32px -12px color-mix(in srgb, var(--accent-color), transparent 70%), 0 4px 12px -4px rgba(0,0,0,0.1)',
    borderWidth: '1px',
};

export const getCategoryInputStyle = (isFocused: boolean): CSSProperties => ({
    backgroundColor: isFocused
        ? 'color-mix(in srgb, var(--accent-color) 4%, var(--bg-surface))'
        : 'color-mix(in srgb, var(--accent-color) 2%, var(--bg-surface))',
    borderColor: isFocused
        ? 'color-mix(in srgb, var(--accent-color), transparent 60%)'
        : 'color-mix(in srgb, var(--accent-color), transparent 85%)',
    boxShadow: isFocused
        ? '0 0 0 4px color-mix(in srgb, var(--accent-color), transparent 92%)'
        : 'none',
    caretColor: 'var(--accent-color)',
});

export const PRESET_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#2563eb'
] as const;

