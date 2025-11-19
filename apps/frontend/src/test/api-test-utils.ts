/**
 * API Test Utilities
 *
 * Common utilities for setting up API mocks in tests.
 * Provides default configurations and helper functions.
 */

import { vi } from 'vitest';
import { mockDefaults } from './api-mock-factory';

/**
 * Setup default API mocks with happy path responses
 */
export function setupApiMocks() {
  const mocks = {
    // Chat operations
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    getConversationMessages: vi.fn(),

    // Product operations
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    getRelatedProducts: vi.fn(),
    compareProducts: vi.fn(),
    getProductFamilies: vi.fn(),
    getProductApplications: vi.fn(),
    getProductProperties: vi.fn(),
    getProductStatistics: vi.fn(),

    // Knowledge Graph operations
    queryKnowledgeGraph: vi.fn(),
    getEntityNeighbors: vi.fn(),

    // Health operations
    getSystemStatus: vi.fn(),
    checkHealth: vi.fn(),
  };

  // Set default implementations
  mocks.sendMessage.mockResolvedValue(mockDefaults.chatResponse());
  mocks.getConversation.mockResolvedValue(mockDefaults.conversation());
  mocks.createConversation.mockResolvedValue(mockDefaults.conversation());
  mocks.listConversations.mockResolvedValue([]);
  mocks.deleteConversation.mockResolvedValue(undefined);
  mocks.updateConversationTitle.mockResolvedValue(undefined);
  mocks.getConversationMessages.mockResolvedValue([]);

  mocks.searchProducts.mockResolvedValue(mockDefaults.productSearchResponse());
  mocks.getProduct.mockResolvedValue(mockDefaults.productDetail());
  mocks.getRelatedProducts.mockResolvedValue([]);
  mocks.compareProducts.mockResolvedValue({});
  mocks.getProductFamilies.mockResolvedValue([]);
  mocks.getProductApplications.mockResolvedValue([]);
  mocks.getProductProperties.mockResolvedValue([]);
  mocks.getProductStatistics.mockResolvedValue({});

  mocks.queryKnowledgeGraph.mockResolvedValue(mockDefaults.kgQueryResponse());
  mocks.getEntityNeighbors.mockResolvedValue(mockDefaults.kgQueryResponse());

  mocks.getSystemStatus.mockResolvedValue(mockDefaults.systemStatus());
  mocks.checkHealth.mockResolvedValue(true);

  return mocks;
}

/**
 * Reset all API mocks
 */
export function resetApiMocks(mocks: ReturnType<typeof setupApiMocks>) {
  Object.values(mocks).forEach((mock) => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}

/**
 * Setup API mock with delayed response
 */
export function mockWithDelay<T>(
  mockFn: ReturnType<typeof vi.fn>,
  response: T,
  delay: number = 100
) {
  mockFn.mockImplementation(
    () =>
      new Promise<T>((resolve) => setTimeout(() => resolve(response), delay))
  );
}

/**
 * Setup API mock with error
 */
export function mockWithError(
  mockFn: ReturnType<typeof vi.fn>,
  error: Error | string,
  delay: number = 0
) {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  if (delay > 0) {
    mockFn.mockImplementation(
      () =>
        new Promise((_, reject) => setTimeout(() => reject(errorObj), delay))
    );
  } else {
    mockFn.mockRejectedValue(errorObj);
  }
}

/**
 * Create a sequence of responses for multiple calls
 */
export function mockSequence<T>(
  mockFn: ReturnType<typeof vi.fn>,
  responses: T[]
) {
  responses.forEach((response) => {
    mockFn.mockResolvedValueOnce(response);
  });
}

/**
 * Mock API error with status code
 */
export class MockApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
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
    return this.isNetworkError() || this.isServerError() || this.status === 408;
  }
}

/**
 * Create common API error scenarios
 */
export const apiErrors = {
  network: () => new MockApiError('Network error', 0),
  timeout: () => new MockApiError('Request timeout', 408),
  notFound: () => new MockApiError('Not found', 404),
  unauthorized: () => new MockApiError('Unauthorized', 401),
  forbidden: () => new MockApiError('Forbidden', 403),
  badRequest: () => new MockApiError('Bad request', 400),
  serverError: () => new MockApiError('Internal server error', 500),
  serviceUnavailable: () => new MockApiError('Service unavailable', 503),
};

// ============================================================================
// Enhanced Test Utilities for API-Level Mocking
// ============================================================================

/**
 * Mock a loading response with a delay
 * Useful for testing loading states
 *
 * @param data - The data to return after the delay
 * @param delay - Delay in milliseconds (default: 100ms)
 * @returns Promise that resolves after the delay
 */
export function mockLoadingResponse<T>(
  data: T,
  delay: number = 100
): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

/**
 * Mock an error response
 * Useful for testing error handling
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @returns Promise that rejects with MockApiError
 */
export function mockErrorResponse(
  message: string,
  status: number = 500
): Promise<never> {
  return Promise.reject(new MockApiError(message, status));
}

/**
 * Mock a success response (immediate)
 * Useful for testing happy path scenarios
 *
 * @param data - The data to return
 * @returns Promise that resolves immediately
 */
export function mockSuccessResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}

/**
 * Wait for loading state to appear in the UI
 * Polls for loading indicators with a timeout
 *
 * @param timeout - Maximum time to wait in milliseconds (default: 1000ms)
 * @returns Promise that resolves when loading state is detected
 */
export async function waitForLoadingState(
  timeout: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check for common loading indicators
    const loadingElements = document.querySelectorAll(
      '[data-testid*="loading"], [aria-busy="true"], .loading, .spinner'
    );

    if (loadingElements.length > 0) {
      return;
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Loading state not detected within timeout');
}

/**
 * Wait for error state to appear in the UI
 * Polls for error indicators with a timeout
 *
 * @param timeout - Maximum time to wait in milliseconds (default: 1000ms)
 * @returns Promise that resolves when error state is detected
 */
export async function waitForErrorState(timeout: number = 1000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check for common error indicators
    const errorElements = document.querySelectorAll(
      '[data-testid*="error"], [role="alert"], .error, .error-message'
    );

    if (errorElements.length > 0) {
      return;
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Error state not detected within timeout');
}
