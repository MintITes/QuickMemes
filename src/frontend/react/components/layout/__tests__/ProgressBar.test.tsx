import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../../../stores/TaskStore';

describe('ProgressBar component', () => {
    beforeEach(() => {
        useTaskStore.setState({ activeTask: null });
    });

    it('renders nothing when no active task', () => {
        const { container } = render(<ProgressBar />);
        expect(container.firstChild).toBeNull();
    });

    it('renders progress bar when task is active', () => {
        useTaskStore.setState({
            activeTask: { id: '1', name: 'Uploading', progress: 45, status: 'running' }
        });
        render(<ProgressBar />);
        expect(screen.getByText('Uploading')).toBeInTheDocument();
        expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('shows indeterminate state when progress is null', () => {
        useTaskStore.setState({
            activeTask: { id: '1', name: 'Processing', progress: null, status: 'running' }
        });
        render(<ProgressBar />);
        expect(screen.getByText('Processing')).toBeInTheDocument();
        // Check for indeterminate class if applicable, or lack of percentage text
        expect(screen.queryByText('%')).toBeNull();
    });

    it('renders success state when completed', () => {
        useTaskStore.setState({
            activeTask: { id: '1', name: 'Done', progress: 100, status: 'completed' }
        });
        render(<ProgressBar />);
        expect(screen.getByText('Done')).toBeInTheDocument();
        // Look for check icon or success text/color class if identifiable
    });
});
