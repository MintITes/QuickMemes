import { describe, expect, it } from 'vitest';
import {
    isDuplicateImportErrorMessage,
    isDuplicateImportTaskError,
    isForegroundImportTaskId,
    mergeImportTaskUpdate,
} from '../taskEvents';

describe('taskEvents', () => {
    it('ignores thumbnail background tasks', () => {
        expect(isForegroundImportTaskId('thumb-2-cfbe8dd8-5b')).toBe(false);
        expect(mergeImportTaskUpdate({ taskId: 'thumb-2-cfbe8dd8-5b', status: 'processing' })).toBeNull();
    });

    it('normalizes completion events without processed count', () => {
        const task = mergeImportTaskUpdate({
            taskId: 'import-job-1',
            status: 'done',
            total: 3,
            succeeded: 3,
            failed: 0,
        });

        expect(task).toMatchObject({
            taskId: 'import-job-1',
            status: 'DONE',
            total: 3,
            processed: 3,
            succeeded: 3,
            failed: 0,
        });
    });

    it('preserves initial import metadata when progress payload is partial', () => {
        const initial = mergeImportTaskUpdate({
            taskId: 'import-job-2',
            status: 'pending',
            total: 2,
            processed: 0,
            inputs: ['a.png', 'b.png'],
            source: 'LOCAL_FILE',
        });

        const next = mergeImportTaskUpdate({
            taskId: 'import-job-2',
            status: 'processing',
        }, initial);

        expect(next).toMatchObject({
            taskId: 'import-job-2',
            status: 'PROCESSING',
            total: 2,
            processed: 0,
            inputs: ['a.png', 'b.png'],
            source: 'LOCAL_FILE',
        });
    });

    it('detects duplicate meme import errors', () => {
        expect(isDuplicateImportTaskError({
            taskId: 'import-job-3',
            error: 'Meme already exists: deadbeef',
            code: 1003,
        })).toBe(true);

        expect(isDuplicateImportTaskError({
            taskId: 'import-job-3',
            error: 'Meme already exists: deadbeef',
        })).toBe(true);

        expect(isDuplicateImportErrorMessage('Meme already exists: deadbeef')).toBe(true);
        expect(isDuplicateImportErrorMessage('Failed to download image from URL')).toBe(false);
    });
});
