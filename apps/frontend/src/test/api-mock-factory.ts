/**
 * API Mock Factory
 *
 * Centralized factory for creating API client mocks with configurable responses.
 * Supports delayed responses, error simulation, and common test scenarios.
 */

import { vi } from 'vitest';
import type {
  ChatResponse,
  Conversation,
  ChatMessage,
  ProductSearchResponse,
  ProductSummary,
  BaseExtractionDocument,
  KGQueryResponse,
  SystemStatus,
} from '@repo/shared-types';

// Mock response types
export type MockResponse<T> =
  | T
  | Promise<T>
  | (() => T)
  | (() => Promise<T>)
  | { delay: number; response: T }
  | { error: Error | string };

export interface MockConfig {
  delay?: number;
  error?: Error | string;
  response?: any;
}

// Helper to create delayed promises
export function createDelayedResponse<T>(
  response: T,
  delay: number = 100
): () => Promise<T> {
  return () =>
    new Promise<T>((resolve) => setTimeout(() => resolve(response), delay));
}

// Helper to create error responses
export function createErrorResponse(
  message: string,
  status: number = 500
): () => Promise<never> {
  return () => Promise.reject(new Error(message));
}

// Default mock data
export const mockDefaults = {
  conversation: (): Conversation => ({
    id: 'test-conv-1',
    title: 'Test Conversation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
  }),

  chatMessage: (overrides?: Partial<ChatMessage>): ChatMessage => ({
    id: 'msg-1',
    conversation_id: 'test-conv-1',
    role: 'user',
    content: 'Test message',
    timestamp: new Date().toISOString(),
    ...overrides,
  }),

  chatResponse: (overrides?: Partial<ChatResponse>): ChatResponse => ({
    message: mockDefaults.chatMessage({
      role: 'assistant',
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
    products: [mockDefaults.productSummary()],
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

// API Mock Configuration Interface
export interface ApiMockConfig {
  chat?: {
    sendMessage?: MockResponse<ChatResponse>;
    getConversation?: MockResponse<Conversation>;
    createConversation?: MockResponse<Conversation>;
    listConversations?: MockResponse<Conversation[]>;
    deleteConversation?: MockResponse<void>;
    updateConversationTitle?: MockResponse<void>;
    getConversationMessages?: MockResponse<ChatMessage[]>;
  };
  products?: {
    searchProducts?: MockResponse<ProductSearchResponse>;
    getProduct?: MockResponse<BaseExtractionDocument>;
    getRelatedProducts?: MockResponse<ProductSummary[]>;
    compareProducts?: MockResponse<Record<string, unknown>>;
    getProductFamilies?: MockResponse<string[]>;
    getProductApplications?: MockResponse<string[]>;
    getProductProperties?: MockResponse<Record<string, unknown>[]>;
    getProductStatistics?: MockResponse<Record<string, unknown>>;
  };
  kg?: {
    queryKnowledgeGraph?: MockResponse<KGQueryResponse>;
    getEntityNeighbors?: MockResponse<KGQueryResponse>;
  };
  health?: {
    getSystemStatus?: MockResponse<SystemStatus>;
    checkHealth?: MockResponse<boolean>;
  };
}

// Create mock function from config
function createMockFunction<T>(config?: MockResponse<T>): any {
  if (!config) {
    return vi.fn();
  }

  if (typeof config === 'function') {
    return vi.fn(config);
  }

  if (config && typeof config === 'object') {
    if ('error' in config) {
      const error =
        typeof config.error === 'string'
          ? new Error(config.error)
          : config.error;
      return vi.fn(() => Promise.reject(error));
    }

    if ('delay' in config && 'response' in config) {
      return vi.fn(createDelayedResponse(config.response, config.delay));
    }
  }

  // Direct value
  return vi.fn(() => Promise.resolve(config));
}

/**
 * Create API client mocks with optional configuration
 */
export function createApiMocks(config: ApiMockConfig = {}) {
  return {
    // Chat operations
    sendMessage: createMockFunction(config.chat?.sendMessage),
    getConversation: createMockFunction(config.chat?.getConversation),
    createConversation: createMockFunction(config.chat?.createConversation),
    listConversations: createMockFunction(config.chat?.listConversations),
    deleteConversation: createMockFunction(config.chat?.deleteConversation),
    updateConversationTitle: createMockFunction(
      config.chat?.updateConversationTitle
    ),
    getConversationMessages: createMockFunction(
      config.chat?.getConversationMessages
    ),

    // Product operations
    searchProducts: createMockFunction(config.products?.searchProducts),
    getProduct: createMockFunction(config.products?.getProduct),
    getRelatedProducts: createMockFunction(config.products?.getRelatedProducts),
    compareProducts: createMockFunction(config.products?.compareProducts),
    getProductFamilies: createMockFunction(config.products?.getProductFamilies),
    getProductApplications: createMockFunction(
      config.products?.getProductApplications
    ),
    getProductProperties: createMockFunction(
      config.products?.getProductProperties
    ),
    getProductStatistics: createMockFunction(
      config.products?.getProductStatistics
    ),

    // Knowledge Graph operations
    queryKnowledgeGraph: createMockFunction(config.kg?.queryKnowledgeGraph),
    getEntityNeighbors: createMockFunction(config.kg?.getEntityNeighbors),

    // Health operations
    getSystemStatus: createMockFunction(config.health?.getSystemStatus),
    checkHealth: createMockFunction(config.health?.checkHealth),
  };
}
