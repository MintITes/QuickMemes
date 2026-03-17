import { create } from 'zustand';
import type { ImportTask } from '../types';

interface TaskState {
    activeTask: ImportTask | null;
    setTask: (task: ImportTask) => void;
    clearTask: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
    activeTask: null,
    setTask: (task) => set({ activeTask: task }),
    clearTask: () => set({ activeTask: null }),
}));
