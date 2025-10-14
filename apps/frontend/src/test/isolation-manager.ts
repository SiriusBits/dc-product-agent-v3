/**
 * Test Isolation Manager
 * Ensures proper test isolation and prevents interference between tests
 */

import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';

export interface IsolationConfig {
  autoCleanup: boolean;
  resetMocks: boolean;
  clearTimers: boolean;
  resetDOM: boolean;
  clearLocalStorage: boolean;
  clearSessionStorage: boolean;
  resetConsole: boolean;
}

export const DEFAULT_ISOLATION_CONFIG: IsolationConfig = {
  autoCleanup: true,
  resetMocks: true,
  clearTimers: true,
  resetDOM: true,
  clearLocalStorage: true,
  clearSessionStorage: true,
  resetConsole: false, // Keep false to preserve test output
};

export class TestIsolationManager {
  private config: IsolationConfig;
  private originalConsole: Console;
  private activeTimers: Set<NodeJS.Timeout> = new Set();
  private mockRegistry: Set<ReturnType<typeof vi.fn>> = new Set();
  private domMutationObserver?: MutationObserver;

  constructor(config: Partial<IsolationConfig> = {}) {
    this.config = { ...DEFAULT_ISOLATION_CONFIG, ...config };
    this.originalConsole = { ...console };
    this.setupDOMMutationTracking();
  }

  /**
   * Setup DOM mutation tracking to detect test interference
   */
  private setupDOMMutationTracking(): void {
    if (typeof window !== 'undefined' && window.MutationObserver) {
      this.domMutationObserver = new MutationObserver((mutations) => {
        // Track significant DOM changes that might indicate test interference
        const significantChanges = mutations.filter(
          (mutation) =>
            mutation.type === 'childList' &&
            mutation.addedNodes.length > 0 &&
            Array.from(mutation.addedNodes).some(
              (node) =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node as Element).tagName !== 'SCRIPT'
            )
        );

        if (significantChanges.length > 0 && process.env.NODE_ENV === 'test') {
          // Only warn in development, not in CI
          if (!process.env.CI) {
            console.debug('DOM mutations detected during test execution');
          }
        }
      });

      this.domMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Register a mock for automatic cleanup
   */
  registerMock(mockFn: ReturnType<typeof vi.fn>): void {
    this.mockRegistry.add(mockFn);
  }

  /**
   * Register a timer for automatic cleanup
   */
  registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.activeTimers.add(timer);
    return timer;
  }

  /**
   * Create an isolated timer that will be automatically cleaned up
   */
  createIsolatedTimer(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.activeTimers.delete(timer);
      callback();
    }, delay);

    return this.registerTimer(timer);
  }

  /**
   * Create an isolated interval that will be automatically cleaned up
   */
  createIsolatedInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    return this.registerTimer(interval);
  }

  /**
   * Clean up all registered mocks
   */
  private cleanupMocks(): void {
    if (!this.config.resetMocks) return;

    this.mockRegistry.forEach((mockFn) => {
      try {
        mockFn.mockClear();
        mockFn.mockReset();
      } catch (error) {
        // Mock might already be cleaned up
      }
    });

    this.mockRegistry.clear();

    // Clear all vi mocks
    vi.clearAllMocks();
  }

  /**
   * Clean up all active timers
   */
  private cleanupTimers(): void {
    if (!this.config.clearTimers) return;

    this.activeTimers.forEach((timer) => {
      try {
        clearTimeout(timer);
        clearInterval(timer);
      } catch (error) {
        // Timer might already be cleared
      }
    });

    this.activeTimers.clear();

    // Clear all vi timers
    vi.clearAllTimers();
  }

  /**
   * Clean up DOM state
   */
  private cleanupDOM(): void {
    if (!this.config.resetDOM) return;

    // Clean up React Testing Library
    cleanup();

    // Reset document title
    if (typeof document !== 'undefined') {
      document.title = 'Test';
    }

    // Clear any remaining event listeners
    if (typeof window !== 'undefined') {
      // Remove all event listeners from window
      const newWindow = window.constructor.prototype;
      Object.getOwnPropertyNames(newWindow).forEach((prop) => {
        if (prop.startsWith('on')) {
          try {
            (window as any)[prop] = null;
          } catch (error) {
            // Property might be read-only
          }
        }
      });
    }

    // Reset scroll position
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * Clean up browser storage
   */
  private cleanupStorage(): void {
    if (typeof window === 'undefined') return;

    if (this.config.clearLocalStorage && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch (error) {
        // localStorage might not be available
      }
    }

    if (this.config.clearSessionStorage && window.sessionStorage) {
      try {
        window.sessionStorage.clear();
      } catch (error) {
        // sessionStorage might not be available
      }
    }
  }

  /**
   * Reset console state
   */
  private resetConsole(): void {
    if (!this.config.resetConsole) return;

    // Restore original console methods
    Object.assign(console, this.originalConsole);
  }

  /**
   * Perform complete cleanup for test isolation
   */
  cleanup(): void {
    try {
      this.cleanupTimers();
      this.cleanupMocks();
      this.cleanupDOM();
      this.cleanupStorage();
      this.resetConsole();
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }

  /**
   * Setup test isolation for a test suite
   */
  setupTestSuite(): void {
    // Setup automatic cleanup after each test
    if (this.config.autoCleanup) {
      afterEach(() => {
        this.cleanup();
      });
    }
  }

  /**
   * Create an isolated test environment
   */
  createIsolatedEnvironment<T>(testFn: () => T | Promise<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Setup isolation
        const originalState = this.captureState();

        try {
          const result = await testFn();
          resolve(result);
        } finally {
          // Always cleanup, even if test fails
          this.restoreState(originalState);
          this.cleanup();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Capture current state for restoration
   */
  private captureState(): {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    documentTitle: string;
    scrollPosition: { x: number; y: number };
  } {
    const state = {
      localStorage: {} as Record<string, string>,
      sessionStorage: {} as Record<string, string>,
      documentTitle: '',
      scrollPosition: { x: 0, y: 0 },
    };

    if (typeof window !== 'undefined') {
      // Capture localStorage
      if (window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            state.localStorage[key] = window.localStorage.getItem(key) || '';
          }
        }
      }

      // Capture sessionStorage
      if (window.sessionStorage) {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            state.sessionStorage[key] =
              window.sessionStorage.getItem(key) || '';
          }
        }
      }

      // Capture scroll position
      state.scrollPosition = {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
      };
    }

    if (typeof document !== 'undefined') {
      state.documentTitle = document.title;
    }

    return state;
  }

  /**
   * Restore captured state
   */
  private restoreState(state: ReturnType<typeof this.captureState>): void {
    if (typeof window === 'undefined') return;

    try {
      // Restore localStorage
      if (window.localStorage) {
        window.localStorage.clear();
        Object.entries(state.localStorage).forEach(([key, value]) => {
          window.localStorage.setItem(key, value);
        });
      }

      // Restore sessionStorage
      if (window.sessionStorage) {
        window.sessionStorage.clear();
        Object.entries(state.sessionStorage).forEach(([key, value]) => {
          window.sessionStorage.setItem(key, value);
        });
      }

      // Restore scroll position
      if (window.scrollTo) {
        window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
      }
    } catch (error) {
      // Storage operations might fail in some environments
    }

    if (typeof document !== 'undefined') {
      document.title = state.documentTitle;
    }
  }

  /**
   * Detect potential test interference
   */
  detectInterference(): {
    hasInterference: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for lingering timers
    if (this.activeTimers.size > 0) {
      issues.push(`${this.activeTimers.size} active timers detected`);
    }

    // Check for uncleaned mocks
    if (this.mockRegistry.size > 0) {
      issues.push(`${this.mockRegistry.size} registered mocks not cleaned up`);
    }

    // Check for DOM pollution
    if (typeof document !== 'undefined') {
      const testElements = document.querySelectorAll('[data-testid]');
      if (testElements.length > 0) {
        issues.push(`${testElements.length} test elements still in DOM`);
      }
    }

    // Check for storage pollution
    if (typeof window !== 'undefined') {
      if (window.localStorage && window.localStorage.length > 0) {
        issues.push(`localStorage has ${window.localStorage.length} items`);
      }
      if (window.sessionStorage && window.sessionStorage.length > 0) {
        issues.push(`sessionStorage has ${window.sessionStorage.length} items`);
      }
    }

    return {
      hasInterference: issues.length > 0,
      issues,
    };
  }

  /**
   * Destroy the isolation manager
   */
  destroy(): void {
    this.cleanup();

    if (this.domMutationObserver) {
      this.domMutationObserver.disconnect();
    }
  }
}

// Global isolation manager instance
export const testIsolationManager = new TestIsolationManager();

// Helper functions
export const withIsolation = <T>(testFn: () => T | Promise<T>): Promise<T> => {
  return testIsolationManager.createIsolatedEnvironment(testFn);
};

export const createIsolatedMock = <T extends (...args: any[]) => any>(
  implementation?: T
): ReturnType<typeof vi.fn> => {
  const mockFn = vi.fn(implementation);
  testIsolationManager.registerMock(mockFn);
  return mockFn;
};

export const createIsolatedTimer = (
  callback: () => void,
  delay: number
): NodeJS.Timeout => {
  return testIsolationManager.createIsolatedTimer(callback, delay);
};

export const createIsolatedInterval = (
  callback: () => void,
  delay: number
): NodeJS.Timeout => {
  return testIsolationManager.createIsolatedInterval(callback, delay);
};

// Setup function for test suites
export const setupTestIsolation = (config?: Partial<IsolationConfig>): void => {
  const manager = new TestIsolationManager(config);
  manager.setupTestSuite();

  // Global cleanup on process exit
  if (typeof process !== 'undefined') {
    process.on('exit', () => {
      manager.destroy();
    });
  }
};
