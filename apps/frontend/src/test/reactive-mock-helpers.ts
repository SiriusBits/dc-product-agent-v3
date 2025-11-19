/**
 * Helper utilities for setting up reactive mocks in tests
 *
 * This module provides utilities to properly connect ReactiveHookMock instances
 * to Vitest mocks, ensuring that:
 * 1. Hook parameters are properly handled (ignored)
 * 2. Mock state updates trigger React re-renders
 * 3. Components receive the current mock state
 */

import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { ReactiveHookMock } from './reactive-mocks';

/**
 * Creates a mock implementation function that ignores parameters and returns reactive state
 *
 * This is the key to making reactive mocks work with React components that call hooks
 * with parameters (e.g., useChat({ maxResults: 10 }))
 *
 * @param reactiveMock - The ReactiveHookMock instance to connect
 * @returns A function that can be passed to mockImplementation()
 *
 * @example
 * ```typescript
 * const chatMock = new ReactiveHookMock({ messages: [], isLoading: false });
 * vi.mocked(useChat).mockImplementation(createReactiveMockImplementation(chatMock));
 * ```
 */
export function createReactiveMockImplementation<
  T extends Record<string, unknown>,
>(reactiveMock: ReactiveHookMock<T>): MockedFunction<() => T> {
  // Simply return the mock function - it already handles everything correctly
  // The ReactiveHookMock.getMock() returns a function that:
  // 1. Ignores parameters (hooks can be called with any args)
  // 2. Returns current state
  // 3. Updates when state changes
  return reactiveMock.getMock();
}

/**
 * Sets up multiple reactive mocks at once
 *
 * @param mocks - Object mapping hook names to their reactive mocks
 * @param hookMocks - Object mapping hook names to their Vitest mocked functions
 *
 * @example
 * ```typescript
 * const chatMock = new ReactiveHookMock({ ... });
 * const productsMock = new ReactiveHookMock({ ... });
 *
 * setupReactiveMocks(
 *   { useChat: chatMock, useProducts: productsMock },
 *   { useChat: vi.mocked(useChat), useProducts: vi.mocked(useProducts) }
 * );
 * ```
 */
export function setupReactiveMocks<
  T extends Record<string, ReactiveHookMock<any>>,
>(mocks: T, hookMocks: Record<keyof T, MockedFunction<any>>): void {
  for (const [hookName, reactiveMock] of Object.entries(mocks)) {
    const hookMock = hookMocks[hookName as keyof T];
    if (hookMock) {
      hookMock.mockImplementation(
        createReactiveMockImplementation(reactiveMock)
      );
    }
  }
}

/**
 * Creates a complete test setup with reactive mocks for common hooks
 *
 * This is a convenience function that creates reactive mocks for useChat,
 * useConversations, and useProducts, and connects them to the Vitest mocks.
 *
 * @param options - Initial state for each hook
 * @returns Object containing the reactive mocks and helper functions
 *
 * @example
 * ```typescript
 * const { chatMock, updateChat, conversationsMock, productsMock } = createTestSetup({
 *   chat: { messages: [], isLoading: false },
 *   conversations: { conversations: [], isLoading: false },
 *   products: { products: [], loading: false }
 * });
 *
 * // Update state and trigger re-render
 * await updateChat({ isLoading: true });
 * ```
 */
export function createTestSetup(
  options: {
    chat?: Partial<any>;
    conversations?: Partial<any>;
    products?: Partial<any>;
  } = {}
) {
  const chatMock = new ReactiveHookMock({
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    retryLastMessage: vi.fn(),
    isRetryable: false,
    ...options.chat,
  });

  const conversationsMock = new ReactiveHookMock({
    conversations: [],
    isLoading: false,
    error: null,
    loadConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    retry: vi.fn(),
    isRetryable: false,
    ...options.conversations,
  });

  const productsMock = new ReactiveHookMock({
    products: [],
    totalCount: 0,
    facets: null,
    loading: false,
    error: null,
    searchProducts: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    retry: vi.fn(),
    isRetryable: false,
    ...options.products,
  });

  return {
    chatMock,
    conversationsMock,
    productsMock,
    updateChat: (updates: Partial<any>) => chatMock.updateValue(updates),
    updateConversations: (updates: Partial<any>) =>
      conversationsMock.updateValue(updates),
    updateProducts: (updates: Partial<any>) =>
      productsMock.updateValue(updates),
  };
}
