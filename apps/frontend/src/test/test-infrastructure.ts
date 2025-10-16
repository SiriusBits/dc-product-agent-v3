/**
 * Test Infrastructure Reliability
 *
 * Implements consistent mock reset strategy, proper async operation handling,
 * standardized query methods, and debugging utilities for test failures.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { act } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import {
  type MockUseChatReturn,
  type MockUseProductsReturn,
  type MockUseConversationsReturn,
} from './standardized-mocks';
import { resetMocks, setupMocks } from './test-utils';

// ============================================================================
// Test Infrastructure Configuration
// ============================================================================

export interface TestInfrastructureConfig {
  // Mock reset strategy
  mockReset: {
    resetBetweenTests: boolean;
    resetBetweenSuites: boolean;
    preserveImplementations: boolean;
    clearCallHistory: boolean;
  };

  // Async operation handling
  asyncHandling: {
    defaultTimeout: number;
    defaultInterval: number;
    maxRetries: number;
    enableActWrapper: boolean;
  };

  // Query method standardization
  queryMethods: {
    defaultTimeout: number;
    enableStrictMode: boolean;
    logFailedQueries: boolean;
    suggestAlternatives: boolean;
  };

  // Debugging utilities
  debugging: {
    enableStateLogging: boolean;
    enableMockInspection: boolean;
    enableTimingDebug: boolean;
    enableErrorEnhancement: boolean;
    logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  };

  // Performance monitoring
  performance: {
    enableMonitoring: boolean;
    warnThreshold: number;
    errorThreshold: number;
    trackMemoryUsage: boolean;
  };
}

export const DEFAULT_TEST_CONFIG: TestInfrastructureConfig = {
  mockReset: {
    resetBetweenTests: true,
    resetBetweenSuites: true,
    preserveImplementations: false,
    clearCallHistory: true,
  },
  asyncHandling: {
    defaultTimeout: 5000,
    defaultInterval: 50,
    maxRetries: 3,
    enableActWrapper: true,
  },
  queryMethods: {
    defaultTimeout: 3000,
    enableStrictMode: true,
    logFailedQueries: true,
    suggestAlternatives: true,
  },
  debugging: {
    enableStateLogging: process.env.NODE_ENV !== 'test',
    enableMockInspection: process.env.NODE_ENV !== 'test',
    enableTimingDebug: process.env.NODE_ENV !== 'test',
    enableErrorEnhancement: true,
    logLevel: process.env.NODE_ENV === 'test' ? 'error' : 'info',
  },
  performance: {
    enableMonitoring: process.env.NODE_ENV !== 'test',
    warnThreshold: 2000,
    errorThreshold: 5000,
    trackMemoryUsage: false,
  },
};

// ============================================================================
// Test Infrastructure State Management
// ============================================================================

class TestInfrastructureManager {
  private config: TestInfrastructureConfig;
  private testStartTime: number = 0;
  private currentTestName: string = '';
  private mockCallHistory: Map<string, any[]> = new Map();
  private componentStateHistory: any[] = [];
  private asyncOperations: Set<Promise<any>> = new Set();
  private timers: Set<NodeJS.Timeout> = new Set();
  private memoryBaseline: number = 0;

  constructor(config: TestInfrastructureConfig = DEFAULT_TEST_CONFIG) {
    this.config = config;
  }

  // ========================================================================
  // Mock Reset Strategy (Requirement 5.1, 5.3)
  // ========================================================================

  /**
   * Comprehensive mock reset for test isolation
   */
  resetAllMocks(): void {
    this.log('debug', 'Resetting all mocks for test isolation');

    // Clear Vitest mocks
    vi.clearAllMocks();

    if (this.config.mockReset.clearCallHistory) {
      vi.clearAllTimers();
      this.mockCallHistory.clear();
    }

    // Reset standardized mocks
    resetMocks();

    // Clear DOM
    cleanup();

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear async operations
    this.clearAsyncOperations();

    // Clear timers
    this.clearTimers();

    // Reset component state history
    this.componentStateHistory = [];

    this.log('debug', 'Mock reset completed');
  }

  /**
   * Setup mocks with proper isolation
   */
  setupTestMocks(
    options: {
      useChat?: Partial<MockUseChatReturn>;
      useProducts?: Partial<MockUseProductsReturn>;
      useConversations?: Partial<MockUseConversationsReturn>;
    } = {}
  ): void {
    this.log('debug', 'Setting up test mocks');

    // Use standardized mock setup
    const mocks = setupMocks(options);

    // Track mock calls if debugging enabled
    if (this.config.debugging.enableMockInspection) {
      this.trackMockCalls(mocks);
    }

    this.log('debug', 'Test mocks setup completed');
  }

  /**
   * Track mock function calls for debugging
   */
  private trackMockCalls(mocks: any): void {
    Object.entries(mocks).forEach(([hookName, mockFn]) => {
      if (typeof mockFn === 'function' && 'mockImplementation' in mockFn) {
        const originalImplementation = mockFn.getMockImplementation();

        mockFn.mockImplementation((...args: any[]) => {
          const callInfo = {
            hookName,
            args,
            timestamp: Date.now(),
            testName: this.currentTestName,
          };

          const history = this.mockCallHistory.get(hookName) || [];
          history.push(callInfo);
          this.mockCallHistory.set(hookName, history);

          return originalImplementation?.(...args);
        });
      }
    });
  }

  // ========================================================================
  // Async Operation Handling (Requirement 5.4)
  // ========================================================================

  /**
   * Enhanced waitFor with proper timeout and error handling
   */
  async waitFor<T>(
    callback: () => T | Promise<T>,
    options: {
      timeout?: number;
      interval?: number;
      onTimeout?: (lastError?: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      timeout = this.config.asyncHandling.defaultTimeout,
      interval = this.config.asyncHandling.defaultInterval,
      onTimeout,
    } = options;

    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    this.log('debug', `Starting waitFor with timeout ${timeout}ms`);

    while (Date.now() - startTime < timeout) {
      try {
        attempts++;

        let result: T;
        if (this.config.asyncHandling.enableActWrapper) {
          result = await act(async () => {
            return await Promise.resolve(callback());
          });
        } else {
          result = await Promise.resolve(callback());
        }

        this.log('debug', `waitFor succeeded after ${attempts} attempts`);
        return result;
      } catch (error) {
        lastError = error as Error;
        await this.delay(interval);
      }
    }

    // Timeout reached
    const duration = Date.now() - startTime;
    this.log(
      'error',
      `waitFor timed out after ${duration}ms (${attempts} attempts)`
    );

    if (onTimeout) {
      onTimeout(lastError);
    }

    throw new Error(
      `waitFor timed out after ${duration}ms. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Wait for element to appear asynchronously
   */
  async waitForElement(
    querySelector: () => HTMLElement | null,
    options: {
      timeout?: number;
      errorMessage?: string;
    } = {}
  ): Promise<HTMLElement> {
    const {
      timeout = this.config.queryMethods.defaultTimeout,
      errorMessage = 'Element not found',
    } = options;

    return this.waitFor(
      () => {
        const element = querySelector();
        if (!element) {
          throw new Error(errorMessage);
        }
        return element;
      },
      {
        timeout,
        onTimeout: () => {
          this.log('error', `Element query failed: ${errorMessage}`);
          if (this.config.debugging.enableStateLogging) {
            this.logComponentState('Element query timeout');
          }
        },
      }
    );
  }

  /**
   * Track async operations for cleanup
   */
  trackAsyncOperation<T>(promise: Promise<T>): Promise<T> {
    this.asyncOperations.add(promise);

    promise.finally(() => {
      this.asyncOperations.delete(promise);
    });

    return promise;
  }

  /**
   * Clear all tracked async operations
   */
  private clearAsyncOperations(): void {
    this.asyncOperations.clear();
  }

  /**
   * Wait for all async operations to complete
   */
  async waitForAsyncOperations(timeout: number = 5000): Promise<void> {
    if (this.asyncOperations.size === 0) {
      return;
    }

    this.log(
      'debug',
      `Waiting for ${this.asyncOperations.size} async operations`
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Timeout waiting for ${this.asyncOperations.size} async operations`
          )
        );
      }, timeout);
    });

    try {
      await Promise.race([
        Promise.allSettled(Array.from(this.asyncOperations)),
        timeoutPromise,
      ]);
    } catch (error) {
      this.log('error', `Async operations timeout: ${error}`);
    }
  }

  // ========================================================================
  // Query Method Standardization (Requirement 5.5, 5.6)
  // ========================================================================

  /**
   * Enhanced query methods with better error messages
   */
  createEnhancedQueries(renderResult: RenderResult) {
    const {
      getByTestId,
      queryByTestId,
      findByTestId,
      getByRole,
      queryByRole,
      findByRole,
    } = renderResult;

    return {
      // Enhanced getBy methods (elements that should exist)
      getByTestIdEnhanced: (testId: string, errorContext?: string) => {
        try {
          return getByTestId(testId);
        } catch (error) {
          const enhancedError = this.enhanceQueryError(error as Error, {
            queryType: 'getByTestId',
            selector: testId,
            context: errorContext,
            suggestions: this.suggestAlternativeQueries(renderResult, testId),
          });
          throw enhancedError;
        }
      },

      getByRoleEnhanced: (
        role: string,
        options?: any,
        errorContext?: string
      ) => {
        try {
          return getByRole(role, options);
        } catch (error) {
          const enhancedError = this.enhanceQueryError(error as Error, {
            queryType: 'getByRole',
            selector: `${role} ${JSON.stringify(options || {})}`,
            context: errorContext,
            suggestions: this.suggestAlternativeRoles(renderResult, role),
          });
          throw enhancedError;
        }
      },

      // Enhanced queryBy methods (elements that may not exist)
      queryByTestIdEnhanced: (testId: string) => {
        const result = queryByTestId(testId);
        if (!result && this.config.queryMethods.logFailedQueries) {
          this.log('debug', `queryByTestId('${testId}') returned null`);
        }
        return result;
      },

      queryByRoleEnhanced: (role: string, options?: any) => {
        const result = queryByRole(role, options);
        if (!result && this.config.queryMethods.logFailedQueries) {
          this.log(
            'debug',
            `queryByRole('${role}', ${JSON.stringify(options || {})}) returned null`
          );
        }
        return result;
      },

      // Enhanced findBy methods (elements that appear asynchronously)
      findByTestIdEnhanced: async (
        testId: string,
        options?: any,
        errorContext?: string
      ) => {
        try {
          return await findByTestId(testId, {
            timeout: this.config.queryMethods.defaultTimeout,
            ...options,
          });
        } catch (error) {
          const enhancedError = this.enhanceQueryError(error as Error, {
            queryType: 'findByTestId',
            selector: testId,
            context: errorContext,
            suggestions: this.suggestAlternativeQueries(renderResult, testId),
            isAsync: true,
          });
          throw enhancedError;
        }
      },

      findByRoleEnhanced: async (
        role: string,
        options?: any,
        errorContext?: string
      ) => {
        try {
          return await findByRole(role, {
            timeout: this.config.queryMethods.defaultTimeout,
            ...options,
          });
        } catch (error) {
          const enhancedError = this.enhanceQueryError(error as Error, {
            queryType: 'findByRole',
            selector: `${role} ${JSON.stringify(options || {})}`,
            context: errorContext,
            suggestions: this.suggestAlternativeRoles(renderResult, role),
            isAsync: true,
          });
          throw enhancedError;
        }
      },
    };
  }

  /**
   * Enhance query errors with better debugging information
   */
  private enhanceQueryError(
    originalError: Error,
    context: {
      queryType: string;
      selector: string;
      context?: string;
      suggestions?: string[];
      isAsync?: boolean;
    }
  ): Error {
    const {
      queryType,
      selector,
      context: errorContext,
      suggestions,
      isAsync,
    } = context;

    let message = `${queryType}('${selector}') failed`;

    if (errorContext) {
      message += ` in context: ${errorContext}`;
    }

    if (isAsync) {
      message += ` (async query timed out after ${this.config.queryMethods.defaultTimeout}ms)`;
    }

    message += `\n\nOriginal error: ${originalError.message}`;

    if (
      suggestions &&
      suggestions.length > 0 &&
      this.config.queryMethods.suggestAlternatives
    ) {
      message += `\n\nSuggested alternatives:\n${suggestions.map((s) => `  - ${s}`).join('\n')}`;
    }

    if (this.config.debugging.enableStateLogging) {
      message += '\n\nComponent state at time of failure:';
      message += '\n' + this.getComponentStateSnapshot();
    }

    const enhancedError = new Error(message);
    enhancedError.name = `Enhanced${originalError.name}`;
    enhancedError.stack = originalError.stack;

    return enhancedError;
  }

  /**
   * Suggest alternative queries when a query fails
   */
  private suggestAlternativeQueries(
    renderResult: RenderResult,
    testId: string
  ): string[] {
    const suggestions: string[] = [];

    // Try to find similar test IDs
    const container = renderResult.container;
    const elementsWithTestId = container.querySelectorAll('[data-testid]');

    const similarTestIds = Array.from(elementsWithTestId)
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id && id.includes(testId.split('-')[0]))
      .filter((id) => id !== testId);

    if (similarTestIds.length > 0) {
      suggestions.push(`Similar test IDs found: ${similarTestIds.join(', ')}`);
    }

    // Suggest role-based queries
    const elementsWithRole = container.querySelectorAll('[role]');
    if (elementsWithRole.length > 0) {
      const roles = Array.from(elementsWithRole)
        .map((el) => el.getAttribute('role'))
        .filter((role, index, arr) => role && arr.indexOf(role) === index);

      suggestions.push(`Try role-based queries: ${roles.join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Suggest alternative roles when a role query fails
   */
  private suggestAlternativeRoles(
    renderResult: RenderResult,
    role: string
  ): string[] {
    const suggestions: string[] = [];

    const container = renderResult.container;
    const elementsWithRole = container.querySelectorAll('[role]');

    const availableRoles = Array.from(elementsWithRole)
      .map((el) => el.getAttribute('role'))
      .filter((r, index, arr) => r && arr.indexOf(r) === index && r !== role);

    if (availableRoles.length > 0) {
      suggestions.push(`Available roles: ${availableRoles.join(', ')}`);
    }

    // Suggest implicit roles
    const buttons = container.querySelectorAll('button');
    const links = container.querySelectorAll('a');
    const inputs = container.querySelectorAll('input');

    if (buttons.length > 0)
      suggestions.push(`${buttons.length} button(s) available`);
    if (links.length > 0) suggestions.push(`${links.length} link(s) available`);
    if (inputs.length > 0)
      suggestions.push(`${inputs.length} input(s) available`);

    return suggestions;
  }

  // ========================================================================
  // Debugging Utilities (Requirement 5.6)
  // ========================================================================

  /**
   * Log component state during tests
   */
  logComponentState(context: string, additionalData?: any): void {
    if (!this.config.debugging.enableStateLogging) {
      return;
    }

    const stateSnapshot = {
      context,
      timestamp: Date.now(),
      testName: this.currentTestName,
      mockCallCounts: this.getMockCallCounts(),
      activeTimers: this.timers.size,
      asyncOperations: this.asyncOperations.size,
      memoryUsage: this.getMemoryUsage(),
      additionalData,
    };

    this.componentStateHistory.push(stateSnapshot);
    this.log('debug', `Component state logged: ${context}`, stateSnapshot);
  }

  /**
   * Get snapshot of current component state
   */
  getComponentStateSnapshot(): string {
    const snapshot = {
      mockCallCounts: this.getMockCallCounts(),
      activeTimers: this.timers.size,
      asyncOperations: this.asyncOperations.size,
      memoryUsage: this.getMemoryUsage(),
      recentHistory: this.componentStateHistory.slice(-3),
    };

    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Inspect mock call history
   */
  inspectMockCallHistory(hookName?: string): any {
    if (!this.config.debugging.enableMockInspection) {
      return null;
    }

    if (hookName) {
      return this.mockCallHistory.get(hookName) || [];
    }

    const allHistory: Record<string, any[]> = {};
    this.mockCallHistory.forEach((history, name) => {
      allHistory[name] = history;
    });

    return allHistory;
  }

  /**
   * Get mock call counts for debugging
   */
  private getMockCallCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.mockCallHistory.forEach((history, name) => {
      counts[name] = history.length;
    });
    return counts;
  }

  /**
   * Debug async operation timing
   */
  debugAsyncTiming(operationName: string): {
    start: () => void;
    end: () => number;
    log: () => void;
  } {
    let startTime: number;
    let endTime: number;
    let duration: number;

    return {
      start: () => {
        startTime = Date.now();
        this.log('debug', `Starting async operation: ${operationName}`);
      },
      end: () => {
        endTime = Date.now();
        duration = endTime - startTime;
        return duration;
      },
      log: () => {
        if (this.config.debugging.enableTimingDebug) {
          this.log(
            'debug',
            `Async operation ${operationName} took ${duration}ms`
          );

          if (duration > this.config.performance.warnThreshold) {
            this.log(
              'warn',
              `Slow async operation detected: ${operationName} (${duration}ms)`
            );
          }
        }
      },
    };
  }

  // ========================================================================
  // Performance Monitoring
  // ========================================================================

  /**
   * Start test performance monitoring
   */
  startTest(testName: string): void {
    this.currentTestName = testName;
    this.testStartTime = Date.now();

    if (this.config.performance.trackMemoryUsage) {
      this.memoryBaseline = this.getMemoryUsage();
    }

    this.log('debug', `Starting test: ${testName}`);
  }

  /**
   * End test and report performance
   */
  endTest(): void {
    const duration = Date.now() - this.testStartTime;
    const memoryDelta = this.config.performance.trackMemoryUsage
      ? this.getMemoryUsage() - this.memoryBaseline
      : 0;

    if (this.config.performance.enableMonitoring) {
      if (duration > this.config.performance.errorThreshold) {
        this.log(
          'error',
          `Test ${this.currentTestName} exceeded error threshold: ${duration}ms`
        );
      } else if (duration > this.config.performance.warnThreshold) {
        this.log(
          'warn',
          `Test ${this.currentTestName} exceeded warn threshold: ${duration}ms`
        );
      }

      if (memoryDelta > 0) {
        this.log(
          'debug',
          `Test ${this.currentTestName} memory delta: +${memoryDelta}MB`
        );
      }
    }

    this.log(
      'debug',
      `Test completed: ${this.currentTestName} (${duration}ms)`
    );
  }

  /**
   * Get current memory usage (simplified)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }

  // ========================================================================
  // Timer Management
  // ========================================================================

  /**
   * Create tracked timer
   */
  createTimer(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);

    this.timers.add(timer);
    return timer;
  }

  /**
   * Clear all tracked timers
   */
  private clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Enhanced delay with tracking
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.createTimer(resolve, ms);
    });
  }

  /**
   * Logging with configurable levels
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    const levels = ['none', 'error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.debugging.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex <= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.currentTestName || 'SETUP'}]`;

      if (data) {
        console[level](`${prefix} ${message}`, data);
      } else {
        console[level](`${prefix} ${message}`);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TestInfrastructureConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TestInfrastructureConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Global Test Infrastructure Instance
// ============================================================================

export const testInfrastructure = new TestInfrastructureManager();

// ============================================================================
// Setup and Cleanup Hooks (Requirements 5.1, 5.3)
// ============================================================================

/**
 * Global setup for all tests
 */
beforeAll(() => {
  testInfrastructure.log('info', 'Initializing test infrastructure');

  // Setup global error handling
  const originalError = console.error;
  console.error = (...args) => {
    if (testInfrastructure.getConfig().debugging.enableErrorEnhancement) {
      testInfrastructure.logComponentState('Console error occurred', { args });
    }
    originalError.apply(console, args);
  };
});

/**
 * Global cleanup
 */
afterAll(async () => {
  // Wait for any remaining async operations
  await testInfrastructure.waitForAsyncOperations(2000);

  testInfrastructure.log('info', 'Test infrastructure cleanup completed');
});

/**
 * Per-test setup with comprehensive mock reset
 */
beforeEach(() => {
  // Get current test name from Vitest context
  const testName = expect.getState().currentTestName || 'Unknown Test';

  testInfrastructure.startTest(testName);
  testInfrastructure.resetAllMocks();
  testInfrastructure.setupTestMocks();
});

/**
 * Per-test cleanup with proper isolation
 */
afterEach(async () => {
  // Wait for async operations to complete
  await testInfrastructure.waitForAsyncOperations(1000);

  // End test performance monitoring
  testInfrastructure.endTest();

  // Final cleanup
  testInfrastructure.resetAllMocks();
});

// ============================================================================
// Exported Utilities
// ============================================================================

export { TestInfrastructureManager, type TestInfrastructureConfig };

// Re-export enhanced utilities
export const {
  waitFor: enhancedWaitFor,
  waitForElement,
  trackAsyncOperation,
  createEnhancedQueries,
  logComponentState,
  inspectMockCallHistory,
  debugAsyncTiming,
  createTimer,
} = testInfrastructure;
