/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';
import { useProducts } from '@/hooks/useProducts';
import { useConversations } from '@/hooks/useConversations';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  ChatResponse,
  ProductSearchResponse,
  Conversation,
} from '@repo/shared-types';

// Comprehensive API client mocking
vi.mock('@/lib/api-client', () => {
  const mockApiClient = {
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    getConversationMessages: vi.fn(),
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    getRelatedProducts: vi.fn(),
    compareProducts: vi.fn(),
    getProductFamilies: vi.fn(),
    getProductApplications: vi.fn(),
    getProductProperties: vi.fn(),
    getProductStatistics: vi.fn(),
    queryKnowledgeGraph: vi.fn(),
    getEntityNeighbors: vi.fn(),
    getSystemStatus: vi.fn(),
    checkHealth: vi.fn(),
  };

  class MockApiError extends Error {
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
  }

  return {
    apiClient: mockApiClient,
    ApiError: MockApiError,
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('API Client Mocking Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat API Mocking', () => {
    it('properly mocks sendMessage API calls', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Mocked response',
        sources: [
          {
            content: 'Test source content',
            score: 0.95,
            source: 'vector',
            metadata: { doc_id: 'test-doc' },
            provenance: { document: 'Test Document' },
          },
        ],
        conversation_id: 'conv-123',
        query_analysis: {
          query_type: 'specification',
          entities: ['ASA 150'],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 150,
        kg_enhanced: true,
      };

      vi.mocked(apiClient.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('What is ASA 150?');
      });

      // Verify API was called with correct parameters
      expect(apiClient.sendMessage).toHaveBeenCalledWith({
        query: 'What is ASA 150?',
        conversation_id: undefined,
        max_results: 10,
        include_sources: true,
      });

      // Verify response was processed correctly
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Mocked response');
      expect(result.current.messages[1].sources).toHaveLength(1);
      expect(result.current.conversationId).toBe('conv-123');
    });

    it('mocks API errors correctly', async () => {
      const mockError = new ApiError('Mocked API error', 500);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(mockError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.isRetryable).toBe(true);
      expect(result.current.messages).toHaveLength(0);
    });

    it('mocks retry scenarios', async () => {
      const mockError = new ApiError('Temporary error', 503);
      const mockSuccess: ChatResponse = {
        answer: 'Retry successful',
        sources: [],
        conversation_id: 'conv-retry',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.8,
          suggested_strategy: {},
        },
        response_time_ms: 200,
        kg_enhanced: false,
      };

      // First call fails, retry succeeds
      vi.mocked(apiClient.sendMessage)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);

      const { result } = renderHook(() => useChat());

      // Initial failed call
      await act(async () => {
        await result.current.sendMessage('Test retry');
      });

      expect(result.current.error).toEqual(mockError);

      // Retry
      await act(async () => {
        await result.current.retryLastMessage();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Retry successful');
    });

    it('mocks concurrent request handling', async () => {
      let resolveFirst: (value: ChatResponse) => void;
      let resolveSecond: (value: ChatResponse) => void;

      const firstPromise = new Promise<ChatResponse>((resolve) => {
        resolveFirst = resolve;
      });

      const secondPromise = new Promise<ChatResponse>((resolve) => {
        resolveSecond = resolve;
      });

      vi.mocked(apiClient.sendMessage)
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result } = renderHook(() => useChat());

      // Start two requests
      act(() => {
        result.current.sendMessage('First message');
      });

      act(() => {
        result.current.sendMessage('Second message');
      });

      // Should only have one API call (second cancels first)
      expect(apiClient.sendMessage).toHaveBeenCalledTimes(1);

      // Resolve the call
      act(() => {
        resolveFirst({
          answer: 'First response',
          sources: [],
          conversation_id: 'conv-1',
          query_analysis: {
            query_type: 'specification',
            entities: [],
            intent_confidence: 0.9,
            suggested_strategy: {},
          },
          response_time_ms: 100,
          kg_enhanced: false,
        });
      });

      await act(async () => {
        await firstPromise;
      });

      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe('Product Search API Mocking', () => {
    it('properly mocks searchProducts API calls', async () => {
      const mockResponse: ProductSearchResponse = {
        products: [
          {
            id: 'asa-150',
            name: 'ASA 150',
            short_name: 'ASA150',
            family: 'ASA',
            cas_number: '12345-67-8',
            applications: ['Coatings', 'Adhesives'],
            key_properties: ['Viscosity: 150 cP', 'Density: 1.05 g/cm³'],
            document_count: 2,
          },
          {
            id: 'asa-140',
            name: 'ASA 140',
            short_name: 'ASA140',
            family: 'ASA',
            cas_number: '12345-67-9',
            applications: ['Coatings'],
            key_properties: ['Viscosity: 140 cP'],
            document_count: 1,
          },
        ],
        total_count: 2,
        facets: {
          families: [{ value: 'ASA', count: 2 }],
          applications: [
            { value: 'Coatings', count: 2 },
            { value: 'Adhesives', count: 1 },
          ],
          manufacturers: [],
          properties: [],
        },
      };

      vi.mocked(apiClient.searchProducts).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useProducts());

      await act(async () => {
        await result.current.searchProducts({
          query: 'ASA',
          family: 'ASA',
          applications: ['Coatings'],
        });
      });

      expect(apiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        family: 'ASA',
        applications: ['Coatings'],
        limit: 20,
        offset: 0,
      });

      expect(result.current.products).toHaveLength(2);
      expect(result.current.totalCount).toBe(2);
      expect(result.current.facets?.families).toHaveLength(1);
    });

    it('mocks product search errors', async () => {
      const mockError = new ApiError('Search service unavailable', 503);
      vi.mocked(apiClient.searchProducts).mockRejectedValue(mockError);

      const { result } = renderHook(() => useProducts());

      await act(async () => {
        await result.current.searchProducts({ query: 'ASA' });
      });

      expect(result.current.error).toBe('Search service unavailable');
      expect(result.current.isRetryable).toBe(true);
      expect(result.current.products).toHaveLength(0);
    });

    it('mocks debounced search calls', async () => {
      vi.mocked(apiClient.searchProducts).mockResolvedValue({
        products: [],
        total_count: 0,
        facets: null,
      });

      const { result } = renderHook(() => useProducts());

      // Rapid successive calls
      act(() => {
        result.current.searchProducts({ query: 'A' });
        result.current.searchProducts({ query: 'AS' });
        result.current.searchProducts({ query: 'ASA' });
      });

      // Wait for debounce period
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Should only call API once with final query
      expect(apiClient.searchProducts).toHaveBeenCalledTimes(1);
      expect(apiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        limit: 20,
        offset: 0,
      });
    });

    it('mocks pagination calls', async () => {
      const firstPageResponse: ProductSearchResponse = {
        products: [
          {
            id: 'product-1',
            name: 'Product 1',
            short_name: 'P1',
            family: 'Family1',
            cas_number: '111-11-1',
            applications: ['App1'],
            key_properties: ['Prop1'],
            document_count: 1,
          },
        ],
        total_count: 2,
        facets: null,
      };

      const secondPageResponse: ProductSearchResponse = {
        products: [
          {
            id: 'product-2',
            name: 'Product 2',
            short_name: 'P2',
            family: 'Family1',
            cas_number: '222-22-2',
            applications: ['App2'],
            key_properties: ['Prop2'],
            document_count: 1,
          },
        ],
        total_count: 2,
        facets: null,
      };

      vi.mocked(apiClient.searchProducts)
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const { result } = renderHook(() => useProducts());

      // Load first page
      await act(async () => {
        await result.current.searchProducts({ query: 'test' });
      });

      expect(result.current.products).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);

      // Load more
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.products).toHaveLength(2);
      expect(result.current.hasMore).toBe(false);
      expect(apiClient.searchProducts).toHaveBeenCalledTimes(2);
    });
  });

  describe('Conversation Management API Mocking', () => {
    it('properly mocks conversation loading', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'ASA Questions',
          messages: [],
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
          metadata: { message_count: 4 },
        },
        {
          id: 'conv-2',
          title: 'DCA Comparison',
          messages: [],
          created_at: new Date('2024-01-03'),
          updated_at: new Date('2024-01-04'),
          metadata: { message_count: 2 },
        },
      ];

      vi.mocked(apiClient.listConversations).mockResolvedValue(
        mockConversations
      );

      const { result } = renderHook(() => useConversations());

      await act(async () => {
        await result.current.loadConversations();
      });

      expect(apiClient.listConversations).toHaveBeenCalledWith(20, 0);
      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0].title).toBe('ASA Questions');
    });

    it('mocks conversation creation', async () => {
      const newConversation: Conversation = {
        id: 'conv-new',
        title: 'New Conversation',
        messages: [],
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {},
      };

      vi.mocked(apiClient.createConversation).mockResolvedValue(
        newConversation
      );

      const { result } = renderHook(() => useConversations());

      await act(async () => {
        const created = await result.current.createConversation();
        expect(created).toEqual(newConversation);
      });

      expect(apiClient.createConversation).toHaveBeenCalled();
      expect(result.current.conversations).toHaveLength(1);
    });

    it('mocks conversation deletion', async () => {
      vi.mocked(apiClient.deleteConversation).mockResolvedValue(undefined);
      vi.mocked(apiClient.listConversations).mockResolvedValue([
        {
          id: 'conv-1',
          title: 'Conversation 1',
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          metadata: {},
        },
      ]);

      const { result } = renderHook(() => useConversations());

      // Load initial conversations
      await act(async () => {
        await result.current.loadConversations();
      });

      expect(result.current.conversations).toHaveLength(1);

      // Delete conversation
      await act(async () => {
        await result.current.deleteConversation('conv-1');
      });

      expect(apiClient.deleteConversation).toHaveBeenCalledWith('conv-1');
      expect(result.current.conversations).toHaveLength(0);
    });

    it('mocks conversation title updates', async () => {
      vi.mocked(apiClient.updateConversationTitle).mockResolvedValue(undefined);
      vi.mocked(apiClient.listConversations).mockResolvedValue([
        {
          id: 'conv-1',
          title: 'Old Title',
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          metadata: {},
        },
      ]);

      const { result } = renderHook(() => useConversations());

      // Load initial conversations
      await act(async () => {
        await result.current.loadConversations();
      });

      // Update title
      await act(async () => {
        await result.current.updateConversationTitle('conv-1', 'New Title');
      });

      expect(apiClient.updateConversationTitle).toHaveBeenCalledWith(
        'conv-1',
        'New Title'
      );
      expect(result.current.conversations[0].title).toBe('New Title');
    });

    it('mocks conversation errors', async () => {
      const mockError = new ApiError('Conversation service down', 503);
      vi.mocked(apiClient.listConversations).mockRejectedValue(mockError);

      const { result } = renderHook(() => useConversations());

      await act(async () => {
        await result.current.loadConversations();
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.isRetryable).toBe(true);
    });
  });

  describe('Error Type Mocking', () => {
    it('mocks network errors', async () => {
      const networkError = ApiError.fromNetworkError(
        new Error('Connection refused')
      );
      vi.mocked(apiClient.sendMessage).mockRejectedValue(networkError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.error?.isNetworkError()).toBe(true);
      expect(result.current.error?.isRetryable()).toBe(true);
    });

    it('mocks timeout errors', async () => {
      const timeoutError = ApiError.fromTimeout();
      vi.mocked(apiClient.sendMessage).mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.error?.status).toBe(408);
      expect(result.current.error?.isRetryable()).toBe(true);
    });

    it('mocks client errors', async () => {
      const clientError = new ApiError('Bad request', 400);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(clientError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.error?.isClientError()).toBe(true);
      expect(result.current.error?.isRetryable()).toBe(false);
    });

    it('mocks server errors', async () => {
      const serverError = new ApiError('Internal server error', 500);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(serverError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.error?.isServerError()).toBe(true);
      expect(result.current.error?.isRetryable()).toBe(true);
    });
  });

  describe('Loading State Mocking', () => {
    it('properly mocks loading state transitions', async () => {
      let resolveApiCall: (value: ChatResponse) => void;
      const apiPromise = new Promise<ChatResponse>((resolve) => {
        resolveApiCall = resolve;
      });

      vi.mocked(apiClient.sendMessage).mockReturnValue(apiPromise);

      const { result } = renderHook(() => useChat());

      // Start loading
      act(() => {
        result.current.sendMessage('Test');
      });

      expect(result.current.isLoading).toBe(true);

      // Complete loading
      act(() => {
        resolveApiCall!({
          answer: 'Response',
          sources: [],
          conversation_id: 'conv-123',
          query_analysis: {
            query_type: 'specification',
            entities: [],
            intent_confidence: 0.9,
            suggested_strategy: {},
          },
          response_time_ms: 100,
          kg_enhanced: false,
        });
      });

      await act(async () => {
        await apiPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
