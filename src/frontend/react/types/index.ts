export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'SKIPPED';
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'CANCELLED';
export type ImportSource = 'URL' | 'CLIPBOARD' | 'LOCAL_FILE' | 'SCREENSHOT' | 'DRAG_DROP';

export interface Tag {
    id: number;
    name: string;
    color: string;
    createdAt: number;
}

export interface Category {
    id: number;
    uuid: string;
    name: string;
    color: string;
    position: number;
    createdAt: number;
    updatedAt: number;
}

export interface Meme {
    id: number;
    filePath: string;
    fileHash: string;
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
    sourceName: string;
    sourceUrl: string;
    name: string;
    description: string;
    ocrText: string;
    ocrStatus: ProcessingStatus;
    aiStatus: ProcessingStatus;
    tagIds: number[];
    tags: Tag[];
    createdAt: number;
    updatedAt: number;
    lastUsedAt: number;
    deletedAt: number;
    categoryId: number;
}

export interface SearchQuery {
    keyword: string;
    tagIds: number[];
    categoryId: number;
    source: string;
    timeFrom: number;
    timeTo: number;
    formats: string[];
    sizeMin: number;
    sizeMax: number;
    regex: string;
    useVector: boolean;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    limit: number;
    offset: number;
    includeTags: boolean;
}

export interface SearchResultItem {
    meme: Meme;
    similarityScore: number;
}

export interface SearchResult {
    items: SearchResultItem[];
    total: number;
}

export interface HealthStatus {
    status: 'ok' | 'degraded';
    modules: {
        vision: boolean;
        db: boolean;
    };
}

export interface ImportOptions {
    autoOcr: boolean;
    autoAiAnalyze: boolean;
    sourceName: string;
    sourceUrl: string;
}

export interface ImportRequest {
    source: ImportSource;
    inputs: string[];
    options: ImportOptions;
}

export interface ImportTask {
    taskId: string;
    source: ImportSource;
    inputs: string[];
    status: TaskStatus;
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
    createdAt: number;
}

export interface TaskHandle {
    taskId: string;
}

export interface RuntimeConfigPatch {
    aiApiKey?: string;
    aiApiBaseUrl?: string;
    aiVisionModel?: string;
    aiEmbeddingModel?: string;
    aiTimeoutSeconds?: number;
    aiMaxRetries?: number;
    ocrApiKey?: string;
    ocrApiUrl?: string;
    ocrProvider?: string;
    logMinLevel?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error: string;
    code: number;
}

export interface WsEventMap {
    'task:progress': ImportTask;
    'task:complete': ImportTask;
    'task:error': ImportTask;
    'meme:added': Meme;
    'meme:updated': Meme;
    'meme:deleted': { id: number };
    'meme:used': { id: number; lastUsedAt: number };
    'tag:created': Tag;
    'tag:deleted': { id: number };
    'category:created': Category;
    'category:updated': Category;
    'category:deleted': { id: number };
}

export type WsEventName = keyof WsEventMap;
