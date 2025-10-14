/**
 * Optimized Test Setup
 * Integrates performance manager, isolation manager, and optimized mocks
 */

import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  testPerformanceManager,
  DEFAULT_PERF_CONFIG,
} from './performance-manager';
import { testIsolationManager, setupTestIsolation } from './isolation-manager';
import { setupOptimizedMocks, cleanupOptimizedMocks } from './optimized-mocks';

// Global test configuration
const OPTIMIZED_TEST_CONFIG = {
  // Performance settings
  performance: {
    ...DEFAULT_PERF_CONFIG,
    enablePerfMonitoring:
      process.env.NODE_ENV !== 'test' || process.env.PERF_MONITORING === 'true',
    warnThreshold: 2000, // Reduced from 3000ms for stricter performance
  },

  // Isolation settings
  isolation: {
    autoCleanup: true,
    resetMocks: true,
    clearTimers: true,
    resetDOM: true,
    clearLocalStorage: true,
    clearSessionStorage: true,
    resetConsole: false,
  },

  // Mock settings
  mocks: {
    enableFastMode: true,
    defaultDelay: 20, // Reduced for better performance
    maxDelay: 80, // Reduced maximum delay
    enableRetries: true,
    maxRetries: 1, // Reduced retries for faster failure
    enableStateTracking: true,
    autoCleanup: true,
    errorRate: 0,
    enableErrorRecovery: true,
  },
};

// Global setup for all tests
beforeAll(() => {
  // Setup test isolation
  setupTestIsolation(OPTIMIZED_TEST_CONFIG.isolation);

  // Configure performance manager
  testPerformanceManager.reset();

  // Mock global APIs for better performance
  setupGlobalMocks();

  // Setup error handling
  setupErrorHandling();

  console.log('🚀 Optimized test environment initialized');
});

// Global cleanup
afterAll(() => {
  testIsolationManager.destroy();
  testPerformanceManager.reset();

  console.log('✅ Optimized test environment cleaned up');
});

// Per-test setup
beforeEach(() => {
  // Reset performance tracking
  testPerformanceManager.reset();

  // Setup optimized mocks with default config
  setupOptimizedMocks({
    config: OPTIMIZED_TEST_CONFIG.mocks,
  });
});

// Per-test cleanup
afterEach(() => {
  // Cleanup optimized mocks
  cleanupOptimizedMocks();

  // Check for test interference
  const interference = testIsolationManager.detectInterference();
  if (interference.hasInterference && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  Test interference detected:', interference.issues);
  }

  // Performance reporting
  if (OPTIMIZED_TEST_CONFIG.performance.enablePerfMonitoring) {
    const stats = testPerformanceManager.getStats();
    const slowOperations = Object.entries(stats.operationCounts).filter(
      ([_, count]) => count > 5 // More than 5 operations might indicate inefficiency
    );

    if (slowOperations.length > 0) {
      console.debug('📊 Performance stats:', {
        slowOperations,
        activeTimers: stats.activeTimers,
      });
    }
  }
});

// Setup global mocks for better performance
function setupGlobalMocks() {
  // Mock DOM APIs that are commonly used in tests
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
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock requestAnimationFrame for better performance
  global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
    return setTimeout(cb, 0);
  });

  global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
    clearTimeout(id);
  });

  // Mock console methods to reduce noise in tests
  if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
    console.debug = vi.fn();
    console.info = vi.fn();
  }
}

// Setup error handling for better debugging
function setupErrorHandling() {
  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Catch uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  // Setup custom error boundary for React components
  const originalError = console.error;
  console.error = (...args) => {
    // Filter out React error boundary warnings in tests
    if (
      args[0]?.includes?.('Warning: React.createElement') ||
      args[0]?.includes?.('Warning: validateDOMNesting')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

// Export optimized test utilities
export const optimizedTestUtils = {
  // Performance utilities
  measureTestDuration: (testName: string) => {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        if (duration > OPTIMIZED_TEST_CONFIG.performance.warnThreshold) {
          console.warn(`⚠️  Slow test: ${testName} took ${duration}ms`);
        }
        return duration;
      },
    };
  },

  // Fast waiting utilities
  fastWaitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeout = 2000
  ) => {
    return testPerformanceManager.waitFor(condition, {
      timeout,
      interval: 25, // Faster polling
      operationName: 'fastWaitFor',
    });
  },

  // Batch operations for better performance
  batchOperations: async <T>(
    operations: Array<() => Promise<T>>,
    concurrency = 3
  ) => {
    return testPerformanceManager.batchOperations(operations, {
      concurrency,
      timeout: OPTIMIZED_TEST_CONFIG.performance.defaultTimeout,
    });
  },

  // Optimized mock creation
  createFastMock: <T extends (...args: any[]) => any>(
    implementation?: T,
    delay = OPTIMIZED_TEST_CONFIG.mocks.defaultDelay
  ) => {
    return testPerformanceManager.createOptimizedMock(implementation, {
      delay,
      shouldFail: false,
      failureRate: 0,
    });
  },

  // Performance-aware assertions
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

  // Isolation utilities
  withIsolation: <T>(testFn: () => T | Promise<T>): Promise<T> => {
    return testIsolationManager.createIsolatedEnvironment(testFn);
  },

  // Configuration access
  getConfig: () => OPTIMIZED_TEST_CONFIG,

  // Performance stats
  getPerformanceStats: () => testPerformanceManager.getStats(),

  // Interference detection
  checkInterference: () => testIsolationManager.detectInterference(),
};

// Export configuration for test customization
export { OPTIMIZED_TEST_CONFIG };

// Re-export commonly used utilities
export {
  testPerformanceManager,
  testIsolationManager,
  setupOptimizedMocks,
  cleanupOptimizedMocks,
} from './optimized-mocks';

export {
  withPerformanceTracking,
  createFastDelay,
  createNormalDelay,
  performanceTestUtils,
} from './performance-manager';

export {
  withIsolation,
  createIsolatedMock,
  createIsolatedTimer,
} from './isolation-manager';
