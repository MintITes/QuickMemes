import { sendHttpRequest } from '../api/httpClient';
import type { ImportRequest, ImportTask } from '../types';

export async function importFiles(inputs: string[]) {
    const payload: ImportRequest = {
        source: 'LOCAL_FILE',
        inputs,
        options: {
            autoOcr: true,
            autoAiAnalyze: true,
            sourceName: '',
            sourceUrl: '',
        },
    };

    return sendHttpRequest<ImportTask>('POST', '/api/import', payload);
}

export async function importUrls(inputs: string[]) {
    const payload: ImportRequest = {
        source: 'URL',
        inputs,
        options: {
            autoOcr: true,
            autoAiAnalyze: true,
            sourceName: '',
            sourceUrl: inputs[0] ?? '',
        },
    };

    return sendHttpRequest<ImportTask>('POST', '/api/import', payload);
}

export async function cancelImport(taskId: string) {
    return sendHttpRequest<{ success: boolean }>('POST', '/api/import/cancel', { taskId });
}
