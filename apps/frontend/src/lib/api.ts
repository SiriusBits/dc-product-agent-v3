export interface Source {
    id: string;
    content: string;
    metadata: Record<string, any>;
}

export interface QueryResponse {
    answer: string;
    sources: Source[];
}

export interface Product {
    id: string;
    name: string;
    description: string;
    filename: string;
    category: string;
}

export interface DocumentsResponse {
    documents: Product[];
}

export const api = {
    async query(query: string): Promise<QueryResponse> {
        const response = await fetch('/api/v1/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw new Error('Failed to query the agent');
        }

        return response.json();
    },

    async getDocuments(): Promise<DocumentsResponse> {
        const response = await fetch('/api/v1/documents');

        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }

        return response.json();
    },
};
