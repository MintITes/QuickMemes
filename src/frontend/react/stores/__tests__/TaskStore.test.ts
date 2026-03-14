import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../TaskStore';

describe('TaskStore', () => {
    beforeEach(() => {
        useTaskStore.setState({
            activeTask: null,
        });
    });

    it('should start task correctly', () => {
        const task = { id: 't1', name: 'Test Task', progress: 0 };
        useTaskStore.getState().startTask(task);

        const state = useTaskStore.getState();
        expect(state.activeTask).toMatchObject({
            ...task,
            status: 'running'
        });
    });

    it('should update progress', () => {
        useTaskStore.getState().startTask({ id: 't1', name: 'Task', progress: 0 });
        useTaskStore.getState().updateProgress(50, 'Halfway there');

        expect(useTaskStore.getState().activeTask?.progress).toBe(50);
        expect(useTaskStore.getState().activeTask?.description).toBe('Halfway there');
    });

    it('should complete task', () => {
        useTaskStore.getState().startTask({ id: 't1', name: 'Task', progress: 50 });
        useTaskStore.getState().completeTask();

        expect(useTaskStore.getState().activeTask?.status).toBe('completed');
        expect(useTaskStore.getState().activeTask?.progress).toBe(100);
    });

    it('should fail task', () => {
        useTaskStore.getState().startTask({ id: 't1', name: 'Task', progress: 50 });
        useTaskStore.getState().failTask('Something went wrong');

        expect(useTaskStore.getState().activeTask?.status).toBe('failed');
        expect(useTaskStore.getState().activeTask?.description).toBe('Something went wrong');
    });

    it('should clear task', () => {
        useTaskStore.getState().startTask({ id: 't1', name: 'Task', progress: 50 });
        useTaskStore.getState().clearTask();

        expect(useTaskStore.getState().activeTask).toBeNull();
    });
});
