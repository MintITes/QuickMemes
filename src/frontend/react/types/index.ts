export interface Meme {
    id: number;
    name: string;
    filePath: string;
    thumbnailPath?: string;
    sourceUrl?: string;
    ocrText?: string;
    tagIds: number[];
    categoryId?: number;
    createdAt: number;
    updatedAt: number;
    width: number;
    height: number;
    size: number;
    format: string;
    deletedAt?: number; // If in recycle bin
}

export interface Tag {
    id: number;
    name: string;
    color?: string;
}

export interface Category {
    id: number;
    name: string;
    order: number;
}
