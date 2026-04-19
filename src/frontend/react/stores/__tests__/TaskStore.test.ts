import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../TaskStore';

const task = {
    taskId: 't1',
    source: 'LOCAL_FILE' as const,
    inputs: ['a.png'],
    status: 'PROCESSING' as const,
    total: 2,
    processed: 1,
    succeeded: 1,
    failed: 0,
    errors: [],
    createdAt: 0,
};

describe('TaskStore', () => {
    beforeEach(() => {
        useTaskStore.setState({ activeTask: null });
    });

    it('should set and clear task correctly', () => {
        useTaskStore.getState().setTask(task);
        expect(useTaskStore.getState().activeTask?.taskId).toBe('t1');

        useTaskStore.getState().clearTask();
        expect(useTaskStore.getState().activeTask).toBeNull();
    });
});
