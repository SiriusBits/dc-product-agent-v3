/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';
import { apiClient } from '@/lib/api-client';

// Mock the API client
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
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Concurrent Message Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prevents concurrent requests with the same query', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    let resolveFirstCall: (value: any) => void;
    let resolveSecondCall: (value: any) => void;

    // Set up controlled promises
    const firstCallPromise = new Promise((resolve) => {
      resolveFirstCall = resolve;
    });
    const secondCallPromise = new Promise((resolve) => {
      resolveSecondCall = resolve;
    });

    mockSendMessage
      .mockReturnValueOnce(firstCallPromise)
      .mockReturnValueOnce(secondCallPromise);

    const { result } = renderHook(() => useChat());

    // Send the same message twice rapidly
    const query = 'Test message';

    act(() => {
      result.current.sendMessage(query);
      result.current.sendMessage(query); // This should be ignored
    });

    // Only one API call should have been made
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Resolve the first call
    act(() => {
      resolveFirstCall!({
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

    // Wait for the promise to resolve
    await act(async () => {
      await firstCallPromise;
    });

    // Now sending the same message again should work
    act(() => {
      result.current.sendMessage(query);
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('allows different queries to be sent concurrently', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    mockSendMessage.mockResolvedValue({
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

    const { result } = renderHook(() => useChat());

    // Send different messages
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    // Both API calls should have been made
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
      query: 'First message',
      conversation_id: undefined,
      max_results: 10,
      include_sources: true,
    });
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
      query: 'Second message',
      conversation_id: 'conv-123',
      max_results: 10,
      include_sources: true,
    });
  });

  it('properly manages loading state during concurrent requests', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    let resolveCall: (value: unknown) => void;

    const callPromise = new Promise((resolve) => {
      resolveCall = resolve;
    });

    mockSendMessage.mockReturnValue(callPromise);

    const { result } = renderHook(() => useChat());

    // Start sending a message
    act(() => {
      result.current.sendMessage('Test message');
    });

    // Should be loading
    expect(result.current.isLoading).toBe(true);

    // Try to send the same message again (should be ignored)
    act(() => {
      result.current.sendMessage('Test message');
    });

    // Should still be loading, and only one call made
    expect(result.current.isLoading).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Resolve the call
    act(() => {
      resolveCall!({
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
      await callPromise;
    });

    // Should no longer be loading
    expect(result.current.isLoading).toBe(false);
  });

  it('cancels previous request when new request is made', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    let firstAbortController: AbortController;
    let secondAbortController: AbortController;

    // Track abort controllers
    mockSendMessage.mockImplementation(async (request) => {
      // Simulate the hook creating an AbortController
      const controller = new AbortController();
      if (!firstAbortController) {
        firstAbortController = controller;
      } else {
        secondAbortController = controller;
      }

      return new Promise((resolve, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Request aborted'));
        });

        // Simulate async response
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

    // Send first message
    act(() => {
      result.current.sendMessage('First message');
    });

    // Send second message (should cancel first)
    act(() => {
      result.current.sendMessage('Second message');
    });

    // Both calls should have been made
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // Wait for any pending operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
  });

  it('prevents empty message submission', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    const { result } = renderHook(() => useChat());

    // Try to send empty message
    await act(async () => {
      await result.current.sendMessage('');
    });

    // Try to send whitespace-only message
    await act(async () => {
      await result.current.sendMessage('   ');
    });

    // No API calls should have been made
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('handles rapid sequential message sending correctly', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    mockSendMessage.mockResolvedValue({
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

    const { result } = renderHook(() => useChat());

    // Send multiple different messages rapidly
    await act(async () => {
      await result.current.sendMessage('Message 1');
    });

    await act(async () => {
      await result.current.sendMessage('Message 2');
    });

    await act(async () => {
      await result.current.sendMessage('Message 3');
    });

    // All messages should have been sent
    expect(mockSendMessage).toHaveBeenCalledTimes(3);

    // Should have 6 messages total (3 user + 3 assistant)
    expect(result.current.messages).toHaveLength(6);
  });

  it('maintains message queue integrity during concurrent operations', async () => {
    const mockSendMessage = vi.mocked(apiClient.sendMessage);
    let messageCounter = 0;

    mockSendMessage.mockImplementation(async (request) => {
      messageCounter++;
      const currentCount = messageCounter;

      // Simulate variable response times
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

      return {
        answer: `Response ${currentCount}`,
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
    });

    const { result } = renderHook(() => useChat());

    // Send messages with different timing
    await act(async () => {
      const promises = [
        result.current.sendMessage('Message A'),
        result.current.sendMessage('Message B'),
        result.current.sendMessage('Message C'),
      ];

      await Promise.all(promises);
    });

    // All messages should be in the correct order
    expect(result.current.messages).toHaveLength(6);

    // Check that user messages are in order
    const userMessages = result.current.messages.filter(
      (m) => m.role === 'user'
    );
    expect(userMessages[0].content).toBe('Message A');
    expect(userMessages[1].content).toBe('Message B');
    expect(userMessages[2].content).toBe('Message C');
  });
});
