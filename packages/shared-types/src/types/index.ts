// Base utility type (kept for backward compatibility)
export interface BaseEntity {
    id: string;
    createdAt: string;
    updatedAt: string;
}

// Schema-generated types
export * from './generated';
