/**
 * Tests for test utility setup functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupMocks,
  updateMockHook,
  resetMocks,
  mockUseChat,
  mockUseProducts,
  mockUseConversations,
} from './test-utils';
import {
  createMockMessage,
  createMockProduct,
  createMockConversation,
  createMockApiError,
} from './standardized-mocks';

describe('Test Utility Setup Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset mocks after each test
    resetMocks();
  });

  describe('setupMocks', () => {
    it('initializes all hook mocks with default values', () => {
      setupMocks();

      // Call the mocks to get their return values
      const chatReturn = mockUseChat();
      const productsReturn = mockUseProducts();
      const conversationsReturn = mockUseConversations();

      expect(chatReturn).toBeDefined();
      expect(chatReturn.messages).toEqual([]);
      expect(chatReturn.isLoading).toBe(false);
      expect(chatReturn.error).toBeNull();

      expect(productsReturn).toBeDefined();
      expect(productsReturn.products).toEqual([]);
      expect(productsReturn.loading).toBe(false);
      expect(productsReturn.error).toBeNull();

      expect(conversationsReturn).toBeDefined();
      expect(conversationsReturn.conversations).toEqual([]);
      expect(conversationsReturn.isLoading).toBe(false);
      expect(conversationsReturn.error).toBeNull();
    });

    it('allows customizing useChat mock', () => {
      const messages = [createMockMessage()];
      setupMocks({
        useChat: {
          messages,
          isLoading: true,
        },
      });

      const chatReturn = mockUseChat();
      expect(chatReturn.messages).toBe(messages);
      expect(chatReturn.isLoading).toBe(true);
    });

    it('allows customizing useProducts mock', () => {
      const products = [createMockProduct()];
      setupMocks({
        useProducts: {
          products,
          loading: true,
          totalCount: 10,
        },
      });

      const productsReturn = mockUseProducts();
      expect(productsReturn.products).toBe(products);
      expect(productsReturn.loading).toBe(true);
      expect(productsReturn.totalCount).toBe(10);
    });

    it('allows customizing useConversations mock', () => {
      const conversations = [createMockConversation()];
      setupMocks({
        useConversations: {
          conversations,
          isLoading: true,
        },
      });

      const conversationsReturn = mockUseConversations();
      expect(conversationsReturn.conversations).toBe(conversations);
      expect(conversationsReturn.isLoading).toBe(true);
    });

    it('returns mock references', () => {
      const mocks = setupMocks();

      expect(mocks.mockUseChat).toBe(mockUseChat);
      expect(mocks.mockUseProducts).toBe(mockUseProducts);
      expect(mocks.mockUseConversations).toBe(mockUseConversations);
    });
  });

  describe('updateMockHook', () => {
    beforeEach(() => {
      // Setup initial mocks
      setupMocks();
    });

    it('updates useChat mock with new values', () => {
      const newMessages = [createMockMessage(), createMockMessage()];
      updateMockHook('useChat', {
        messages: newMessages,
        isLoading: true,
      });

      const chatReturn = mockUseChat();
      expect(chatReturn.messages).toBe(newMessages);
      expect(chatReturn.isLoading).toBe(true);
      // Other properties should remain unchanged
      expect(chatReturn.error).toBeNull();
    });

    it('updates useProducts mock with new values', () => {
      const newProducts = [createMockProduct()];
      updateMockHook('useProducts', {
        products: newProducts,
        loading: true,
      });

      const productsReturn = mockUseProducts();
      expect(productsReturn.products).toBe(newProducts);
      expect(productsReturn.loading).toBe(true);
      // Other properties should remain unchanged
      expect(productsReturn.error).toBeNull();
    });

    it('updates useConversations mock with new values', () => {
      const newConversations = [createMockConversation()];
      updateMockHook('useConversations', {
        conversations: newConversations,
        isLoading: true,
      });

      const conversationsReturn = mockUseConversations();
      expect(conversationsReturn.conversations).toBe(newConversations);
      expect(conversationsReturn.isLoading).toBe(true);
      // Other properties should remain unchanged
      expect(conversationsReturn.error).toBeNull();
    });

    it('preserves existing values when updating', () => {
      // Setup with custom initial values
      setupMocks({
        useChat: {
          conversationId: 'test-conv-123',
          isRetryable: true,
        },
      });

      // Update only messages
      const newMessages = [createMockMessage()];
      updateMockHook('useChat', {
        messages: newMessages,
      });

      const chatReturn = mockUseChat();
      expect(chatReturn.messages).toBe(newMessages);
      expect(chatReturn.conversationId).toBe('test-conv-123');
      expect(chatReturn.isRetryable).toBe(true);
    });
  });

  describe('resetMocks', () => {
    it('clears all mocks', () => {
      // Setup mocks with custom values
      setupMocks({
        useChat: {
          messages: [createMockMessage()],
          isLoading: true,
        },
      });

      // Reset
      resetMocks();

      // Verify mocks are cleared
      expect(mockUseChat.mock.calls).toHaveLength(0);
      expect(mockUseProducts.mock.calls).toHaveLength(0);
      expect(mockUseConversations.mock.calls).toHaveLength(0);
    });

    it('resets mocks to default values', () => {
      // Setup mocks with custom values
      setupMocks({
        useChat: {
          messages: [createMockMessage()],
          isLoading: true,
        },
      });

      // Reset
      resetMocks();

      // Verify mocks have default values
      const chatReturn = mockUseChat();
      expect(chatReturn.messages).toEqual([]);
      expect(chatReturn.isLoading).toBe(false);
      expect(chatReturn.error).toBeNull();
    });

    it('clears localStorage and sessionStorage', () => {
      // Add some data to storage
      localStorage.setItem('test-key', 'test-value');
      sessionStorage.setItem('test-key', 'test-value');

      // Reset
      resetMocks();

      // Verify storage is cleared
      expect(localStorage.getItem('test-key')).toBeNull();
      expect(sessionStorage.getItem('test-key')).toBeNull();
    });
  });

  describe('Integration: setupMocks -> updateMockHook -> resetMocks', () => {
    it('works correctly in sequence', () => {
      // 1. Setup initial mocks
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
        },
      });

      let chatReturn = mockUseChat();
      expect(chatReturn.messages).toEqual([]);
      expect(chatReturn.isLoading).toBe(false);

      // 2. Update mock to simulate loading
      updateMockHook('useChat', {
        isLoading: true,
      });

      chatReturn = mockUseChat();
      expect(chatReturn.isLoading).toBe(true);

      // 3. Update mock to simulate loaded state
      const messages = [createMockMessage()];
      updateMockHook('useChat', {
        messages,
        isLoading: false,
      });

      chatReturn = mockUseChat();
      expect(chatReturn.messages).toBe(messages);
      expect(chatReturn.isLoading).toBe(false);

      // 4. Reset for next test
      resetMocks();

      chatReturn = mockUseChat();
      expect(chatReturn.messages).toEqual([]);
      expect(chatReturn.isLoading).toBe(false);
    });
  });

  describe('Error state handling', () => {
    it('can set and update error states', () => {
      const error = createMockApiError('Test error', 500);

      setupMocks({
        useChat: {
          error,
          isRetryable: true,
        },
      });

      const chatReturn = mockUseChat();
      expect(chatReturn.error).toBe(error);
      expect(chatReturn.isRetryable).toBe(true);
    });

    it('can clear error states', () => {
      // Setup with error
      setupMocks({
        useChat: {
          error: createMockApiError('Test error', 500),
          isRetryable: true,
        },
      });

      // Clear error
      updateMockHook('useChat', {
        error: null,
        isRetryable: false,
      });

      const chatReturn = mockUseChat();
      expect(chatReturn.error).toBeNull();
      expect(chatReturn.isRetryable).toBe(false);
    });
  });
});
