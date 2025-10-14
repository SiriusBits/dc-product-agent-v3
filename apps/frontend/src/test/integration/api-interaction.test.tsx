/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';
import { useProducts } from '@/hooks/useProducts';
import { useConversations } from '@/hooks/useConversations';
import { apiClient, ApiError } from '@/lib/api-client';
import ChatInterface from '@/components/chat/ChatInterface';
import ProductBrowser from '@/components/products/ProductBrowser';
import { render } from '@/test/enhanced-test-utils';
import type {
  ChatResponse,
  ProductSearchResponse,
  Conversation,
} from '@repo/shared-types';

// Mock the API client with proper implementations
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

describe('API Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // Mock DOM APIs
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat API Interactions', () => {
    it('properly mocks API calls for message sending', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Test response',
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
      };

      vi.mocked(apiClient.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(apiClient.sendMessage).toHaveBeenCalledWith({
        query: 'Test query',
        conversation_id: undefined,
        max_results: 10,
        include_sources: true,
      });

      expect(result.current.messages).toHaveLength(2); // user + assistant
      expect(result.current.messages[0].content).toBe('Test query');
      expect(result.current.messages[1].content).toBe('Test response');
    });

    it('handles API errors correctly', async () => {
      const apiError = new ApiError('Network error', 0);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(apiError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(result.current.error).toEqual(apiError);
      expect(result.current.isRetryable).toBe(true);
      expect(result.current.messages).toHaveLength(0); // No messages on error
    });

    it('implements retry logic for failed requests', async () => {
      const apiError = new ApiError('Server error', 500);
      const mockResponse: ChatResponse = {
        answer: 'Retry success',
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
      };

      // First call fails, second succeeds
      vi.mocked(apiClient.sendMessage)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChat());

      // Initial failed request
      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(result.current.error).toEqual(apiError);
      expect(result.current.isRetryable).toBe(true);

      // Retry the request
      await act(async () => {
        await result.current.retryLastMessage();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Retry success');
    });

    it('manages loading states during API calls', async () => {
      let resolveApiCall: (value: ChatResponse) => void;
      const apiPromise = new Promise<ChatResponse>((resolve) => {
        resolveApiCall = resolve;
      });

      vi.mocked(apiClient.sendMessage).mockReturnValue(apiPromise);

      const { result } = renderHook(() => useChat());

      // Start API call
      act(() => {
        result.current.sendMessage('Test query');
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve API call
      act(() => {
        resolveApiCall!({
          answer: 'Test response',
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

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });

    it('prevents concurrent requests with same query', async () => {
      let resolveFirstCall: (value: ChatResponse) => void;
      const firstCallPromise = new Promise<ChatResponse>((resolve) => {
        resolveFirstCall = resolve;
      });

      vi.mocked(apiClient.sendMessage).mockReturnValueOnce(firstCallPromise);

      const { result } = renderHook(() => useChat());

      // Send same message twice rapidly
      act(() => {
        result.current.sendMessage('Test query');
        result.current.sendMessage('Test query'); // Should be ignored
      });

      // Only one API call should be made
      expect(apiClient.sendMessage).toHaveBeenCalledTimes(1);

      // Resolve the call
      act(() => {
        resolveFirstCall!({
          answer: 'Test response',
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
        await firstCallPromise;
      });

      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe('Product Search API Interactions', () => {
    it('properly mocks product search API calls', async () => {
      const mockResponse: ProductSearchResponse = {
        products: [
          {
            id: 'asa-150',
            name: 'ASA 150',
            short_name: 'ASA150',
            family: 'ASA',
            cas_number: '12345-67-8',
            applications: ['Coatings'],
            key_properties: ['Viscosity: 150 cP'],
            document_count: 1,
          },
        ],
        total_count: 1,
        facets: {
          families: [{ value: 'ASA', count: 1 }],
          applications: [{ value: 'Coatings', count: 1 }],
          manufacturers: [],
          properties: [],
        },
      };

      vi.mocked(apiClient.searchProducts).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useProducts());

      await act(async () => {
        await result.current.searchProducts({ query: 'ASA' });
      });

      expect(apiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        limit: 20,
        offset: 0,
      });

      expect(result.current.products).toHaveLength(1);
      expect(result.current.products[0].name).toBe('ASA 150');
      expect(result.current.totalCount).toBe(1);
    });

    it('handles product search errors', async () => {
      const apiError = new ApiError('Search failed', 500);
      vi.mocked(apiClient.searchProducts).mockRejectedValue(apiError);

      const { result } = renderHook(() => useProducts());

      await act(async () => {
        await result.current.searchProducts({ query: 'ASA' });
      });

      expect(result.current.error).toBe('Search failed');
      expect(result.current.isRetryable).toBe(true);
      expect(result.current.products).toHaveLength(0);
    });

    it('implements debouncing for search queries', async () => {
      vi.mocked(apiClient.searchProducts).mockResolvedValue({
        products: [],
        total_count: 0,
        facets: null,
      });

      const { result } = renderHook(() => useProducts());

      // Rapid search calls
      act(() => {
        result.current.searchProducts({ query: 'A' });
        result.current.searchProducts({ query: 'AS' });
        result.current.searchProducts({ query: 'ASA' });
      });

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Should only make one API call (the last one)
      expect(apiClient.searchProducts).toHaveBeenCalledTimes(1);
      expect(apiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        limit: 20,
        offset: 0,
      });
    });
  });

  describe('Conversation Management API Interactions', () => {
    it('properly mocks conversation loading', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          metadata: {},
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
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].title).toBe('Test Conversation');
    });

    it('handles conversation creation', async () => {
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
        await result.current.createConversation();
      });

      expect(apiClient.createConversation).toHaveBeenCalled();
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].id).toBe('conv-new');
    });

    it('handles conversation errors', async () => {
      const apiError = new ApiError('Failed to load conversations', 500);
      vi.mocked(apiClient.listConversations).mockRejectedValue(apiError);

      const { result } = renderHook(() => useConversations());

      await act(async () => {
        await result.current.loadConversations();
      });

      expect(result.current.error).toEqual(apiError);
      expect(result.current.isRetryable).toBe(true);
    });
  });

  describe('Error Display in UI Components', () => {
    it('displays API errors in ChatInterface', async () => {
      const apiError = new ApiError('Network connection failed', 0);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(apiError);
      vi.mocked(apiClient.listConversations).mockResolvedValue([]);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText('Network connection failed')
        ).toBeInTheDocument();
      });

      // Verify error styling
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveClass('border-destructive/50');
    });

    it('shows retry button for retryable errors', async () => {
      const apiError = new ApiError('Server error', 500);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(apiError);
      vi.mocked(apiClient.listConversations).mockResolvedValue([]);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Wait for error and retry button
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });
    });

    it('does not show retry button for non-retryable errors', async () => {
      const apiError = new ApiError('Unauthorized', 401);
      vi.mocked(apiError.isRetryable).mockReturnValue(false);
      vi.mocked(apiClient.sendMessage).mockRejectedValue(apiError);
      vi.mocked(apiClient.listConversations).mockResolvedValue([]);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      // Should not have retry button
      expect(
        screen.queryByRole('button', { name: /retry/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Loading State Management', () => {
    it('shows loading indicators during API calls', async () => {
      let resolveApiCall: (value: ChatResponse) => void;
      const apiPromise = new Promise<ChatResponse>((resolve) => {
        resolveApiCall = resolve;
      });

      vi.mocked(apiClient.sendMessage).mockReturnValue(apiPromise);
      vi.mocked(apiClient.listConversations).mockResolvedValue([]);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Should show loading state
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      // Resolve API call
      act(() => {
        resolveApiCall!({
          answer: 'Test response',
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

      // Loading should be complete
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });

    it('manages loading states in ProductBrowser', async () => {
      let resolveApiCall: (value: ProductSearchResponse) => void;
      const apiPromise = new Promise<ProductSearchResponse>((resolve) => {
        resolveApiCall = resolve;
      });

      vi.mocked(apiClient.searchProducts).mockReturnValue(apiPromise);
      vi.mocked(apiClient.getProductFamilies).mockResolvedValue(['ASA']);
      vi.mocked(apiClient.getProductApplications).mockResolvedValue([
        'Coatings',
      ]);

      render(<ProductBrowser />);

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await userEvent.type(searchInput, 'ASA');

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      });

      // Resolve API call
      act(() => {
        resolveApiCall!({
          products: [],
          total_count: 0,
          facets: null,
        });
      });

      await act(async () => {
        await apiPromise;
      });

      // Loading should be complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
    });
  });

  describe('Request Cancellation', () => {
    it('cancels previous requests when new ones are made', async () => {
      const abortController1 = new AbortController();
      const abortController2 = new AbortController();
      let currentController = abortController1;

      vi.mocked(apiClient.sendMessage).mockImplementation(async () => {
        const controller = currentController;
        return new Promise((resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Request aborted'));
          });

          setTimeout(() => {
            if (!controller.signal.aborted) {
              resolve({
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
            }
          }, 100);
        });
      });

      const { result } = renderHook(() => useChat());

      // Start first request
      act(() => {
        result.current.sendMessage('First message');
      });

      // Start second request (should cancel first)
      currentController = abortController2;
      act(() => {
        result.current.sendMessage('Second message');
      });

      // First controller should be aborted
      expect(abortController1.signal.aborted).toBe(true);

      // Wait for second request to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    });
  });

  describe('Network Error Handling', () => {
    it('handles network timeouts', async () => {
      const timeoutError = ApiError.fromTimeout();
      vi.mocked(apiClient.sendMessage).mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(result.current.error?.message).toContain('timeout');
      expect(result.current.isRetryable).toBe(true);
    });

    it('handles network connection errors', async () => {
      const networkError = ApiError.fromNetworkError(
        new Error('Connection failed')
      );
      vi.mocked(apiClient.sendMessage).mockRejectedValue(networkError);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(result.current.error?.message).toContain('Network error');
      expect(result.current.isRetryable).toBe(true);
    });
  });
});
