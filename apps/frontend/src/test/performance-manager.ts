/**
 * Test Performance Manager
 * Optimizes test execution time and reliability
 */

import { vi } from 'vitest';

export interface PerformanceConfig {
  // Timeout configurations (in milliseconds)
  defaultTimeout: number;
  fastTimeout: number;
  slowTimeout: number;

  // Delay configurations for mocks
  fastDelay: number;
  normalDelay: number;
  slowDelay: number;

  // Retry configurations
  maxRetries: number;
  retryDelay: number;

  // Performance monitoring
  enablePerfMonitoring: boolean;
  warnThreshold: number;
}

export const DEFAULT_PERF_CONFIG: PerformanceConfig = {
  // Optimized timeouts - shorter for better performance
  defaultTimeout: 5000, // 5 seconds (reduced from typical 10s)
  fastTimeout: 2000, // 2 seconds for fast operations
  slowTimeout: 10000, // 10 seconds for complex operations

  // Optimized delays - minimal but realistic
  fastDelay: 10, // 10ms for immediate operations
  normalDelay: 50, // 50ms for typical async operations
  slowDelay: 100, // 100ms for complex operations

  // Retry configuration
  maxRetries: 2,
  retryDelay: 100,

  // Performance monitoring
  enablePerfMonitoring: true,
  warnThreshold: 3000, // Warn if operations take > 3 seconds
};

export class TestPerformanceManager {
  private config: PerformanceConfig;
  private timers: Map<string, number> = new Map();
  private operationCounts: Map<string, number> = new Map();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERF_CONFIG, ...config };
  }

  /**
   * Start timing an operation
   */
  startTimer(operationName: string): void {
    if (this.config.enablePerfMonitoring) {
      this.timers.set(operationName, Date.now());
      this.operationCounts.set(
        operationName,
        (this.operationCounts.get(operationName) || 0) + 1
      );
    }
  }

  /**
   * End timing an operation and optionally warn if slow
   */
  endTimer(operationName: string, warnIfSlow = true): number {
    if (!this.config.enablePerfMonitoring) return 0;

    const startTime = this.timers.get(operationName);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.timers.delete(operationName);

    if (warnIfSlow && duration > this.config.warnThreshold) {
      console.warn(
        `⚠️  Slow test operation: ${operationName} took ${duration}ms (threshold: ${this.config.warnThreshold}ms)`
      );
    }

    return duration;
  }

  /**
   * Create an optimized delay based on operation type
   */
  createDelay(type: 'fast' | 'normal' | 'slow' = 'normal'): Promise<void> {
    const delays = {
      fast: this.config.fastDelay,
      normal: this.config.normalDelay,
      slow: this.config.slowDelay,
    };

    return new Promise((resolve) => setTimeout(resolve, delays[type]));
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  createTimeout(ms?: number, operation = 'operation'): Promise<never> {
    const timeout = ms || this.config.defaultTimeout;
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: ${operation} exceeded ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Race an operation against a timeout
   */
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number,
    operationName = 'operation'
  ): Promise<T> {
    const timeout = timeoutMs || this.config.defaultTimeout;

    return Promise.race([promise, this.createTimeout(timeout, operationName)]);
  }

  /**
   * Retry an operation with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName = 'operation',
    maxRetries = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.startTimer(`${operationName}-attempt-${attempt + 1}`);
        const result = await operation();
        this.endTimer(`${operationName}-attempt-${attempt + 1}`, false);
        return result;
      } catch (error) {
        this.endTimer(`${operationName}-attempt-${attempt + 1}`, false);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Operation ${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`
    );
  }

  /**
   * Optimized waitFor implementation with better performance
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number;
      interval?: number;
      operationName?: string;
    } = {}
  ): Promise<void> {
    const {
      timeout = this.config.fastTimeout,
      interval = 50,
      operationName = 'waitFor condition',
    } = options;

    this.startTimer(operationName);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) {
          this.endTimer(operationName, false);
          return;
        }
      } catch (error) {
        // Condition threw an error, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    this.endTimer(operationName);
    throw new Error(`waitFor timeout: ${operationName} after ${timeout}ms`);
  }

  /**
   * Batch multiple operations for better performance
   */
  async batchOperations<T>(
    operations: Array<() => Promise<T>>,
    options: {
      concurrency?: number;
      timeout?: number;
      operationName?: string;
    } = {}
  ): Promise<T[]> {
    const {
      concurrency = 3,
      timeout = this.config.defaultTimeout,
      operationName = 'batch operations',
    } = options;

    this.startTimer(operationName);

    try {
      const results: T[] = [];

      // Process operations in batches to control concurrency
      for (let i = 0; i < operations.length; i += concurrency) {
        const batch = operations.slice(i, i + concurrency);
        const batchPromises = batch.map((op) =>
          this.withTimeout(op(), timeout)
        );
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      this.endTimer(operationName, false);
      return results;
    } catch (error) {
      this.endTimer(operationName);
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    operationCounts: Record<string, number>;
    activeTimers: string[];
  } {
    return {
      operationCounts: Object.fromEntries(this.operationCounts),
      activeTimers: Array.from(this.timers.keys()),
    };
  }

  /**
   * Reset all performance tracking
   */
  reset(): void {
    this.timers.clear();
    this.operationCounts.clear();
  }

  /**
   * Create optimized mock functions with automatic cleanup
   */
  createOptimizedMock<T extends (...args: any[]) => any>(
    implementation?: T,
    options: {
      delay?: number;
      shouldFail?: boolean;
      failureRate?: number;
    } = {}
  ): ReturnType<typeof vi.fn> & { cleanup: () => void } {
    const {
      delay = this.config.fastDelay,
      shouldFail = false,
      failureRate = 0,
    } = options;

    const mockFn = vi
      .fn()
      .mockImplementation(async (...args: Parameters<T>) => {
        // Add realistic delay
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Simulate occasional failures if configured
        if (shouldFail || (failureRate > 0 && Math.random() < failureRate)) {
          throw new Error('Simulated failure');
        }

        // Call original implementation if provided
        if (implementation) {
          return implementation(...args);
        }

        return undefined;
      });

    // Add cleanup method
    const cleanup = () => {
      mockFn.mockClear();
      mockFn.mockReset();
    };

    return Object.assign(mockFn, { cleanup });
  }
}

// Global performance manager instance
export const testPerformanceManager = new TestPerformanceManager();

// Helper functions for common use cases
export const withPerformanceTracking = <T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> => {
  testPerformanceManager.startTimer(operationName);
  return operation().finally(() => {
    testPerformanceManager.endTimer(operationName);
  });
};

export const createFastDelay = () => testPerformanceManager.createDelay('fast');
export const createNormalDelay = () =>
  testPerformanceManager.createDelay('normal');
export const createSlowDelay = () => testPerformanceManager.createDelay('slow');

// Optimized waitFor for tests
export const fastWaitFor = (
  condition: () => boolean | Promise<boolean>,
  timeout = 2000
) =>
  testPerformanceManager.waitFor(condition, {
    timeout,
    operationName: 'fastWaitFor',
  });

// Performance-aware test utilities
export const performanceTestUtils = {
  measureTestDuration: (testName: string) => {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        if (duration > 5000) {
          console.warn(`⚠️  Slow test: ${testName} took ${duration}ms`);
        }
        return duration;
      },
    };
  },

  expectFastOperation: async <T>(
    operation: () => Promise<T>,
    maxDuration = 1000,
    operationName = 'operation'
  ): Promise<T> => {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    if (duration > maxDuration) {
      throw new Error(
        `Operation ${operationName} took ${duration}ms, expected < ${maxDuration}ms`
      );
    }

    return result;
  },
};
