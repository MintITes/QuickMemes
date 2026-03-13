import { create } from 'zustand';

export interface AppTask {
    id: string;
    name: string;
    description?: string;
    progress: number | null; // 0-100, or null for indeterminate
    status: 'running' | 'completed' | 'failed';
}

interface TaskState {
    activeTask: AppTask | null;

    // Actions
    startTask: (task: Omit<AppTask, 'status'>) => void;
    updateProgress: (progress: number | null, description?: string) => void;
    completeTask: () => void;
    failTask: (error?: string) => void;
    clearTask: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
    activeTask: null,

    startTask: (task) => set({
        activeTask: { ...task, status: 'running' }
    }),

    updateProgress: (progress, description) => set((state) => ({
        activeTask: state.activeTask ? {
            ...state.activeTask,
            progress,
            description: description ?? state.activeTask.description
        } : null
    })),

    completeTask: () => set((state) => ({
        activeTask: state.activeTask ? {
            ...state.activeTask,
            status: 'completed',
            progress: 100
        } : null
    })),

    failTask: (error) => set((state) => ({
        activeTask: state.activeTask ? {
            ...state.activeTask,
            status: 'failed',
            description: error ?? state.activeTask.description
        } : null
    })),

    clearTask: () => set({ activeTask: null }),
}));
