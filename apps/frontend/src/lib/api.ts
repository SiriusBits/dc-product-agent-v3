// Query-related interfaces
export interface Source {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
}

export interface QueryResponse {
    answer: string;
    sources: Source[];
}

// Legacy interface for backwards compatibility
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

// Product API interfaces matching backend models
export interface ProductSummary {
    doc_id: string;
    product_name: string;
    product_short_name: string;
    product_family: string | null;
    cas_number: string | null;
    summary: string | null;
    key_applications: string[];
    pdf_filename: string | null;
}

export interface ProductListResponse {
    products: ProductSummary[];
    count: number;
}

export interface ContactInfo {
    address: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
}

export interface ProductInfo {
    product_name: string;
    product_short_name: string;
    product_family: string | null;
    cas_number: string | null;
    chemical_name: string | null;
    synonyms: string[];
}

export interface PropertySpec {
    category: string | null;
    name: string;
    unit: string | null;
    value_string: string | null;
    value_numeric: number | null;
    value_min: number | null;
    value_max: number | null;
    test_method: string | null;
    page: number | null;
    notes: string | null;
}

export interface Section {
    name: string;
    page: number | null;
    text: string;
}

export interface Registration {
    authority: string | null;
    jurisdiction: string | null;
    registration_number: string | null;
    registration_name: string | null;
    cas_number: string | null;
    status: string | null;
    effective_date: string | null;
    notes: string | null;
}

export interface DerivedInfo {
    summary: string | null;
    personas: Record<string, string> | null;
    key_applications: string[];
}

export interface ExtractionMetadata {
    confidence_scores: Record<string, unknown>;
    extractor_version: string | null;
    extraction_date: string | null;
}

export interface ProductDetail {
    doc_id: string;
    filename: string;
    filepath: string | null;
    document_type: string | null;
    manufacturer: string | null;
    contact_info: ContactInfo | null;
    product_info: ProductInfo;
    registrations: Registration[];
    key_benefits: string[];
    applications_text: string | null;
    applications: string[];
    properties_and_specifications: PropertySpec[];
    sections: Section[];
    derived_info: DerivedInfo | null;
    extraction_metadata: ExtractionMetadata | null;
}

export interface ProductPdfResponse {
    product_id: string;
    product_name: string;
    pdf_url: string;
    filename: string;
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

    async getProducts(): Promise<ProductListResponse> {
        const response = await fetch('/api/v1/products');

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        return response.json();
    },

    async getProduct(id: string): Promise<ProductDetail> {
        const response = await fetch(`/api/v1/products/${encodeURIComponent(id)}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Product not found: ${id}`);
            }
            throw new Error('Failed to fetch product details');
        }

        return response.json();
    },

    async getProductPdf(id: string): Promise<ProductPdfResponse> {
        const response = await fetch(`/api/v1/products/${encodeURIComponent(id)}/pdf`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`PDF not found for product: ${id}`);
            }
            throw new Error('Failed to fetch product PDF');
        }

        return response.json();
    },
};
