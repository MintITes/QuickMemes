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

    it('renders progress metadata when task is active', () => {
        useTaskStore.setState({
            activeTask: {
                taskId: 'job-1',
                source: 'LOCAL_FILE',
                inputs: ['a.png'],
                status: 'PROCESSING',
                total: 4,
                processed: 2,
                succeeded: 1,
                failed: 0,
                errors: [],
                createdAt: 0,
            }
        });

        render(<ProgressBar />);
        expect(screen.getByText('job-1')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
    });
});
