import type { ImportSource, ImportTask, TaskStatus } from '../types';

const BACKGROUND_TASK_PREFIXES = ['thumb-', 'rebuild-'] as const;

export interface RawTaskEvent {
    taskId?: string;
    status?: string;
    total?: number;
    processed?: number;
    succeeded?: number;
    failed?: number;
    errors?: string[];
    error?: string;
    code?: number;
    source?: ImportSource;
    inputs?: string[];
    createdAt?: number;
}

export const ERR_DUPLICATE = 1003;

export function isForegroundImportTaskId(taskId: string | undefined): taskId is string {
    return typeof taskId === 'string'
        && taskId.length > 0
        && !BACKGROUND_TASK_PREFIXES.some((prefix) => taskId.startsWith(prefix));
}

function normalizeTaskStatus(status: string | TaskStatus | undefined): TaskStatus {
    const normalized = status?.toUpperCase();
    if (normalized === 'PENDING' || normalized === 'PROCESSING' || normalized === 'DONE' || normalized === 'FAILED' || normalized === 'CANCELLED') {
        return normalized;
    }
    return 'PROCESSING';
}

function normalizeCount(value: unknown, fallback: number) {
    return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : fallback;
}

export function mergeImportTaskUpdate(update: RawTaskEvent, previous: ImportTask | null = null): ImportTask | null {
    if (!isForegroundImportTaskId(update.taskId)) {
        return null;
    }

    const total = normalizeCount(update.total, previous?.total ?? 0);
    const succeeded = normalizeCount(update.succeeded, previous?.succeeded ?? 0);
    const failed = normalizeCount(update.failed, previous?.failed ?? 0);
    let processed = Number.isFinite(update.processed) ? Number(update.processed) : previous?.processed;
    const status = normalizeTaskStatus(update.status ?? previous?.status);

    if (processed === undefined && (succeeded > 0 || failed > 0)) {
        processed = succeeded + failed;
    }
    if (processed === undefined && (status === 'DONE' || status === 'FAILED' || status === 'CANCELLED') && total > 0) {
        processed = total;
    }

    const previousErrors = previous?.errors ?? [];
    const errors = normalizeStringArray(
        update.errors ?? (typeof update.error === 'string' && update.error.length > 0 ? [update.error] : undefined),
        previousErrors
    );

    return {
        taskId: update.taskId,
        source: update.source ?? previous?.source ?? 'LOCAL_FILE',
        inputs: normalizeStringArray(update.inputs, previous?.inputs ?? []),
        status,
        total,
        processed: processed ?? 0,
        succeeded,
        failed,
        errors,
        createdAt: normalizeCount(update.createdAt, previous?.createdAt ?? Date.now()),
    };
}

export function isDuplicateImportTaskError(update: RawTaskEvent): boolean {
    if (update.code === ERR_DUPLICATE) {
        return true;
    }

    const message = update.error?.toLowerCase().trim() ?? '';
    return message.includes('meme already exists') || (message.includes('already exists') && message.includes('hash'));
}

export function isDuplicateImportErrorMessage(message: string | undefined): boolean {
    const normalized = message?.toLowerCase().trim() ?? '';
    return normalized.includes('meme already exists') || (normalized.includes('already exists') && normalized.includes('hash'));
}

export function isTerminalImportTaskStatus(status: TaskStatus | string | undefined): boolean {
    return status === 'DONE' || status === 'FAILED' || status === 'CANCELLED';
}

export function shouldApplyImportTaskSnapshot(currentTask: ImportTask | null, incomingTask: ImportTask): boolean {
    return currentTask?.taskId !== incomingTask.taskId;
}
