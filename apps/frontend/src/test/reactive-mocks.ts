/**
 * Reactive Mock Infrastructure for React Testing
 *
 * This module provides React-aware mock state management that ensures
 * mock state updates trigger proper React component re-renders.
 */

import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { act } from '@testing-library/react';

/**
 * Subscription callback type for debugging and testing
 */
type SubscriptionCallback<T> = (value: T) => void;

/**
 * Unsubscribe function returned by subscribe()
 */
type UnsubscribeFunction = () => void;

/**
 * ReactiveHookMock manages mock hook state with React awareness.
 *
 * Key features:
 * - State updates trigger React re-renders via act()
 * - Supports partial updates that merge with existing state
 * - Provides subscription pattern for debugging
 * - Type-safe with TypeScript generics
 *
 * @example
 * ```typescript
 * const chatMock = new ReactiveHookMock({
 *   messages: [],
 *   isLoading: false,
 *   error: null,
 *   sendMessage: vi.fn()
 * });
 *
 * // Update state and trigger re-render
 * await chatMock.updateValue({ isLoading: true });
 *
 * // Use in test
 * mockUseChat.mockImplementation(chatMock.getMock());
 * ```
 */
export class ReactiveHookMock<T extends Record<string, unknown>> {
  private currentValue: T;
  private readonly initialValue: T;
  private readonly mockFn: MockedFunction<() => T>;
  private readonly subscribers: Set<SubscriptionCallback<T>>;

  /**
   * Creates a new ReactiveHookMock instance
   *
   * @param initialValue - The initial state value for the mock
   */
  constructor(initialValue: T) {
    this.initialValue = { ...initialValue };
    this.currentValue = { ...initialValue };
    this.subscribers = new Set();

    // Create a Vitest mock function with implementation that returns current value
    // Using mockImplementation ensures each call gets the latest value
    this.mockFn = vi.fn();
    this.mockFn.mockImplementation(() => this.currentValue);
  }

  /**
   * Updates the mock state and triggers React re-renders
   *
   * This method wraps the state update in React's act() to ensure
   * that all component updates are processed before the promise resolves.
   *
   * @param newValue - Partial state update to merge with current state
   * @returns Promise that resolves when React has processed the update
   *
   * @example
   * ```typescript
   * await mock.updateValue({ isLoading: true });
   * await mock.updateValue({ messages: [...messages, newMessage], isLoading: false });
   * ```
   */
  async updateValue(newValue: Partial<T>): Promise<void> {
    await act(async () => {
      // Create a new object reference to ensure React detects the change
      // This is crucial for triggering re-renders
      this.currentValue = {
        ...this.currentValue,
        ...newValue,
      };

      // Update the mock function to return the new value
      // This ensures subsequent calls return the updated state
      this.mockFn.mockReturnValue(this.currentValue);

      // Notify all subscribers
      this.notifySubscribers();
    });
  }

  /**
   * Gets the Vitest mock function for use in tests
   *
   * @returns MockedFunction that returns the current state
   *
   * @example
   * ```typescript
   * mockUseChat.mockImplementation(chatMock.getMock());
   * ```
   */
  getMock(): MockedFunction<() => T> {
    return this.mockFn;
  }

  /**
   * Gets the current state value without triggering updates
   *
   * Useful for assertions and debugging.
   *
   * @returns The current state value
   *
   * @example
   * ```typescript
   * const currentState = mock.getCurrentValue();
   * expect(currentState.isLoading).toBe(false);
   * ```
   */
  getCurrentValue(): T {
    return { ...this.currentValue };
  }

  /**
   * Resets the mock to its initial state
   *
   * This is useful for test cleanup and ensuring test isolation.
   * Does not trigger re-renders as it's typically called between tests.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   mock.reset();
   * });
   * ```
   */
  reset(): void {
    this.currentValue = { ...this.initialValue };
    this.mockFn.mockClear();
    this.notifySubscribers();
  }

  /**
   * Subscribes to state changes for debugging and testing
   *
   * The callback will be called whenever the state is updated.
   *
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function to remove the subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = mock.subscribe((value) => {
   *   console.log('State changed:', value);
   * });
   *
   * // Later, to stop listening
   * unsubscribe();
   * ```
   */
  subscribe(callback: SubscriptionCallback<T>): UnsubscribeFunction {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notifies all subscribers of state changes
   * @private
   */
  private notifySubscribers(): void {
    const currentValue = this.getCurrentValue();
    this.subscribers.forEach((callback) => {
      try {
        callback(currentValue);
      } catch (error) {
        // Log errors but don't throw to prevent breaking other subscribers
        console.error('Error in ReactiveHookMock subscriber:', error);
      }
    });
  }
}

/**
 * MockRegistry manages the lifecycle of all reactive mocks in tests.
 *
 * This singleton provides centralized mock management with:
 * - Type-safe mock registration and retrieval
 * - Automatic cleanup between tests
 * - Debugging support via mock listing
 *
 * @example
 * ```typescript
 * // Register mocks
 * mockRegistry.register('useChat', chatMock);
 * mockRegistry.register('useProducts', productsMock);
 *
 * // Update a mock by name
 * await mockRegistry.update('useChat', { isLoading: true });
 *
 * // Clean up after tests
 * mockRegistry.resetAll();
 * ```
 */
export class MockRegistry {
  private mocks: Map<string, ReactiveHookMock<unknown>>;

  constructor() {
    this.mocks = new Map();
  }

  /**
   * Registers a reactive mock with a unique name
   *
   * @param name - Unique identifier for the mock
   * @param mock - ReactiveHookMock instance to register
   *
   * @example
   * ```typescript
   * const chatMock = new ReactiveHookMock({ messages: [], isLoading: false });
   * mockRegistry.register('useChat', chatMock);
   * ```
   */
  register<T extends Record<string, unknown>>(
    name: string,
    mock: ReactiveHookMock<T>
  ): void {
    if (this.mocks.has(name)) {
      console.warn(`Mock "${name}" is already registered. Overwriting.`);
    }
    this.mocks.set(name, mock);
  }

  /**
   * Retrieves a registered mock by name
   *
   * @param name - Name of the mock to retrieve
   * @returns The mock instance, or undefined if not found
   *
   * @example
   * ```typescript
   * const chatMock = mockRegistry.get<UseChatReturn>('useChat');
   * if (chatMock) {
   *   await chatMock.updateValue({ isLoading: true });
   * }
   * ```
   */
  get<T extends Record<string, unknown>>(
    name: string
  ): ReactiveHookMock<T> | undefined {
    return this.mocks.get(name) as ReactiveHookMock<T> | undefined;
  }

  /**
   * Updates a registered mock by name
   *
   * This is a convenience method that combines get() and updateValue().
   *
   * @param name - Name of the mock to update
   * @param value - Partial state update
   * @returns Promise that resolves when the update is complete
   * @throws Error if the mock is not found
   *
   * @example
   * ```typescript
   * await mockRegistry.update('useChat', { isLoading: true });
   * ```
   */
  async update<T extends Record<string, unknown>>(
    name: string,
    value: Partial<T>
  ): Promise<void> {
    const mock = this.get<T>(name);
    if (!mock) {
      throw new Error(`Mock "${name}" not found in registry`);
    }
    await mock.updateValue(value);
  }

  /**
   * Resets all registered mocks to their initial values
   *
   * This is useful for test cleanup to ensure test isolation.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   mockRegistry.resetAll();
   * });
   * ```
   */
  resetAll(): void {
    this.mocks.forEach((mock) => {
      mock.reset();
    });
  }

  /**
   * Clears all registered mocks from the registry
   *
   * This completely removes all mocks. Use resetAll() if you just
   * want to reset state without removing registrations.
   *
   * @example
   * ```typescript
   * afterAll(() => {
   *   mockRegistry.clearAll();
   * });
   * ```
   */
  clearAll(): void {
    this.mocks.clear();
  }

  /**
   * Gets all registered mock names for debugging
   *
   * @returns Array of registered mock names
   *
   * @example
   * ```typescript
   * console.log('Registered mocks:', mockRegistry.getRegisteredNames());
   * ```
   */
  getRegisteredNames(): string[] {
    return Array.from(this.mocks.keys());
  }
}

/**
 * Singleton instance of MockRegistry for global access
 *
 * @example
 * ```typescript
 * import { mockRegistry } from './reactive-mocks';
 *
 * mockRegistry.register('useChat', chatMock);
 * await mockRegistry.update('useChat', { isLoading: true });
 * ```
 */
export const mockRegistry = new MockRegistry();
