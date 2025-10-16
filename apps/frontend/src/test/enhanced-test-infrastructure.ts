/**
 * Enhanced Test Infrastructure
 *
 * Integrates all test infrastructure improvements including:
 * - Consistent mock reset strategy
 * - Standardized async operation handling
 * - Enhanced query methods with clear error messages
 * - Comprehensive debugging utilities
 *
 * This is the main entry point for the enhanced test infrastructure.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';

// Import all infrastructure components
import {
  testInfrastructure,
  type TestInfrastructureConfig,
  DEFAULT_TEST_CONFIG,
} from './test-infrastructure';

import {
  enhancedWaitFor,
  waitForStateUpdate,
  waitForMultipleOperations,
  createAsyncQueries,
  waitForLoadingToComplete,
  waitForErrorState,
  waitForDataToLoad,
  createControlledAsyncMock,
  createDelayedAsyncMock,
  createFlakyAsyncMock,
  raceWithTimeout,
  retryWithBackoff,
  batchAsyncOperations,
  type AsyncTestConfig,
  DEFAULT_ASYNC_CONFIG,
} from './async-test-utils';

import {
  createStandardizedQueries,
  createScreenQueries,
  screenQueries,
  type QueryConfig,
  DEFAULT_QUERY_CONFIG,
  QueryError,
  ElementNotFoundError,
  ElementTimeoutError,
} from './query-utils';

import {
  testDebugger,
  logComponentState,
  registerMock,
  timeAsyncOperation,
  createFailureSnapshot,
  type DebugConfig,
  DEFAULT_DEBUG_CONFIG,
} from './debug-utils';

// ============================================================================
// Enhanced Test Infrastructure Configuration
// ============================================================================

export interface EnhancedTestConfig {
  infrastructure: TestInfrastructureConfig;
  async: AsyncTestConfig;
  queries: QueryConfig;
  debug: DebugConfig;
}

export const DEFAULT_ENHANCED_CONFIG: EnhancedTestConfig = {
  infrastructure: DEFAULT_TEST_CONFIG,
  async: DEFAULT_ASYNC_CONFIG,
  queries: DEFAULT_QUERY_CONFIG,
  debug: DEFAULT_DEBUG_CONFIG,
};

// ============================================================================
// Enhanced Test Infrastructure Manager
// ============================================================================

export class EnhancedTestInfrastructure {
  private config: EnhancedTestConfig;
  private currentTestName: string = '';
  private testStartTime: number = 0;
  private isSetupComplete: boolean = false;

  constructor(config: EnhancedTestConfig = DEFAULT_ENHANCED_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize the enhanced test infrastructure
   */
  initialize(): void {
    if (this.isSetupComplete) {
      return;
    }

    // Update component configurations
    testInfrastructure.updateConfig(this.config.infrastructure);
    testDebugger.updateConfig(this.config.debug);

    this.setupGlobalHooks();
    this.setupErrorHandling();

    this.isSetupComplete = true;
    console.log('🚀 Enhanced test infrastructure initialized');
  }

  /**
   * Setup global test hooks
   */
  private setupGlobalHooks(): void {
    // Global setup
    beforeAll(() => {
      this.logInfo('Setting up enhanced test infrastructure');
      this.setupGlobalMocks();
    });

    // Global cleanup
    afterAll(async () => {
      await this.performGlobalCleanup();
      this.logInfo('Enhanced test infrastructure cleanup completed');
    });

    // Per-test setup
    beforeEach(() => {
      const testName = this.getCurrentTestName();
      this.startTest(testName);
    });

    // Per-test cleanup
    afterEach(async () => {
      await this.endTest();
    });
  }

  /**
   * Setup enhanced error handling
   */
  private setupErrorHandling(): void {
    // Enhance console.error to capture test failures
    const originalError = console.error;
    console.error = (...args) => {
      if (this.config.debug.enableComponentStateLogging) {
        logComponentState('Console error occurred', {
          additionalData: { args },
        });
      }
      originalError.apply(console, args);
    };

    // Setup unhandled rejection handler
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        const snapshot = createFailureSnapshot(this.currentTestName, error, {
          type: 'unhandledRejection',
          promise,
        });
        console.error('Unhandled Promise Rejection:', snapshot);
      });
    }
  }

  /**
   * Setup global mocks for better test reliability
   */
  private setupGlobalMocks(): void {
    // Mock DOM APIs
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn();

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
      return setTimeout(cb, 0);
    });

    global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
      clearTimeout(id);
    });
  }

  /**
   * Start a test with enhanced tracking
   */
  private startTest(testName: string): void {
    this.currentTestName = testName;
    this.testStartTime = Date.now();

    // Initialize debug components
    testDebugger.setTestName(testName);
    testInfrastructure.startTest(testName);

    // Reset all infrastructure
    testInfrastructure.resetAllMocks();
    testInfrastructure.setupTestMocks();

    this.logDebug(`Test started: ${testName}`);
    logComponentState('Test started', { testName });
  }

  /**
   * End a test with cleanup and reporting
   */
  private async endTest(): Promise<void> {
    const duration = Date.now() - this.testStartTime;

    try {
      // Wait for any pending async operations
      await testInfrastructure.waitForAsyncOperations(2000);

      // Perform cleanup
      cleanup();
      testInfrastructure.resetAllMocks();

      // Log test completion
      logComponentState('Test completed', {
        testName: this.currentTestName,
        duration,
      });

      // Check for performance issues
      if (duration > this.config.infrastructure.performance.warnThreshold) {
        this.logWarn(
          `Slow test detected: ${this.currentTestName} (${duration}ms)`
        );
      }

      this.logDebug(`Test completed: ${this.currentTestName} (${duration}ms)`);
    } catch (error) {
      const snapshot = createFailureSnapshot(
        this.currentTestName,
        error as Error,
        { phase: 'cleanup', duration }
      );
      console.error('Test cleanup failed:', snapshot);
    } finally {
      testInfrastructure.endTest();
    }
  }

  /**
   * Perform global cleanup
   */
  private async performGlobalCleanup(): Promise<void> {
    try {
      // Clear all debug history
      testDebugger.clearAll();

      // Final infrastructure cleanup
      await testInfrastructure.waitForAsyncOperations(5000);
    } catch (error) {
      console.error('Global cleanup failed:', error);
    }
  }

  /**
   * Get current test name from Vitest context
   */
  private getCurrentTestName(): string {
    try {
      return expect.getState().currentTestName || 'Unknown Test';
    } catch {
      return 'Unknown Test';
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EnhancedTestConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.infrastructure) {
      testInfrastructure.updateConfig(newConfig.infrastructure);
    }

    if (newConfig.debug) {
      testDebugger.updateConfig(newConfig.debug);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedTestConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Logging Methods
  // ========================================================================

  private logDebug(message: string): void {
    if (this.config.debug.logLevel === 'debug') {
      console.debug(`[ENHANCED-TEST] ${message}`);
    }
  }

  private logInfo(message: string): void {
    if (['debug', 'info'].includes(this.config.debug.logLevel)) {
      console.info(`[ENHANCED-TEST] ${message}`);
    }
  }

  private logWarn(message: string): void {
    if (['debug', 'info', 'warn'].includes(this.config.debug.logLevel)) {
      console.warn(`[ENHANCED-TEST] ${message}`);
    }
  }
}

// ============================================================================
// Enhanced Test Utilities
// ============================================================================

export class EnhancedTestUtils {
  private infrastructure: EnhancedTestInfrastructure;

  constructor(infrastructure: EnhancedTestInfrastructure) {
    this.infrastructure = infrastructure;
  }

  /**
   * Create enhanced render result with all utilities
   */
  createEnhancedRenderResult(renderResult: RenderResult) {
    const testName = this.getCurrentTestName();

    // Create standardized queries
    const queries = createStandardizedQueries(renderResult, {
      testName,
    });

    // Create async queries
    const asyncQueries = createAsyncQueries(renderResult);

    return {
      ...renderResult,

      // Enhanced queries
      queries,
      asyncQueries,

      // Convenience methods that combine multiple utilities
      waitForElement: async (testId: string, timeout?: number) => {
        return queries.findByTestId(testId, { timeout });
      },

      waitForText: async (text: string | RegExp, timeout?: number) => {
        return queries.findByText(text, { timeout });
      },

      waitForRole: async (
        role: string,
        options?: { name?: string; timeout?: number }
      ) => {
        return queries.findByRole(role, options);
      },

      // State management utilities
      logState: (context: string, additionalData?: any) => {
        logComponentState(context, {
          componentName: testName,
          domElement: renderResult.container,
          additionalData,
        });
      },

      // Async operation utilities
      waitForLoading: (getLoadingState: () => boolean, timeout?: number) => {
        return waitForLoadingToComplete(getLoadingState, { timeout });
      },

      waitForError: (getErrorState: () => Error | null, timeout?: number) => {
        return waitForErrorState(getErrorState, { timeout });
      },

      waitForData: <T>(
        getData: () => T[],
        minItems?: number,
        timeout?: number
      ) => {
        return waitForDataToLoad(getData, { minItems, timeout });
      },

      // Performance utilities
      timeOperation: async <T>(
        operationName: string,
        fn: () => Promise<T> | T
      ) => {
        return timeAsyncOperation(operationName, fn, { testName });
      },

      // Debug utilities
      createSnapshot: (error: Error, context?: any) => {
        return createFailureSnapshot(testName, error, context);
      },
    };
  }

  /**
   * Create enhanced mock utilities
   */
  createMockUtils() {
    return {
      // Controlled async mocks
      createControlledMock: createControlledAsyncMock,
      createDelayedMock: createDelayedAsyncMock,
      createFlakyMock: createFlakyAsyncMock,

      // Mock registration for debugging
      registerForDebugging: registerMock,

      // Mock inspection
      inspectCalls: (mockName: string) =>
        testDebugger.mockCalls.getCallHistory(mockName),
      getCallCount: (mockName: string) =>
        testDebugger.mockCalls.getCallCount(mockName),
      wasCalledWith: (mockName: string, args: any[]) =>
        testDebugger.mockCalls.wasCalledWith(mockName, args),

      // Mock utilities with retry logic
      createRetryableMock: <T>(value: T, failureRate: number = 0.3) => {
        return createFlakyAsyncMock(value, failureRate);
      },
    };
  }

  /**
   * Create enhanced async utilities
   */
  createAsyncUtils() {
    return {
      // Enhanced waitFor
      waitFor: enhancedWaitFor,
      waitForState: waitForStateUpdate,
      waitForMultiple: waitForMultipleOperations,

      // Timeout utilities
      raceWithTimeout,
      retryWithBackoff,
      batchOperations: batchAsyncOperations,

      // Performance tracking
      timeFunction: timeAsyncOperation,

      // Specialized waiting
      waitForLoading: waitForLoadingToComplete,
      waitForError: waitForErrorState,
      waitForData: waitForDataToLoad,
    };
  }

  private getCurrentTestName(): string {
    try {
      return expect.getState().currentTestName || 'Unknown Test';
    } catch {
      return 'Unknown Test';
    }
  }
}

// ============================================================================
// Global Enhanced Test Infrastructure Instance
// ============================================================================

export const enhancedTestInfrastructure = new EnhancedTestInfrastructure();
export const enhancedTestUtils = new EnhancedTestUtils(
  enhancedTestInfrastructure
);

// Initialize the infrastructure
enhancedTestInfrastructure.initialize();

// ============================================================================
// Convenience Exports
// ============================================================================

// Re-export all utilities for easy access
export {
  // Infrastructure
  testInfrastructure,
  testDebugger,

  // Async utilities
  enhancedWaitFor,
  waitForStateUpdate,
  waitForMultipleOperations,
  createAsyncQueries,
  waitForLoadingToComplete,
  waitForErrorState,
  waitForDataToLoad,
  createControlledAsyncMock,
  createDelayedAsyncMock,
  createFlakyAsyncMock,
  raceWithTimeout,
  retryWithBackoff,
  batchAsyncOperations,

  // Query utilities
  createStandardizedQueries,
  createScreenQueries,
  screenQueries,
  QueryError,
  ElementNotFoundError,
  ElementTimeoutError,

  // Debug utilities
  logComponentState,
  registerMock,
  timeAsyncOperation,
  createFailureSnapshot,

  // Configuration types
  type EnhancedTestConfig,
  type TestInfrastructureConfig,
  type AsyncTestConfig,
  type QueryConfig,
  type DebugConfig,

  // Default configurations (re-exported from other modules)
  DEFAULT_TEST_CONFIG,
  DEFAULT_ASYNC_CONFIG,
  DEFAULT_QUERY_CONFIG,
  DEFAULT_DEBUG_CONFIG,
};

// ============================================================================
// Enhanced Test Setup Function
// ============================================================================

/**
 * Setup enhanced test environment with all utilities
 * Use this in your test files for the complete enhanced experience
 */
export function setupEnhancedTest(config?: Partial<EnhancedTestConfig>) {
  if (config) {
    enhancedTestInfrastructure.updateConfig(config);
  }

  return {
    // Infrastructure
    infrastructure: enhancedTestInfrastructure,
    debugger: testDebugger,

    // Utilities
    utils: enhancedTestUtils,
    mockUtils: enhancedTestUtils.createMockUtils(),
    asyncUtils: enhancedTestUtils.createAsyncUtils(),

    // Query utilities
    screenQueries,
    createQueries: createStandardizedQueries,

    // Convenience functions
    logState: logComponentState,
    timeOperation: timeAsyncOperation,
    createSnapshot: createFailureSnapshot,

    // Enhanced render function
    enhancedRender: (renderResult: RenderResult) => {
      return enhancedTestUtils.createEnhancedRenderResult(renderResult);
    },
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  infrastructure: enhancedTestInfrastructure,
  utils: enhancedTestUtils,
  setup: setupEnhancedTest,
};
