/**
 * Async Test Utilities
 *
 * Standardizes async operation handling in tests with proper waitFor usage,
 * findBy queries for async elements, and appropriate timeouts for slow operations.
 *
 * Requirements: 5.4
 */

import { waitFor, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { RenderResult } from '@testing-library/react';

// ============================================================================
// Async Operation Configuration
// ============================================================================

export interface AsyncTestConfig {
  // Default timeouts
  defaultTimeout: number;
  slowOperationTimeout: number;
  fastOperationTimeout: number;

  // Polling intervals
  defaultInterval: number;
  fastInterval: number;
  slowInterval: number;

  // Retry configuration
  maxRetries: number;
  retryDelay: number;

  // Performance monitoring
  enablePerformanceTracking: boolean;
  slowOperationThreshold: number;
}

export const DEFAULT_ASYNC_CONFIG: AsyncTestConfig = {
  defaultTimeout: 5000,
  slowOperationTimeout: 10000,
  fastOperationTimeout: 2000,

  defaultInterval: 50,
  fastInterval: 25,
  slowInterval: 100,

  maxRetries: 3,
  retryDelay: 100,

  enablePerformanceTracking: process.env.NODE_ENV !== 'test',
  slowOperationThreshold: 2000,
};

// ============================================================================
// Enhanced waitFor Utilities
// ============================================================================

/**
 * Enhanced waitFor with better error handling and performance tracking
 */
export async function enhancedWaitFor<T>(
  callback: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    onTimeout?: (lastError?: Error) => void;
    operationName?: string;
    enableRetries?: boolean;
  } = {}
): Promise<T> {
  const config = DEFAULT_ASYNC_CONFIG;
  const {
    timeout = config.defaultTimeout,
    interval = config.defaultInterval,
    onTimeout,
    operationName = 'async operation',
    enableRetries = true,
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | undefined;

  // Performance tracking
  const performanceTracker = config.enablePerformanceTracking
    ? createPerformanceTracker(operationName)
    : null;

  performanceTracker?.start();

  try {
    const result = await waitFor(
      async () => {
        attempts++;
        try {
          return await Promise.resolve(callback());
        } catch (error) {
          lastError = error as Error;

          // Add context to error for better debugging
          const contextualError = new Error(
            `${operationName} failed (attempt ${attempts}): ${lastError.message}`
          );
          contextualError.stack = lastError.stack;
          throw contextualError;
        }
      },
      {
        timeout,
        interval,
      }
    );

    performanceTracker?.end(true);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceTracker?.end(false);

    // Enhanced error with context
    const enhancedError = new Error(
      `${operationName} timed out after ${duration}ms (${attempts} attempts). ` +
        `Last error: ${lastError?.message || 'Unknown error'}`
    );
    enhancedError.stack = (error as Error).stack;

    if (onTimeout) {
      onTimeout(lastError);
    }

    // Retry logic for flaky operations
    if (enableRetries && attempts < config.maxRetries) {
      console.warn(
        `Retrying ${operationName} (attempt ${attempts + 1}/${config.maxRetries})`
      );
      await delay(config.retryDelay);

      return enhancedWaitFor(callback, {
        ...options,
        enableRetries: false, // Prevent infinite recursion
      });
    }

    throw enhancedError;
  }
}

/**
 * Wait for state updates with act wrapper
 */
export async function waitForStateUpdate<T>(
  callback: () => T | Promise<T>,
  options: {
    timeout?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
    operationName = 'state update',
  } = options;

  return act(async () => {
    return enhancedWaitFor(callback, {
      timeout,
      operationName,
      interval: DEFAULT_ASYNC_CONFIG.fastInterval,
    });
  });
}

/**
 * Wait for multiple async operations to complete
 */
export async function waitForMultipleOperations<T>(
  operations: Array<() => Promise<T>>,
  options: {
    timeout?: number;
    concurrent?: boolean;
    operationName?: string;
  } = {}
): Promise<T[]> {
  const {
    timeout = DEFAULT_ASYNC_CONFIG.slowOperationTimeout,
    concurrent = true,
    operationName = 'multiple operations',
  } = options;

  const startTime = Date.now();

  try {
    let results: T[];

    if (concurrent) {
      // Run operations concurrently
      const promises = operations.map((op, index) =>
        enhancedWaitFor(op, {
          timeout,
          operationName: `${operationName}[${index}]`,
        })
      );
      results = await Promise.all(promises);
    } else {
      // Run operations sequentially
      results = [];
      for (let i = 0; i < operations.length; i++) {
        const result = await enhancedWaitFor(operations[i], {
          timeout,
          operationName: `${operationName}[${i}]`,
        });
        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    if (
      DEFAULT_ASYNC_CONFIG.enablePerformanceTracking &&
      duration > DEFAULT_ASYNC_CONFIG.slowOperationThreshold
    ) {
      console.warn(`Slow ${operationName} completed in ${duration}ms`);
    }

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(
      `${operationName} failed after ${duration}ms: ${(error as Error).message}`
    );
  }
}

// ============================================================================
// Enhanced findBy Queries for Async Elements
// ============================================================================

/**
 * Enhanced findBy queries with better error handling
 */
export function createAsyncQueries(renderResult?: RenderResult) {
  const queries = renderResult || screen;

  return {
    /**
     * Find element by test ID with enhanced error handling
     */
    findByTestIdEnhanced: async (
      testId: string,
      options: {
        timeout?: number;
        errorContext?: string;
        onTimeout?: () => void;
      } = {}
    ) => {
      const {
        timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
        errorContext,
        onTimeout,
      } = options;

      try {
        return await queries.findByTestId(testId, {}, { timeout });
      } catch (error) {
        if (onTimeout) {
          onTimeout();
        }

        const contextMessage = errorContext
          ? ` in context: ${errorContext}`
          : '';
        const enhancedError = new Error(
          `findByTestId('${testId}') failed after ${timeout}ms${contextMessage}. ` +
            `Original error: ${(error as Error).message}`
        );
        enhancedError.stack = (error as Error).stack;
        throw enhancedError;
      }
    },

    /**
     * Find element by role with enhanced error handling
     */
    findByRoleEnhanced: async (
      role: string,
      options: {
        name?: string | RegExp;
        timeout?: number;
        errorContext?: string;
        onTimeout?: () => void;
      } = {}
    ) => {
      const {
        name,
        timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
        errorContext,
        onTimeout,
      } = options;

      try {
        return await queries.findByRole(role, { name }, { timeout });
      } catch (error) {
        if (onTimeout) {
          onTimeout();
        }

        const nameStr = name ? ` with name "${name}"` : '';
        const contextMessage = errorContext
          ? ` in context: ${errorContext}`
          : '';
        const enhancedError = new Error(
          `findByRole('${role}'${nameStr}) failed after ${timeout}ms${contextMessage}. ` +
            `Original error: ${(error as Error).message}`
        );
        enhancedError.stack = (error as Error).stack;
        throw enhancedError;
      }
    },

    /**
     * Find element by text with enhanced error handling
     */
    findByTextEnhanced: async (
      text: string | RegExp,
      options: {
        timeout?: number;
        errorContext?: string;
        onTimeout?: () => void;
      } = {}
    ) => {
      const {
        timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
        errorContext,
        onTimeout,
      } = options;

      try {
        return await queries.findByText(text, {}, { timeout });
      } catch (error) {
        if (onTimeout) {
          onTimeout();
        }

        const contextMessage = errorContext
          ? ` in context: ${errorContext}`
          : '';
        const enhancedError = new Error(
          `findByText('${text}') failed after ${timeout}ms${contextMessage}. ` +
            `Original error: ${(error as Error).message}`
        );
        enhancedError.stack = (error as Error).stack;
        throw enhancedError;
      }
    },

    /**
     * Wait for element to disappear
     */
    waitForElementToDisappear: async (
      element: HTMLElement,
      options: {
        timeout?: number;
        operationName?: string;
      } = {}
    ) => {
      const {
        timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
        operationName = 'element disappearance',
      } = options;

      return enhancedWaitFor(
        () => {
          if (document.contains(element)) {
            throw new Error('Element still exists in DOM');
          }
          return true;
        },
        {
          timeout,
          operationName,
          interval: DEFAULT_ASYNC_CONFIG.fastInterval,
        }
      );
    },

    /**
     * Wait for element to become visible
     */
    waitForElementToBeVisible: async (
      element: HTMLElement,
      options: {
        timeout?: number;
        operationName?: string;
      } = {}
    ) => {
      const {
        timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
        operationName = 'element visibility',
      } = options;

      return enhancedWaitFor(
        () => {
          if (
            !element.offsetParent &&
            element.offsetWidth === 0 &&
            element.offsetHeight === 0
          ) {
            throw new Error('Element is not visible');
          }
          return element;
        },
        {
          timeout,
          operationName,
          interval: DEFAULT_ASYNC_CONFIG.fastInterval,
        }
      );
    },
  };
}

// ============================================================================
// Async Operation Patterns
// ============================================================================

/**
 * Wait for loading state to complete
 */
export async function waitForLoadingToComplete(
  getLoadingState: () => boolean,
  options: {
    timeout?: number;
    operationName?: string;
  } = {}
): Promise<void> {
  const {
    timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
    operationName = 'loading completion',
  } = options;

  return enhancedWaitFor(
    () => {
      if (getLoadingState()) {
        throw new Error('Still loading');
      }
      return;
    },
    {
      timeout,
      operationName,
      interval: DEFAULT_ASYNC_CONFIG.fastInterval,
    }
  );
}

/**
 * Wait for error state to appear
 */
export async function waitForErrorState(
  getErrorState: () => Error | null | undefined,
  options: {
    timeout?: number;
    operationName?: string;
  } = {}
): Promise<Error> {
  const {
    timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
    operationName = 'error state',
  } = options;

  return enhancedWaitFor(
    () => {
      const error = getErrorState();
      if (!error) {
        throw new Error('No error state found');
      }
      return error;
    },
    {
      timeout,
      operationName,
      interval: DEFAULT_ASYNC_CONFIG.defaultInterval,
    }
  );
}

/**
 * Wait for data to be loaded
 */
export async function waitForDataToLoad<T>(
  getData: () => T[] | null | undefined,
  options: {
    timeout?: number;
    minItems?: number;
    operationName?: string;
  } = {}
): Promise<T[]> {
  const {
    timeout = DEFAULT_ASYNC_CONFIG.defaultTimeout,
    minItems = 1,
    operationName = 'data loading',
  } = options;

  return enhancedWaitFor(
    () => {
      const data = getData();
      if (!data || data.length < minItems) {
        throw new Error(
          `Expected at least ${minItems} items, got ${data?.length || 0}`
        );
      }
      return data;
    },
    {
      timeout,
      operationName,
      interval: DEFAULT_ASYNC_CONFIG.defaultInterval,
    }
  );
}

// ============================================================================
// Mock Async Operations
// ============================================================================

/**
 * Create controlled async mock that can be resolved/rejected manually
 */
export function createControlledAsyncMock<T>() {
  let resolvePromise: (value: T) => void;
  let rejectPromise: (error: Error) => void;
  let isResolved = false;
  let isRejected = false;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = (value: T) => {
      isResolved = true;
      resolve(value);
    };
    rejectPromise = (error: Error) => {
      isRejected = true;
      reject(error);
    };
  });

  const mockFn = vi.fn().mockReturnValue(promise);

  return {
    mockFn,
    promise,
    resolve: resolvePromise!,
    reject: rejectPromise!,
    isResolved: () => isResolved,
    isRejected: () => isRejected,
    isPending: () => !isResolved && !isRejected,
  };
}

/**
 * Create async mock with configurable delay
 */
export function createDelayedAsyncMock<T>(
  value: T,
  delayMs: number = DEFAULT_ASYNC_CONFIG.retryDelay
) {
  return vi.fn().mockImplementation(async () => {
    await delay(delayMs);
    return value;
  });
}

/**
 * Create flaky async mock that fails sometimes
 */
export function createFlakyAsyncMock<T>(
  value: T,
  failureRate: number = 0.3,
  error: Error = new Error('Flaky operation failed')
) {
  return vi.fn().mockImplementation(async () => {
    if (Math.random() < failureRate) {
      throw error;
    }
    return value;
  });
}

// ============================================================================
// Timeout Management
// ============================================================================

/**
 * Create timeout for slow operations
 */
export function createSlowOperationTimeout(
  operationName: string,
  timeoutMs: number = DEFAULT_ASYNC_CONFIG.slowOperationTimeout
): {
  promise: Promise<never>;
  clear: () => void;
} {
  let timeoutId: NodeJS.Timeout;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return {
    promise,
    clear: () => clearTimeout(timeoutId),
  };
}

/**
 * Race operation against timeout
 */
export async function raceWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  const timeout = createSlowOperationTimeout(operationName, timeoutMs);

  try {
    return await Promise.race([operation, timeout.promise]);
  } finally {
    timeout.clear();
  }
}

// ============================================================================
// Performance Tracking
// ============================================================================

interface PerformanceTracker {
  start: () => void;
  end: (success: boolean) => void;
}

function createPerformanceTracker(operationName: string): PerformanceTracker {
  let startTime: number;

  return {
    start: () => {
      startTime = Date.now();
    },
    end: (success: boolean) => {
      const duration = Date.now() - startTime;
      const status = success ? 'SUCCESS' : 'FAILED';

      if (duration > DEFAULT_ASYNC_CONFIG.slowOperationThreshold) {
        console.warn(
          `[PERF] SLOW ${status}: ${operationName} took ${duration}ms`
        );
      } else {
        console.debug(`[PERF] ${status}: ${operationName} took ${duration}ms`);
      }
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_ASYNC_CONFIG.maxRetries,
    initialDelay = DEFAULT_ASYNC_CONFIG.retryDelay,
    backoffFactor = 2,
    operationName = 'retry operation',
  } = options;

  let lastError: Error;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      console.debug(
        `${operationName} failed (attempt ${attempt + 1}), retrying in ${currentDelay}ms`
      );
      await delay(currentDelay);
      currentDelay *= backoffFactor;
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError!.message}`
  );
}

/**
 * Batch async operations with concurrency control
 */
export async function batchAsyncOperations<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    operationName?: string;
  } = {}
): Promise<R[]> {
  const { concurrency = 3, operationName = 'batch operation' } = options;

  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = operation(items[i], i)
      .then((result) => {
        results[i] = result;
      })
      .catch((error) => {
        throw new Error(
          `${operationName} failed for item ${i}: ${(error as Error).message}`
        );
      });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// Exports
// ============================================================================

// Create default instance for convenience
export const asyncQueries = createAsyncQueries();
