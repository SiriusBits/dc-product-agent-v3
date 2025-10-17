/**
 * Integration tests for enhanced setupTest function
 *
 * These tests verify that the setupTest function correctly:
 * - Creates all required reactive mocks
 * - Provides working update helpers that trigger re-renders
 * - Provides enhanced renderComponent utility
 * - Handles automatic cleanup between tests
 * - Respects custom options and overrides
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import {
  setupTest,
  setupChatFlowTest,
  setupProductSearchTest,
  setupErrorTest,
  setupLoadingTest,
  type SetupOptions,
} from '../enhanced-setup';
import { mockRegistry } from '../reactive-mocks';
import { ApiError } from '@/lib/api-client';
import type {
  ChatMessage,
  Conversation,
  ProductSummary,
} from '@repo/shared-types';

// ============================================================================
// Test Data
// ============================================================================

const mockChatMessage: ChatMessage = {
  id: 'test-1',
  content: 'Test message',
  role: 'user',
  timestamp: new Date(),
  conversation_id: 'conv-1',
};

const mockConversation: Conversation = {
  id: 'conv-1',
  title: 'Test Conversation',
  created_at: new Date(),
  updated_at: new Date(),
  messages: [],
};

const mockProduct: ProductSummary = {
  id: 'prod-1',
  name: 'Test Product',
  family: 'Test Family',
  applications: ['Test App'],
  description: 'Test Description',
};

// ============================================================================
// Simple Test Component
// ============================================================================

/**
 * Simple test component that displays mock state
 */
function SimpleTestComponent() {
  const chatMock = mockRegistry.get('useChat');
  const productsMock = mockRegistry.get('useProducts');
  const conversationsMock = mockRegistry.get('useConversations');

  if (!chatMock || !productsMock || !conversationsMock) {
    return <div data-testid="error">Mocks not found</div>;
  }

  const chatState = chatMock.getCurrentValue();
  const productsState = productsMock.getCurrentValue();
  const conversationsState = conversationsMock.getCurrentValue();

  return (
    <div>
      <div data-testid="chat-messages">{chatState.messages.length}</div>
      <div data-testid="chat-loading">
        {chatState.isLoading ? 'loading' : 'idle'}
      </div>
      <div data-testid="products-count">{productsState.products.length}</div>
      <div data-testid="products-loading">
        {productsState.loading ? 'loading' : 'idle'}
      </div>
      <div data-testid="conversations-count">
        {conversationsState.conversations.length}
      </div>
      <div data-testid="conversations-loading">
        {conversationsState.isLoading ? 'loading' : 'idle'}
      </div>
    </div>
  );
}

// ============================================================================
// Main setupTest Tests
// ============================================================================

describe('setupTest', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    // Clear registry before each test
    mockRegistry.clearAll();
  });

  afterEach(() => {
    // Clean up after each test
    mockRegistry.clearAll();
    vi.clearAllMocks();
  });

  describe('mock creation', () => {
    it('should create all required mocks', () => {
      testContext = setupTest();

      expect(testContext.chatMock).toBeDefined();
      expect(testContext.productsMock).toBeDefined();
      expect(testContext.conversationsMock).toBeDefined();
    });

    it('should register mocks with MockRegistry', () => {
      testContext = setupTest();

      expect(mockRegistry.get('useChat')).toBe(testContext.chatMock);
      expect(mockRegistry.get('useProducts')).toBe(testContext.productsMock);
      expect(mockRegistry.get('useConversations')).toBe(
        testContext.conversationsMock
      );
    });

    it('should create mocks with default initial state', () => {
      testContext = setupTest();

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.messages).toEqual([]);
      expect(chatState.isLoading).toBe(false);
      expect(chatState.error).toBe(null);

      expect(productsState.products).toEqual([]);
      expect(productsState.loading).toBe(false);
      expect(productsState.error).toBe(null);

      expect(conversationsState.conversations).toEqual([]);
      expect(conversationsState.isLoading).toBe(false);
      expect(conversationsState.error).toBe(null);
    });

    it('should create mocks with custom initial state', () => {
      const options: SetupOptions = {
        initialChatMessages: [mockChatMessage],
        initialConversations: [mockConversation],
        initialProducts: [mockProduct],
        chatLoading: true,
        productsLoading: true,
        conversationsLoading: true,
      };

      testContext = setupTest(options);

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.messages).toEqual([mockChatMessage]);
      expect(chatState.isLoading).toBe(true);

      expect(productsState.products).toEqual([mockProduct]);
      expect(productsState.loading).toBe(true);

      expect(conversationsState.conversations).toEqual([mockConversation]);
      expect(conversationsState.isLoading).toBe(true);
    });
  });

  describe('update helpers', () => {
    beforeEach(() => {
      testContext = setupTest();
    });

    it('should provide working updateChat helper', async () => {
      const initialState = testContext.chatMock.getCurrentValue();
      expect(initialState.messages).toHaveLength(0);
      expect(initialState.isLoading).toBe(false);

      await testContext.updateChat({
        messages: [mockChatMessage],
        isLoading: true,
      });

      const updatedState = testContext.chatMock.getCurrentValue();
      expect(updatedState.messages).toHaveLength(1);
      expect(updatedState.messages[0]).toEqual(mockChatMessage);
      expect(updatedState.isLoading).toBe(true);
    });

    it('should provide working updateProducts helper', async () => {
      const initialState = testContext.productsMock.getCurrentValue();
      expect(initialState.products).toHaveLength(0);
      expect(initialState.loading).toBe(false);

      await testContext.updateProducts({
        products: [mockProduct],
        loading: true,
      });

      const updatedState = testContext.productsMock.getCurrentValue();
      expect(updatedState.products).toHaveLength(1);
      expect(updatedState.products[0]).toEqual(mockProduct);
      expect(updatedState.loading).toBe(true);
    });

    it('should provide working updateConversations helper', async () => {
      const initialState = testContext.conversationsMock.getCurrentValue();
      expect(initialState.conversations).toHaveLength(0);
      expect(initialState.isLoading).toBe(false);

      await testContext.updateConversations({
        conversations: [mockConversation],
        isLoading: true,
      });

      const updatedState = testContext.conversationsMock.getCurrentValue();
      expect(updatedState.conversations).toHaveLength(1);
      expect(updatedState.conversations[0]).toEqual(mockConversation);
      expect(updatedState.isLoading).toBe(true);
    });

    it('should update mock state that components can read', async () => {
      const { renderComponent, updateChat } = testContext;

      const { rerender } = renderComponent(<SimpleTestComponent />);

      expect(screen.getByTestId('chat-messages')).toHaveTextContent('0');
      expect(screen.getByTestId('chat-loading')).toHaveTextContent('idle');

      await updateChat({
        messages: [mockChatMessage],
        isLoading: true,
      });

      // Re-render the same component to pick up the new state
      rerender(<SimpleTestComponent />);

      expect(screen.getByTestId('chat-messages')).toHaveTextContent('1');
      expect(screen.getByTestId('chat-loading')).toHaveTextContent('loading');
    });

    it('should handle multiple sequential updates', async () => {
      await testContext.updateChat({ isLoading: true });
      await testContext.updateChat({ messages: [mockChatMessage] });
      await testContext.updateChat({ isLoading: false });

      const finalState = testContext.chatMock.getCurrentValue();
      expect(finalState.messages).toHaveLength(1);
      expect(finalState.isLoading).toBe(false);
    });
  });

  describe('renderComponent utility', () => {
    beforeEach(() => {
      testContext = setupTest();
    });

    it('should provide enhanced renderComponent function', () => {
      const { renderComponent } = testContext;

      expect(typeof renderComponent).toBe('function');

      const result = renderComponent(<div data-testid="test">Test</div>);

      expect(result).toBeDefined();
      expect(result.getByTestId).toBeDefined();
      expect(screen.getByTestId('test')).toHaveTextContent('Test');
    });

    it('should handle multiple component renders', () => {
      const { renderComponent } = testContext;

      renderComponent(<div data-testid="test1">Test 1</div>);
      renderComponent(<div data-testid="test2">Test 2</div>);

      expect(screen.getByTestId('test1')).toHaveTextContent('Test 1');
      expect(screen.getByTestId('test2')).toHaveTextContent('Test 2');
    });

    it('should work with components that use mocked hooks', () => {
      const { renderComponent } = testContext;

      const result = renderComponent(<SimpleTestComponent />);

      expect(result.getByTestId('chat-messages')).toHaveTextContent('0');
      expect(result.getByTestId('chat-loading')).toHaveTextContent('idle');
      expect(result.getByTestId('products-count')).toHaveTextContent('0');
    });
  });

  describe('storage mocks', () => {
    it('should create localStorage mock when requested', () => {
      testContext = setupTest({ mockLocalStorage: true });

      expect(testContext.localStorage).toBeDefined();
      expect(typeof testContext.localStorage?.getItem).toBe('function');
      expect(typeof testContext.localStorage?.setItem).toBe('function');
    });

    it('should create sessionStorage mock when requested', () => {
      testContext = setupTest({ mockSessionStorage: true });

      expect(testContext.sessionStorage).toBeDefined();
      expect(typeof testContext.sessionStorage?.getItem).toBe('function');
      expect(typeof testContext.sessionStorage?.setItem).toBe('function');
    });

    it('should not create storage mocks by default', () => {
      testContext = setupTest();

      expect(testContext.localStorage).toBeUndefined();
      expect(testContext.sessionStorage).toBeUndefined();
    });

    it('should provide working localStorage mock', () => {
      testContext = setupTest({ mockLocalStorage: true });

      const { localStorage } = testContext;

      localStorage?.setItem('test-key', 'test-value');
      expect(localStorage?.getItem('test-key')).toBe('test-value');

      localStorage?.removeItem('test-key');
      expect(localStorage?.getItem('test-key')).toBe(null);
    });
  });

  describe('automatic cleanup', () => {
    it('should reset mocks between tests when auto-cleanup enabled', async () => {
      // First test setup
      testContext = setupTest({
        initialChatMessages: [mockChatMessage],
        enableAutoCleanup: true,
      });

      await testContext.updateChat({ isLoading: true });

      let chatState = testContext.chatMock.getCurrentValue();
      expect(chatState.messages).toHaveLength(1);
      expect(chatState.isLoading).toBe(true);

      // Simulate afterEach cleanup by manually calling reset
      mockRegistry.resetAll();

      // Verify state was reset
      chatState = testContext.chatMock.getCurrentValue();
      expect(chatState.messages).toHaveLength(1); // Back to initial
      expect(chatState.isLoading).toBe(false); // Back to initial
    });

    it('should not interfere when auto-cleanup disabled', async () => {
      testContext = setupTest({
        initialChatMessages: [mockChatMessage],
        enableAutoCleanup: false,
      });

      await testContext.updateChat({ isLoading: true });

      const chatState = testContext.chatMock.getCurrentValue();
      expect(chatState.messages).toHaveLength(1);
      expect(chatState.isLoading).toBe(true);

      // State should remain unchanged without cleanup
    });
  });

  describe('custom options override', () => {
    it('should override default values with custom options', () => {
      const customError = new ApiError('Custom error', 400);

      testContext = setupTest({
        chatError: customError,
        productsError: 'Custom products error',
        conversationsError: customError,
        chatLoading: true,
        productsLoading: true,
        conversationsLoading: true,
      });

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.error).toBe(customError);
      expect(chatState.isLoading).toBe(true);

      expect(productsState.error).toBe('Custom products error');
      expect(productsState.loading).toBe(true);

      expect(conversationsState.error).toBe(customError);
      expect(conversationsState.isLoading).toBe(true);
    });

    it('should handle partial options correctly', () => {
      testContext = setupTest({
        initialChatMessages: [mockChatMessage],
        // Only override chat, leave others as defaults
      });

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();

      expect(chatState.messages).toEqual([mockChatMessage]);
      expect(productsState.products).toEqual([]); // Default
    });
  });
});

// ============================================================================
// Specialized Setup Function Tests
// ============================================================================

describe('specialized setup functions', () => {
  afterEach(() => {
    mockRegistry.clearAll();
    vi.clearAllMocks();
  });

  describe('setupChatFlowTest', () => {
    it('should create setup optimized for chat flow testing', () => {
      const testContext = setupChatFlowTest();

      expect(testContext.chatMock).toBeDefined();
      expect(testContext.conversationsMock).toBeDefined();
      expect(testContext.localStorage).toBeDefined();

      const chatState = testContext.chatMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.messages).toEqual([]);
      expect(chatState.isLoading).toBe(false);
      expect(conversationsState.conversations).toEqual([]);
      expect(conversationsState.isLoading).toBe(false);
    });

    it('should accept custom options', () => {
      const testContext = setupChatFlowTest({
        initialChatMessages: [mockChatMessage],
        chatLoading: true,
      });

      const chatState = testContext.chatMock.getCurrentValue();
      expect(chatState.messages).toEqual([mockChatMessage]);
      expect(chatState.isLoading).toBe(true);
    });
  });

  describe('setupProductSearchTest', () => {
    it('should create setup optimized for product search testing', () => {
      const testContext = setupProductSearchTest();

      expect(testContext.productsMock).toBeDefined();
      expect(testContext.sessionStorage).toBeDefined();

      const productsState = testContext.productsMock.getCurrentValue();
      expect(productsState.products).toEqual([]);
      expect(productsState.loading).toBe(false);
    });

    it('should accept custom options', () => {
      const testContext = setupProductSearchTest({
        initialProducts: [mockProduct],
        productsLoading: true,
      });

      const productsState = testContext.productsMock.getCurrentValue();
      expect(productsState.products).toEqual([mockProduct]);
      expect(productsState.loading).toBe(true);
    });
  });

  describe('setupErrorTest', () => {
    it('should create setup with error states', () => {
      const testContext = setupErrorTest();

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.error).toBeInstanceOf(ApiError);
      expect(chatState.error?.message).toBe('Test chat error');

      expect(productsState.error).toBe('Test products error');

      expect(conversationsState.error).toBeInstanceOf(ApiError);
      expect(conversationsState.error?.message).toBe(
        'Test conversations error'
      );
    });

    it('should accept custom error options', () => {
      const customError = new ApiError('Custom test error', 404);

      const testContext = setupErrorTest({
        chatError: customError,
      });

      const chatState = testContext.chatMock.getCurrentValue();
      expect(chatState.error).toBe(customError);
      expect(chatState.error?.message).toBe('Custom test error');
    });
  });

  describe('setupLoadingTest', () => {
    it('should create setup with loading states', () => {
      const testContext = setupLoadingTest();

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();
      const conversationsState =
        testContext.conversationsMock.getCurrentValue();

      expect(chatState.isLoading).toBe(true);
      expect(productsState.loading).toBe(true);
      expect(conversationsState.isLoading).toBe(true);
    });

    it('should accept custom loading options', () => {
      const testContext = setupLoadingTest({
        chatLoading: false, // Override default
      });

      const chatState = testContext.chatMock.getCurrentValue();
      const productsState = testContext.productsMock.getCurrentValue();

      expect(chatState.isLoading).toBe(false); // Overridden
      expect(productsState.loading).toBe(true); // Default
    });
  });
});
