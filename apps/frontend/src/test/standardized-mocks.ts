/**
 * Standardized mock factories for integration tests
 *
 * This file provides type-safe mock factories for all hook return values,
 * ensuring consistency across tests and matching actual hook interfaces.
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ProductSummary,
  SearchFacets,
  RetrievalResult,
} from '@repo/shared-types';

// Import ApiError type only to avoid circular dependency
type ApiError = {
  message: string;
  status: number;
  details?: unknown;
  requestId?: string;
  name: string;
  isNetworkError(): boolean;
  isServerError(): boolean;
  isClientError(): boolean;
  isRetryable(): boolean;
};

// ============================================================================
// Hook Return Value Factories
// ============================================================================

/**
 * Mock return value for useChat hook
 */
export interface MockUseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ApiError | null;
  conversationId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
  clearMessages: ReturnType<typeof vi.fn>;
  loadConversation: ReturnType<typeof vi.fn>;
  retryLastMessage: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Creates a mock useChat return value with type-safe defaults
 */
export const createMockUseChatReturn = (
  overrides?: Partial<MockUseChatReturn>
): MockUseChatReturn => ({
  messages: [],
  isLoading: false,
  error: null,
  conversationId: null,
  sendMessage: vi.fn().mockResolvedValue(undefined),
  clearMessages: vi.fn(),
  loadConversation: vi.fn().mockResolvedValue(undefined),
  retryLastMessage: vi.fn().mockResolvedValue(undefined),
  isRetryable: false,
  ...overrides,
});

/**
 * Mock return value for useProducts hook
 */
export interface MockUseProductsReturn {
  products: ProductSummary[];
  totalCount: number;
  facets: SearchFacets | null;
  loading: boolean;
  error: string | null;
  searchProducts: ReturnType<typeof vi.fn>;
  loadMore: ReturnType<typeof vi.fn>;
  hasMore: boolean;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Creates a mock useProducts return value with type-safe defaults
 */
export const createMockUseProductsReturn = (
  overrides?: Partial<MockUseProductsReturn>
): MockUseProductsReturn => ({
  products: [],
  totalCount: 0,
  facets: null,
  loading: false,
  error: null,
  searchProducts: vi.fn().mockResolvedValue(undefined),
  loadMore: vi.fn().mockResolvedValue(undefined),
  hasMore: false,
  retry: vi.fn().mockResolvedValue(undefined),
  isRetryable: false,
  ...overrides,
});

/**
 * Mock return value for useConversations hook
 */
export interface MockUseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Creates a mock useConversations return value with type-safe defaults
 */
export const createMockUseConversationsReturn = (
  overrides?: Partial<MockUseConversationsReturn>
): MockUseConversationsReturn => ({
  conversations: [],
  isLoading: false,
  error: null,
  loadConversations: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn().mockResolvedValue(null),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
  isRetryable: false,
  ...overrides,
});

/**
 * Mock return value for useApi hook (generic API operations)
 */
export interface MockUseApiReturn<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
  execute: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Creates a mock useApi return value with type-safe defaults
 */
export const createMockUseApiReturn = <T = unknown>(
  overrides?: Partial<MockUseApiReturn<T>>
): MockUseApiReturn<T> => ({
  data: null,
  isLoading: false,
  error: null,
  execute: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
  retry: vi.fn().mockResolvedValue(undefined),
  isRetryable: false,
  ...overrides,
});

// ============================================================================
// Mock Data Builders
// ============================================================================

/**
 * Creates a mock chat message with sensible defaults
 */
export const createMockMessage = (
  overrides?: Partial<ChatMessage>
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content: 'Test message content',
  role: 'user',
  timestamp: new Date(),
  conversation_id: 'conv-test-123',
  sources: undefined,
  ...overrides,
});

/**
 * Creates a mock product with sensible defaults
 */
export const createMockProduct = (
  overrides?: Partial<ProductSummary>
): ProductSummary => ({
  id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Product',
  short_name: 'TEST',
  family: 'Test Family',
  cas_number: '12345-67-8',
  applications: ['Testing', 'Development'],
  key_properties: ['Property 1', 'Property 2'],
  document_count: 1,
  ...overrides,
});

/**
 * Creates a mock conversation with sensible defaults
 */
export const createMockConversation = (
  overrides?: Partial<Conversation>
): Conversation => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Conversation',
  messages: [],
  created_at: new Date(),
  updated_at: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Creates a mock API error with sensible defaults
 * Note: This creates a plain object that matches the ApiError interface
 */
export const createMockApiError = (
  message: string = 'Test error message',
  status: number = 500,
  details?: unknown,
  requestId?: string
): ApiError => {
  return {
    message,
    status,
    details,
    requestId,
    name: 'ApiError',
    isNetworkError: () => status === 0,
    isServerError: () => status >= 500,
    isClientError: () => status >= 400 && status < 500,
    isRetryable: () => status === 0 || status >= 500 || status === 408,
  };
};

/**
 * Creates a mock source/search result with sensible defaults
 */
export const createMockSource = (
  overrides?: Partial<RetrievalResult>
): RetrievalResult => ({
  content: 'Test source content',
  score: 0.95,
  source: 'vector',
  metadata: {
    doc_id: 'test-doc-123',
    page: 1,
  },
  provenance: {
    document: 'Test Document.pdf',
    page: 1,
  },
  ...overrides,
});

/**
 * Creates a mock search facets object with sensible defaults
 */
export const createMockSearchFacets = (
  overrides?: Partial<SearchFacets>
): SearchFacets => ({
  families: [
    { value: 'ASA', count: 10 },
    { value: 'DCA', count: 5 },
  ],
  applications: [
    { value: 'Coatings', count: 15 },
    { value: 'Adhesives', count: 8 },
  ],
  manufacturers: [{ value: 'Dixie Chemical', count: 20 }],
  properties: [],
  ...overrides,
});

// ============================================================================
// Batch Data Builders
// ============================================================================

/**
 * Creates multiple mock messages at once
 */
export const createMockMessages = (
  count: number,
  baseOverrides?: Partial<ChatMessage>
): ChatMessage[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockMessage({
      ...baseOverrides,
      id: `msg-${index + 1}`,
      content: `Message ${index + 1}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
    })
  );
};

/**
 * Creates multiple mock products at once
 */
export const createMockProducts = (
  count: number,
  baseOverrides?: Partial<ProductSummary>
): ProductSummary[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockProduct({
      ...baseOverrides,
      id: `prod-${index + 1}`,
      name: `Product ${index + 1}`,
      short_name: `PROD${index + 1}`,
    })
  );
};

/**
 * Creates multiple mock conversations at once
 */
export const createMockConversations = (
  count: number,
  baseOverrides?: Partial<Conversation>
): Conversation[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockConversation({
      ...baseOverrides,
      id: `conv-${index + 1}`,
      title: `Conversation ${index + 1}`,
    })
  );
};
