/**
 * Loading State Manager for Integration Tests
 * Provides controlled loading state management with proper timeout handling
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';

export interface LoadingStateConfig {
  // Timeout settings
  defaultTimeout: number;
  maxTimeout: number;

  // Loading delays
  sendMessageDelay: number;
  loadConversationsDelay: number;
  createConversationDelay: number;

  // Auto-resolution settings
  autoResolveLoading: boolean;
  loadingResolutionDelay: number;
}

export interface ControlledPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  isResolved: boolean;
  isRejected: boolean;
  isPending: boolean;
  timeout: NodeJS.Timeout | null;
}

export class LoadingStateManager {
  private config: LoadingStateConfig;
  private activePromises = new Map<string, ControlledPromise<any>>();
  private loadingStates = new Map<string, boolean>();
  private timeouts = new Set<NodeJS.Timeout>();

  constructor(config: Partial<LoadingStateConfig> = {}) {
    this.config = {
      defaultTimeout: 5000,
      maxTimeout: 10000,
      sendMessageDelay: 100,
      loadConversationsDelay: 50,
      createConversationDelay: 50,
      autoResolveLoading: true,
      loadingResolutionDelay: 100,
      ...config,
    };
  }

  /**
   * Create a controlled promise with automatic timeout handling
   */
  createControlledPromise<T>(
    key: string,
    timeoutMs?: number
  ): ControlledPromise<T> {
    // Clear any existing promise with the same key
    this.clearPromise(key);

    let resolvePromise: (value: T) => void;
    let rejectPromise: (error: Error) => void;
    let isResolved = false;
    let isRejected = false;

    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = (value: T) => {
        if (!isResolved && !isRejected) {
          isResolved = true;
          this.clearPromise(key);
          resolve(value);
        }
      };
      rejectPromise = (error: Error) => {
        if (!isResolved && !isRejected) {
          isRejected = true;
          this.clearPromise(key);
          reject(error);
        }
      };
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!isResolved && !isRejected) {
        rejectPromise!(new ApiError('Operation timed out', 408));
      }
    }, timeoutMs || this.config.defaultTimeout);

    this.timeouts.add(timeout);

    const controlledPromise: ControlledPromise<T> = {
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
      get isResolved() {
        return isResolved;
      },
      get isRejected() {
        return isRejected;
      },
      get isPending() {
        return !isResolved && !isRejected;
      },
      timeout,
    };

    this.activePromises.set(key, controlledPromise);
    return controlledPromise;
  }

  /**
   * Set loading state for a specific operation
   */
  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
  }

  /**
   * Get loading state for a specific operation
   */
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  /**
   * Get any loading state (useful for global loading indicators)
   */
  isAnyLoading(): boolean {
    return Array.from(this.loadingStates.values()).some((loading) => loading);
  }

  /**
   * Clear a specific promise and its loading state
   */
  clearPromise(key: string): void {
    const promise = this.activePromises.get(key);
    if (promise?.timeout) {
      clearTimeout(promise.timeout);
      this.timeouts.delete(promise.timeout);
    }
    this.activePromises.delete(key);
    this.loadingStates.delete(key);
  }

  /**
   * Clear all promises and loading states
   */
  clearAll(): void {
    // Clear all timeouts
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();

    // Reject all pending promises
    this.activePromises.forEach((promise, key) => {
      if (promise.isPending) {
        promise.reject(new Error(`Operation cancelled: ${key}`));
      }
    });

    this.activePromises.clear();
    this.loadingStates.clear();
  }

  /**
   * Create a loading-aware async operation
   */
  createLoadingOperation<T>(
    key: string,
    operation: () => Promise<T> | T,
    options: {
      delay?: number;
      timeout?: number;
      autoResolve?: boolean;
    } = {}
  ): Promise<T> {
    const {
      delay = 0,
      timeout = this.config.defaultTimeout,
      autoResolve = this.config.autoResolveLoading,
    } = options;

    return new Promise<T>((resolve, reject) => {
      // Set loading state
      this.setLoading(key, true);

      const executeOperation = async () => {
        try {
          // Apply delay if specified
          if (delay > 0) {
            await new Promise((delayResolve) => {
              const delayTimeout = setTimeout(delayResolve, delay);
              this.timeouts.add(delayTimeout);
            });
          }

          // Execute the operation
          const result = await operation();

          // Clear loading state
          this.setLoading(key, false);

          resolve(result);
        } catch (error) {
          // Clear loading state on error
          this.setLoading(key, false);
          reject(error);
        }
      };

      if (autoResolve) {
        // Auto-resolve after delay
        executeOperation();
      } else {
        // Create controlled promise for manual resolution
        const controlled = this.createControlledPromise<T>(key, timeout);

        // Set up the operation to be resolved manually
        executeOperation().then(
          (result) => controlled.resolve(result),
          (error) => controlled.reject(error)
        );

        controlled.promise.then(resolve, reject);
      }
    });
  }

  /**
   * Resolve a specific controlled promise
   */
  resolvePromise<T>(key: string, value: T): void {
    const promise = this.activePromises.get(key);
    if (promise && promise.isPending) {
      promise.resolve(value);
    }
  }

  /**
   * Reject a specific controlled promise
   */
  rejectPromise(key: string, error: Error): void {
    const promise = this.activePromises.get(key);
    if (promise && promise.isPending) {
      promise.reject(error);
    }
  }

  /**
   * Wait for all loading operations to complete
   */
  async waitForAllOperations(
    timeoutMs = this.config.maxTimeout
  ): Promise<void> {
    const start = Date.now();

    while (this.isAnyLoading() && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    if (this.isAnyLoading()) {
      throw new Error(
        `Loading operations did not complete within ${timeoutMs}ms`
      );
    }
  }

  /**
   * Wait for a specific operation to complete
   */
  async waitForOperation(
    key: string,
    timeoutMs = this.config.defaultTimeout
  ): Promise<void> {
    const start = Date.now();

    while (this.isLoading(key) && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    if (this.isLoading(key)) {
      throw new Error(
        `Operation '${key}' did not complete within ${timeoutMs}ms`
      );
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      activePromises: Array.from(this.activePromises.keys()),
      loadingStates: Object.fromEntries(this.loadingStates),
      isAnyLoading: this.isAnyLoading(),
      config: this.config,
    };
  }
}

// Global instance for tests
export const loadingStateManager = new LoadingStateManager();

// Helper functions for common operations
export const createLoadingAwareOperation = <T>(
  key: string,
  operation: () => Promise<T> | T,
  options?: Parameters<LoadingStateManager['createLoadingOperation']>[2]
) => loadingStateManager.createLoadingOperation(key, operation, options);

export const waitForLoadingToComplete = (timeoutMs?: number) =>
  loadingStateManager.waitForAllOperations(timeoutMs);

export const clearAllLoadingStates = () => loadingStateManager.clearAll();

export const isAnyOperationLoading = () => loadingStateManager.isAnyLoading();

export const getLoadingState = (key: string) =>
  loadingStateManager.isLoading(key);
