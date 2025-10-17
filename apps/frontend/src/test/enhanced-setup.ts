/**
 * Enhanced Test Setup with ReactiveHookMock Infrastructure
 *
 * This module provides a comprehensive test setup function that creates
 * reactive mocks for all major hooks and registers them with the MockRegistry.
 * It replaces the old enhanced-setup.ts with the new reactive mock approach.
 */

import { vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import React from 'react';
import { ReactiveHookMock, mockRegistry } from './reactive-mocks';
import type {
  ChatMessage,
  Conversation,
  ProductSummary,
  SearchFacets,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Mock state for useChat hook
 */
interface MockUseChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ApiError | null;
  conversationId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
  clearMessages: ReturnType<typeof vi.fn>;
  loadConversation: ReturnType<typeof vi.fn>;
  retryLastMessage: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Mock state for useProducts hook
 */
interface MockUseProductsState {
  products: ProductSummary[];
  totalCount: number;
  facets: SearchFacets | null;
  loading: boolean;
  error: string | null;
  searchProducts: ReturnType<typeof vi.fn>;
  loadMore: ReturnType<typeof vi.fn>;
  hasMore: boolean;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Mock state for useConversations hook
 */
interface MockUseConversationsState {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

/**
 * Setup options for configuring test environment
 */
export interface SetupOptions {
  // Initial state overrides
  initialChatMessages?: ChatMessage[];
  initialConversations?: Conversation[];
  initialProducts?: ProductSummary[];
  initialConversationId?: string | null;

  // Loading states
  chatLoading?: boolean;
  productsLoading?: boolean;
  conversationsLoading?: boolean;

  // Error states
  chatError?: ApiError | null;
  productsError?: string | null;
  conversationsError?: ApiError | null;

  // Mock behavior options
  enableAutoCleanup?: boolean;
  mockLocalStorage?: boolean;
  mockSessionStorage?: boolean;
}

/**
 * Test context returned by setupTest
 */
export interface TestContext {
  // Mock instances for direct manipulation
  chatMock: ReactiveHookMock<MockUseChatState>;
  productsMock: ReactiveHookMock<MockUseProductsState>;
  conversationsMock: ReactiveHookMock<MockUseConversationsState>;

  // Helper functions for common updates
  updateChat: (updates: Partial<MockUseChatState>) => Promise<void>;
  updateProducts: (updates: Partial<MockUseProductsState>) => Promise<void>;
  updateConversations: (
    updates: Partial<MockUseConversationsState>
  ) => Promise<void>;

  // Enhanced render function with automatic cleanup
  renderComponent: (component: React.ReactElement) => RenderResult;

  // Storage mocks (if enabled)
  localStorage?: Storage;
  sessionStorage?: Storage;
}

// ============================================================================
// Default State Factories
// ============================================================================

/**
 * Creates default useChat mock state
 */
function createDefaultChatState(options: SetupOptions = {}): MockUseChatState {
  return {
    messages: options.initialChatMessages || [],
    isLoading: options.chatLoading || false,
    error: options.chatError || null,
    conversationId: options.initialConversationId || null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    retryLastMessage: vi.fn(),
    isRetryable: false,
  };
}

/**
 * Creates default useProducts mock state
 */
function createDefaultProductsState(
  options: SetupOptions = {}
): MockUseProductsState {
  return {
    products: options.initialProducts || [],
    totalCount: options.initialProducts?.length || 0,
    facets: null,
    loading: options.productsLoading || false,
    error: options.productsError || null,
    searchProducts: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    retry: vi.fn(),
    isRetryable: false,
  };
}

/**
 * Creates default useConversations mock state
 */
function createDefaultConversationsState(
  options: SetupOptions = {}
): MockUseConversationsState {
  return {
    conversations: options.initialConversations || [],
    isLoading: options.conversationsLoading || false,
    error: options.conversationsError || null,
    loadConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    retry: vi.fn(),
    isRetryable: false,
  };
}

// ============================================================================
// Storage Mocks
// ============================================================================

/**
 * Creates a mock localStorage implementation
 */
function createMockLocalStorage(): Storage {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    length: 0,
    key: vi.fn(),
  };
}

/**
 * Creates a mock sessionStorage implementation
 */
function createMockSessionStorage(): Storage {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    length: 0,
    key: vi.fn(),
  };
}

// ============================================================================
// Main Setup Function
// ============================================================================

/**
 * Enhanced test setup function using ReactiveHookMock infrastructure
 *
 * Creates reactive mocks for useChat, useProducts, and useConversations hooks,
 * registers them with the MockRegistry, and provides helper functions for
 * common test operations.
 *
 * @param options - Configuration options for the test setup
 * @returns TestContext with mock instances and helper functions
 *
 * @example
 * ```typescript
 * const { updateChat, renderComponent } = setupTest({
 *   initialChatMessages: [{ id: '1', content: 'Hello', role: 'user', timestamp: new Date() }],
 *   chatLoading: false
 * });
 *
 * // Update chat state and trigger re-renders
 * await updateChat({ isLoading: true });
 *
 * // Render component with automatic cleanup
 * const { getByTestId } = renderComponent(<ChatInterface />);
 * ```
 */
export function setupTest(options: SetupOptions = {}): TestContext {
  // Create reactive mocks with initial state
  const chatMock = new ReactiveHookMock(createDefaultChatState(options));
  const productsMock = new ReactiveHookMock(
    createDefaultProductsState(options)
  );
  const conversationsMock = new ReactiveHookMock(
    createDefaultConversationsState(options)
  );

  // Register mocks with the registry
  mockRegistry.register('useChat', chatMock);
  mockRegistry.register('useProducts', productsMock);
  mockRegistry.register('useConversations', conversationsMock);

  // Create storage mocks if requested
  let localStorage: Storage | undefined;
  let sessionStorage: Storage | undefined;

  if (options.mockLocalStorage) {
    localStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: localStorage,
      writable: true,
      configurable: true,
    });
  }

  if (options.mockSessionStorage) {
    sessionStorage = createMockSessionStorage();
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorage,
      writable: true,
      configurable: true,
    });
  }

  // Helper functions for common updates
  const updateChat = async (updates: Partial<MockUseChatState>) => {
    await chatMock.updateValue(updates);
  };

  const updateProducts = async (updates: Partial<MockUseProductsState>) => {
    await productsMock.updateValue(updates);
  };

  const updateConversations = async (
    updates: Partial<MockUseConversationsState>
  ) => {
    await conversationsMock.updateValue(updates);
  };

  // Enhanced render function with automatic cleanup tracking
  const renderedComponents: RenderResult[] = [];

  const renderComponent = (component: React.ReactElement): RenderResult => {
    const result = render(component);
    renderedComponents.push(result);
    return result;
  };

  // Set up automatic cleanup if enabled (default: true)
  if (options.enableAutoCleanup !== false) {
    afterEach(() => {
      // Cleanup all rendered components
      renderedComponents.forEach((result) => {
        if (result.unmount) {
          try {
            result.unmount();
          } catch (error) {
            // Ignore unmount errors
          }
        }
      });
      renderedComponents.length = 0;

      // Reset all mocks to initial state
      mockRegistry.resetAll();

      // Clear storage mocks
      if (localStorage) {
        localStorage.clear();
      }
      if (sessionStorage) {
        sessionStorage.clear();
      }

      // Standard cleanup
      cleanup();
      vi.clearAllMocks();
    });
  }

  return {
    chatMock,
    productsMock,
    conversationsMock,
    updateChat,
    updateProducts,
    updateConversations,
    renderComponent,
    localStorage,
    sessionStorage,
  };
}

// ============================================================================
// Specialized Setup Functions
// ============================================================================

/**
 * Setup for chat flow tests with common chat scenarios
 */
export function setupChatFlowTest(
  options: Partial<SetupOptions> = {}
): TestContext {
  return setupTest({
    initialChatMessages: [],
    initialConversations: [],
    chatLoading: false,
    conversationsLoading: false,
    mockLocalStorage: true,
    ...options,
  });
}

/**
 * Setup for product search tests with common product scenarios
 */
export function setupProductSearchTest(
  options: Partial<SetupOptions> = {}
): TestContext {
  return setupTest({
    initialProducts: [],
    productsLoading: false,
    mockSessionStorage: true,
    ...options,
  });
}

/**
 * Setup for error handling tests with error states
 */
export function setupErrorTest(
  options: Partial<SetupOptions> = {}
): TestContext {
  return setupTest({
    chatError: new ApiError('Test chat error', 500),
    productsError: 'Test products error',
    conversationsError: new ApiError('Test conversations error', 500),
    ...options,
  });
}

/**
 * Setup for loading state tests
 */
export function setupLoadingTest(
  options: Partial<SetupOptions> = {}
): TestContext {
  return setupTest({
    chatLoading: true,
    productsLoading: true,
    conversationsLoading: true,
    ...options,
  });
}
