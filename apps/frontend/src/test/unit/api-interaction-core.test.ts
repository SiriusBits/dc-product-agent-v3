/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '@/lib/api-client';

// Test the core API interaction functionality
describe('API Interaction Core Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API Error Classification', () => {
    it('properly classifies network errors', () => {
      const networkError = ApiError.fromNetworkError(
        new Error('Connection failed')
      );

      expect(networkError.isNetworkError()).toBe(true);
      expect(networkError.isRetryable()).toBe(true);
      expect(networkError.status).toBe(0);
      expect(networkError.message).toContain('Network error');
    });

    it('properly classifies timeout errors', () => {
      const timeoutError = ApiError.fromTimeout();

      expect(timeoutError.status).toBe(408);
      expect(timeoutError.isRetryable()).toBe(true);
      expect(timeoutError.message).toContain('timeout');
    });

    it('properly classifies server errors as retryable', () => {
      const serverErrors = [500, 502, 503, 504];

      serverErrors.forEach((status) => {
        const error = new ApiError(`Server error ${status}`, status);
        expect(error.isServerError()).toBe(true);
        expect(error.isRetryable()).toBe(true);
      });
    });

    it('properly classifies client errors as non-retryable', () => {
      const clientErrors = [400, 401, 403, 404, 409, 422];

      clientErrors.forEach((status) => {
        const error = new ApiError(`Client error ${status}`, status);
        expect(error.isClientError()).toBe(true);
        expect(error.isRetryable()).toBe(false);
      });
    });

    it('handles special case of 408 timeout as retryable', () => {
      const timeoutError = new ApiError('Request timeout', 408);

      expect(timeoutError.isClientError()).toBe(true);
      expect(timeoutError.isRetryable()).toBe(true); // Special case
    });
  });

  describe('API Error Creation', () => {
    it('creates error from response with error data', () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
      } as Response;

      const errorData = {
        message: 'Validation failed',
        details: { field: 'required' },
        request_id: 'req-123',
      };

      const error = ApiError.fromResponse(mockResponse, errorData);

      expect(error.message).toBe('Validation failed');
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ field: 'required' });
      expect(error.requestId).toBe('req-123');
    });

    it('creates error from response without error data', () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
      } as Response;

      const error = ApiError.fromResponse(mockResponse);

      expect(error.message).toBe('HTTP 404: Not Found');
      expect(error.status).toBe(404);
      expect(error.details).toBeUndefined();
      expect(error.requestId).toBeUndefined();
    });

    it('creates network error with proper details', () => {
      const originalError = new Error('Connection refused');
      const networkError = ApiError.fromNetworkError(originalError);

      expect(networkError.message).toContain('Network error');
      expect(networkError.status).toBe(0);
      expect(networkError.details).toEqual({
        originalError: 'Connection refused',
      });
    });

    it('creates timeout error with proper message', () => {
      const timeoutError = ApiError.fromTimeout();

      expect(timeoutError.message).toContain('Request timeout');
      expect(timeoutError.status).toBe(408);
    });
  });

  describe('API Error Methods', () => {
    it('correctly identifies error types', () => {
      const networkError = new ApiError('Network error', 0);
      const clientError = new ApiError('Bad request', 400);
      const serverError = new ApiError('Server error', 500);

      expect(networkError.isNetworkError()).toBe(true);
      expect(networkError.isClientError()).toBe(false);
      expect(networkError.isServerError()).toBe(false);

      expect(clientError.isNetworkError()).toBe(false);
      expect(clientError.isClientError()).toBe(true);
      expect(clientError.isServerError()).toBe(false);

      expect(serverError.isNetworkError()).toBe(false);
      expect(serverError.isClientError()).toBe(false);
      expect(serverError.isServerError()).toBe(true);
    });

    it('correctly determines retryability', () => {
      const retryableErrors = [
        new ApiError('Network error', 0),
        new ApiError('Server error', 500),
        new ApiError('Bad gateway', 502),
        new ApiError('Service unavailable', 503),
        new ApiError('Gateway timeout', 504),
        new ApiError('Request timeout', 408),
      ];

      const nonRetryableErrors = [
        new ApiError('Bad request', 400),
        new ApiError('Unauthorized', 401),
        new ApiError('Forbidden', 403),
        new ApiError('Not found', 404),
        new ApiError('Method not allowed', 405),
        new ApiError('Conflict', 409),
        new ApiError('Unprocessable entity', 422),
      ];

      retryableErrors.forEach((error) => {
        expect(error.isRetryable()).toBe(true);
      });

      nonRetryableErrors.forEach((error) => {
        expect(error.isRetryable()).toBe(false);
      });
    });
  });

  describe('API Error Inheritance', () => {
    it('extends Error class properly', () => {
      const apiError = new ApiError('Test error', 500);

      expect(apiError).toBeInstanceOf(Error);
      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.name).toBe('ApiError');
      expect(apiError.message).toBe('Test error');
      expect(apiError.status).toBe(500);
    });

    it('maintains stack trace', () => {
      const apiError = new ApiError('Test error', 500);

      expect(apiError.stack).toBeDefined();
      expect(typeof apiError.stack).toBe('string');
    });
  });

  describe('Mock API Client Structure', () => {
    it('should have proper mock structure for testing', () => {
      // This test verifies that our mock structure is correct
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

      // Verify all methods are mock functions
      Object.values(mockApiClient).forEach((method) => {
        expect(vi.isMockFunction(method)).toBe(true);
      });

      // Test that we can configure mock responses
      mockApiClient.sendMessage.mockResolvedValue({
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

      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(0);

      // Call the mock
      const result = mockApiClient.sendMessage({
        query: 'test',
        conversation_id: undefined,
        max_results: 10,
        include_sources: true,
      });

      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
        query: 'test',
        conversation_id: undefined,
        max_results: 10,
        include_sources: true,
      });

      // Verify the mock returns the expected value
      expect(result).resolves.toEqual({
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

    it('should handle mock errors correctly', () => {
      const mockApiClient = {
        sendMessage: vi.fn(),
      };

      const testError = new ApiError('Mock error', 500);
      mockApiClient.sendMessage.mockRejectedValue(testError);

      const result = mockApiClient.sendMessage({ query: 'test' });

      expect(result).rejects.toEqual(testError);
      expect(mockApiClient.sendMessage).toHaveBeenCalledWith({ query: 'test' });
    });
  });

  describe('Loading State Patterns', () => {
    it('should provide patterns for testing loading states', () => {
      // Pattern for testing loading state transitions
      let resolveApiCall: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApiCall = resolve;
      });

      const mockApiClient = {
        sendMessage: vi.fn().mockReturnValue(apiPromise),
      };

      // Start the API call
      const resultPromise = mockApiClient.sendMessage({ query: 'test' });

      // At this point, loading should be true in real implementation
      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);

      // Resolve the API call
      resolveApiCall!({ answer: 'response' });

      // Verify the promise resolves
      expect(resultPromise).resolves.toEqual({ answer: 'response' });
    });

    it('should provide patterns for testing concurrent requests', () => {
      const mockApiClient = {
        sendMessage: vi.fn(),
      };

      let firstResolve: (value: any) => void;
      let secondResolve: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        firstResolve = resolve;
      });

      const secondPromise = new Promise((resolve) => {
        secondResolve = resolve;
      });

      mockApiClient.sendMessage
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      // Start two concurrent requests
      const firstResult = mockApiClient.sendMessage({ query: 'first' });
      const secondResult = mockApiClient.sendMessage({ query: 'second' });

      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(2);

      // Resolve in different order
      secondResolve!({ answer: 'second response' });
      firstResolve!({ answer: 'first response' });

      expect(firstResult).resolves.toEqual({ answer: 'first response' });
      expect(secondResult).resolves.toEqual({ answer: 'second response' });
    });
  });

  describe('Retry Logic Patterns', () => {
    it('should provide patterns for testing retry scenarios', () => {
      const mockApiClient = {
        sendMessage: vi.fn(),
      };

      const retryableError = new ApiError('Server error', 500);
      const successResponse = { answer: 'success after retry' };

      // First call fails, second succeeds
      mockApiClient.sendMessage
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(successResponse);

      // First attempt fails
      const firstAttempt = mockApiClient.sendMessage({ query: 'test' });
      expect(firstAttempt).rejects.toEqual(retryableError);

      // Retry succeeds
      const retryAttempt = mockApiClient.sendMessage({ query: 'test' });
      expect(retryAttempt).resolves.toEqual(successResponse);

      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle non-retryable errors', () => {
      const mockApiClient = {
        sendMessage: vi.fn(),
      };

      const nonRetryableError = new ApiError('Unauthorized', 401);
      mockApiClient.sendMessage.mockRejectedValue(nonRetryableError);

      const result = mockApiClient.sendMessage({ query: 'test' });

      expect(result).rejects.toEqual(nonRetryableError);
      expect(nonRetryableError.isRetryable()).toBe(false);
    });
  });
});
