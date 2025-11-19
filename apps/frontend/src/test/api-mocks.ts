/**
 * API Mocks - Centralized API Mocking Infrastructure
 *
 * This module provides centralized API mocking utilities for testing.
 * It mocks the API client at the module level, allowing real React hooks
 * to function properly while controlling API responses.
 *
 * Key Features:
 * - Mock all API client methods with default responses
 * - TypeScript types for mocked API client
 * - Easy setup and reset functions
 * - Support for custom responses per test
 *
 * Usage:
 *   import { setupApiMocks, mockApiClient } from '@/test/api-mocks';
 *
 *   beforeEach(() => {
 *     setupApiMocks();
 *   });
 *
 *   it('test', () => {
 *     mockApiClient.sendMessage.mockResolvedValue(customResponse);
 *     // ... test code
 *   });
 */

import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  ChatRequest,
  ChatResponse,
  Conversation,
  ChatMessage,
  ProductSearchResponse,
  ProductSummary,
  BaseExtractionDocument,
  KGQueryRequest,
  KGQueryResponse,
  SystemStatus,
} from '@repo/shared-types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Mocked API Client interface with all methods as Vitest mocks
 */
export interface MockedApiClient {
  // Chat endpoints
  sendMessage: Mock<[ChatRequest], Promise<ChatResponse>>;
  getConversation: Mock<[string], Promise<Conversation>>;
  createConversation: Mock<[], Promise<Conversation>>;
  listConversations: Mock<[number?, number?], Promise<Conversation[]>>;
  deleteConversation: Mock<[string], Promise<void>>;
  updateConversationTitle: Mock<[string, string], Promise<void>>;
  getConversationMessages: Mock<
    [string, number?, number?],
    Promise<ChatMessage[]>
  >;

  // Product endpoints
  searchProducts: Mock<
    [
      {
        query?: string;
        family?: string;
        applications?: string[];
        limit?: number;
        offset?: number;
        sort_by?: 'name' | 'family' | 'relevance';
        sort_order?: 'asc' | 'desc';
      },
    ],
    Promise<ProductSearchResponse>
  >;
  getProduct: Mock<[string], Promise<BaseExtractionDocument>>;
  getRelatedProducts: Mock<[string, number?], Promise<ProductSummary[]>>;
  compareProducts: Mock<
    [string, string, string[]?],
    Promise<Record<string, unknown>>
  >;
  getProductFamilies: Mock<[], Promise<string[]>>;
  getProductApplications: Mock<[], Promise<string[]>>;
  getProductProperties: Mock<
    [string, string?],
    Promise<Record<string, unknown>[]>
  >;
  getProductStatistics: Mock<[], Promise<Record<string, unknown>>>;

  // Knowledge Graph endpoints
  queryKnowledgeGraph: Mock<[KGQueryRequest], Promise<KGQueryResponse>>;
  getEntityNeighbors: Mock<
    [string, number?, number?],
    Promise<KGQueryResponse>
  >;

  // System health endpoints
  getSystemStatus: Mock<[], Promise<SystemStatus>>;
  checkHealth: Mock<[], Promise<boolean>>;
}

// ============================================================================
// Default Mock Data
// ============================================================================

/**
 * Default mock data factories
 */
export const mockData = {
  conversation: (overrides?: Partial<Conversation>): Conversation => ({
    id: 'test-conv-1',
    title: 'Test Conversation',
    created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
    updated_at: new Date('2024-01-01T10:00:00Z').toISOString(),
    message_count: 0,
    ...overrides,
  }),

  chatMessage: (overrides?: Partial<ChatMessage>): ChatMessage => ({
    id: 'msg-1',
    conversation_id: 'test-conv-1',
    role: 'user',
    content: 'Test message',
    timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
    ...overrides,
  }),

  chatResponse: (overrides?: Partial<ChatResponse>): ChatResponse => ({
    message: mockData.chatMessage({
      role: 'assistant',
      content: 'Test response',
      ...overrides?.message,
    }),
    conversation_id: 'test-conv-1',
    sources: [],
    ...overrides,
  }),

  productSummary: (overrides?: Partial<ProductSummary>): ProductSummary => ({
    id: 'prod-1',
    name: 'Test Product',
    family: 'Test Family',
    description: 'Test description',
    applications: ['Application 1'],
    ...overrides,
  }),

  productSearchResponse: (
    overrides?: Partial<ProductSearchResponse>
  ): ProductSearchResponse => ({
    products: [mockData.productSummary()],
    total: 1,
    limit: 20,
    offset: 0,
    ...overrides,
  }),

  productDetail: (
    overrides?: Partial<BaseExtractionDocument>
  ): BaseExtractionDocument => ({
    id: 'prod-1',
    product_name: 'Test Product',
    product_family: 'Test Family',
    description: 'Test description',
    applications: ['Application 1'],
    physical_properties: {},
    chemical_properties: {},
    performance_characteristics: {},
    processing_guidelines: {},
    safety_information: {},
    regulatory_compliance: {},
    storage_handling: {},
    metadata: {
      source_file: 'test.pdf',
      extraction_date: new Date().toISOString(),
      version: '1.0',
    },
    ...overrides,
  }),

  kgQueryResponse: (overrides?: Partial<KGQueryResponse>): KGQueryResponse => ({
    entities: [],
    relationships: [],
    query: 'test query',
    ...overrides,
  }),

  systemStatus: (overrides?: Partial<SystemStatus>): SystemStatus => ({
    status: 'healthy',
    services: {
      vector_db: 'healthy',
      knowledge_graph: 'healthy',
      database: 'healthy',
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  }),
};

// ============================================================================
// Mock API Client
// ============================================================================

/**
 * Create a mock API client with default implementations
 */
export function createMockApiClient(): MockedApiClient {
  return {
    // Chat endpoints
    sendMessage: vi.fn().mockResolvedValue(mockData.chatResponse()),
    getConversation: vi.fn().mockResolvedValue(mockData.conversation()),
    createConversation: vi.fn().mockResolvedValue(mockData.conversation()),
    listConversations: vi.fn().mockResolvedValue([]),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
    updateConversationTitle: vi.fn().mockResolvedValue(undefined),
    getConversationMessages: vi.fn().mockResolvedValue([]),

    // Product endpoints
    searchProducts: vi.fn().mockResolvedValue(mockData.productSearchResponse()),
    getProduct: vi.fn().mockResolvedValue(mockData.productDetail()),
    getRelatedProducts: vi.fn().mockResolvedValue([]),
    compareProducts: vi.fn().mockResolvedValue({}),
    getProductFamilies: vi.fn().mockResolvedValue(['ASA', 'DCA', 'ECA']),
    getProductApplications: vi
      .fn()
      .mockResolvedValue(['Coatings', 'Adhesives', 'Epoxy Curing']),
    getProductProperties: vi.fn().mockResolvedValue([]),
    getProductStatistics: vi.fn().mockResolvedValue({
      totalProducts: 100,
      totalFamilies: 10,
      totalApplications: 20,
    }),

    // Knowledge Graph endpoints
    queryKnowledgeGraph: vi.fn().mockResolvedValue(mockData.kgQueryResponse()),
    getEntityNeighbors: vi.fn().mockResolvedValue(mockData.kgQueryResponse()),

    // System health endpoints
    getSystemStatus: vi.fn().mockResolvedValue(mockData.systemStatus()),
    checkHealth: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Global mock API client instance
 * This is the instance that will be used by the mocked @/lib/api-client module
 */
export const mockApiClient = createMockApiClient();

/**
 * Setup API mocks with default implementations
 * Call this in beforeEach to ensure consistent mock state
 *
 * @returns The mock API client for further customization
 */
export function setupApiMocks(): MockedApiClient {
  // Reset all mocks to clear call history
  vi.clearAllMocks();

  // Reset implementations to defaults
  mockApiClient.sendMessage.mockResolvedValue(mockData.chatResponse());
  mockApiClient.getConversation.mockResolvedValue(mockData.conversation());
  mockApiClient.createConversation.mockResolvedValue(mockData.conversation());
  mockApiClient.listConversations.mockResolvedValue([]);
  mockApiClient.deleteConversation.mockResolvedValue(undefined);
  mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
  mockApiClient.getConversationMessages.mockResolvedValue([]);

  mockApiClient.searchProducts.mockResolvedValue(
    mockData.productSearchResponse()
  );
  mockApiClient.getProduct.mockResolvedValue(mockData.productDetail());
  mockApiClient.getRelatedProducts.mockResolvedValue([]);
  mockApiClient.compareProducts.mockResolvedValue({});
  mockApiClient.getProductFamilies.mockResolvedValue(['ASA', 'DCA', 'ECA']);
  mockApiClient.getProductApplications.mockResolvedValue([
    'Coatings',
    'Adhesives',
    'Epoxy Curing',
  ]);
  mockApiClient.getProductProperties.mockResolvedValue([]);
  mockApiClient.getProductStatistics.mockResolvedValue({
    totalProducts: 100,
    totalFamilies: 10,
    totalApplications: 20,
  });

  mockApiClient.queryKnowledgeGraph.mockResolvedValue(
    mockData.kgQueryResponse()
  );
  mockApiClient.getEntityNeighbors.mockResolvedValue(
    mockData.kgQueryResponse()
  );

  mockApiClient.getSystemStatus.mockResolvedValue(mockData.systemStatus());
  mockApiClient.checkHealth.mockResolvedValue(true);

  return mockApiClient;
}

/**
 * Reset all API mocks
 * Call this in afterEach to ensure test isolation
 */
export function resetApiMocks(): void {
  vi.clearAllMocks();
}

// ============================================================================
// Module Mock Setup
// ============================================================================

/**
 * Mock the @/lib/api-client module
 * This should be called at the top level of test files
 */
vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: unknown,
      public requestId?: string
    ) {
      super(message);
      this.name = 'ApiError';
    }

    static fromResponse(response: Response, errorData?: any): MockApiError {
      const message =
        errorData?.message || `HTTP ${response.status}: ${response.statusText}`;
      return new MockApiError(
        message,
        response.status,
        errorData?.details,
        errorData?.request_id
      );
    }

    static fromNetworkError(error: Error): MockApiError {
      return new MockApiError(
        'Network error: Please check your connection and try again.',
        0,
        { originalError: error.message }
      );
    }

    static fromTimeout(): MockApiError {
      return new MockApiError(
        'Request timeout: The server is taking too long to respond.',
        408
      );
    }

    isNetworkError(): boolean {
      return this.status === 0;
    }

    isServerError(): boolean {
      return this.status >= 500;
    }

    isClientError(): boolean {
      return this.status >= 400 && this.status < 500;
    }

    isRetryable(): boolean {
      return (
        this.isNetworkError() || this.isServerError() || this.status === 408
      );
    }
  },
}));
