/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApi } from '@/hooks/useApi';
import { ApiError } from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => {
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
    ApiError: MockApiError,
  };
});

describe('API Error Handling Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classification', () => {
    it('correctly identifies network errors', () => {
      const networkError = ApiError.fromNetworkError(
        new Error('Connection failed')
      );

      expect(networkError.isNetworkError()).toBe(true);
      expect(networkError.isRetryable()).toBe(true);
      expect(networkError.status).toBe(0);
      expect(networkError.message).toContain('Network error');
    });

    it('correctly identifies timeout errors', () => {
      const timeoutError = ApiError.fromTimeout();

      expect(timeoutError.status).toBe(408);
      expect(timeoutError.isRetryable()).toBe(true);
      expect(timeoutError.message).toContain('timeout');
    });

    it('correctly identifies server errors', () => {
      const serverError = new ApiError('Internal server error', 500);

      expect(serverError.isServerError()).toBe(true);
      expect(serverError.isRetryable()).toBe(true);
      expect(serverError.status).toBe(500);
    });

    it('correctly identifies client errors', () => {
      const clientError = new ApiError('Bad request', 400);

      expect(clientError.isClientError()).toBe(true);
      expect(clientError.isRetryable()).toBe(false);
      expect(clientError.status).toBe(400);
    });

    it('correctly identifies retryable errors', () => {
      const retryableErrors = [
        new ApiError('Network error', 0),
        new ApiError('Server error', 500),
        new ApiError('Bad gateway', 502),
        new ApiError('Service unavailable', 503),
        new ApiError('Gateway timeout', 504),
        new ApiError('Request timeout', 408),
      ];

      retryableErrors.forEach((error) => {
        expect(error.isRetryable()).toBe(true);
      });
    });

    it('correctly identifies non-retryable errors', () => {
      const nonRetryableErrors = [
        new ApiError('Bad request', 400),
        new ApiError('Unauthorized', 401),
        new ApiError('Forbidden', 403),
        new ApiError('Not found', 404),
        new ApiError('Method not allowed', 405),
        new ApiError('Conflict', 409),
        new ApiError('Unprocessable entity', 422),
      ];

      nonRetryableErrors.forEach((error) => {
        expect(error.isRetryable()).toBe(false);
      });
    });
  });

  describe('useApi Hook Error Handling', () => {
    it('handles successful API calls', async () => {
      const mockApiFunction = vi.fn().mockResolvedValue('success');

      const { result } = renderHook(() => useApi(mockApiFunction));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.data).toBe('success');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('handles API errors', async () => {
      const apiError = new ApiError('Test error', 500);
      const mockApiFunction = vi.fn().mockRejectedValue(apiError);

      const { result } = renderHook(() => useApi(mockApiFunction));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(apiError);
      expect(result.current.loading).toBe(false);
      expect(result.current.isRetryable).toBe(true);
    });

    it('handles retry logic', async () => {
      const apiError = new ApiError('Temporary error', 503);
      const mockApiFunction = vi
        .fn()
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce('retry success');

      const { result } = renderHook(() => useApi(mockApiFunction));

      // Initial failed call
      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.error).toEqual(apiError);

      // Retry
      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.data).toBe('retry success');
      expect(result.current.error).toBeNull();
    });

    it('manages loading states correctly', async () => {
      let resolveApiCall: (value: string) => void;
      const apiPromise = new Promise<string>((resolve) => {
        resolveApiCall = resolve;
      });

      const mockApiFunction = vi.fn().mockReturnValue(apiPromise);

      const { result } = renderHook(() => useApi(mockApiFunction));

      // Start API call
      act(() => {
        result.current.execute('test');
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // Resolve API call
      act(() => {
        resolveApiCall!('success');
      });

      await act(async () => {
        await apiPromise;
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe('success');
    });

    it('calls onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const mockApiFunction = vi.fn().mockResolvedValue('success');

      const { result } = renderHook(() =>
        useApi(mockApiFunction, { onSuccess })
      );

      await act(async () => {
        await result.current.execute('test');
      });

      expect(onSuccess).toHaveBeenCalledWith('success');
    });

    it('calls onError callback', async () => {
      const onError = vi.fn();
      const apiError = new ApiError('Test error', 500);
      const mockApiFunction = vi.fn().mockRejectedValue(apiError);

      const { result } = renderHook(() => useApi(mockApiFunction, { onError }));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(onError).toHaveBeenCalledWith(apiError);
    });

    it('resets state correctly', async () => {
      const mockApiFunction = vi.fn().mockResolvedValue('success');

      const { result } = renderHook(() => useApi(mockApiFunction));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.data).toBe('success');

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Error Response Parsing', () => {
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
    });
  });

  describe('Error Propagation', () => {
    it('converts non-ApiError to ApiError', async () => {
      const genericError = new Error('Generic error');
      const mockApiFunction = vi.fn().mockRejectedValue(genericError);

      const { result } = renderHook(() => useApi(mockApiFunction));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.message).toBe('Generic error');
      expect(result.current.error?.status).toBe(0);
    });

    it('preserves ApiError instances', async () => {
      const apiError = new ApiError('API error', 500);
      const mockApiFunction = vi.fn().mockRejectedValue(apiError);

      const { result } = renderHook(() => useApi(mockApiFunction));

      await act(async () => {
        await result.current.execute('test');
      });

      expect(result.current.error).toBe(apiError);
    });
  });
});
