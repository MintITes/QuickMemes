import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUiStore } from '../../../stores/UiStore';

describe('Header component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useUiStore.setState({
            searchQuery: {
                keyword: '',
                tagIds: [],
                matchMode: 'fuzzy',
                mediaType: 'all',
                dateRange: 'all',
            }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders logo and basic controls', () => {
        render(<Header />);
        expect(screen.getByText('QuickMemes')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/搜索/i)).toBeInTheDocument();
        // Control buttons. The IconButton component doesn't always render title on the button itself if not passed directly, checking aria-label
        expect(screen.getByLabelText(/布局/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/设置/i)).toBeInTheDocument();
    });

    it('forces global search input to use fuzzy mode', () => {
        useUiStore.setState({
            searchQuery: {
                keyword: '',
                tagIds: [],
                matchMode: 'word',
                mediaType: 'all',
                dateRange: 'all',
            }
        });

        render(<Header />);

        const input = screen.getByPlaceholderText(/搜索/i);
        fireEvent.change(input, { target: { value: 'test keyword' } });
        vi.advanceTimersByTime(350);

        expect(useUiStore.getState().searchQuery.keyword).toBe('test keyword');
        expect(useUiStore.getState().searchQuery.matchMode).toBe('fuzzy');
    });
});
