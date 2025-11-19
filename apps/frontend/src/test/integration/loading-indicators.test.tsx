/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { setupTest } from '@/test/enhanced-setup';
import type { ChatMessage } from '@repo/shared-types';

// Mock the hooks to use our reactive infrastructure
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
}));

import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useProducts } from '@/hooks/useProducts';

describe.sequential(
  'Loading Indicators - Appear and Disappear Correctly',
  () => {
    let testContext: ReturnType<typeof setupTest>;

    beforeEach(() => {
      // Ensure clean slate before each test
      cleanup();

      // Clear and reset all mocks
      vi.clearAllMocks();
      vi.mocked(useChat).mockReset();
      vi.mocked(useConversations).mockReset();
      vi.mocked(useProducts).mockReset();

      // Mock DOM APIs
      Element.prototype.scrollIntoView = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
        },
        writable: true,
        configurable: true,
      });

      // Setup test with reactive mocks
      testContext = setupTest({
        initialChatMessages: [],
        initialConversations: [],
        initialProducts: [],
        chatLoading: false,
        productsLoading: false,
        conversationsLoading: false,
        chatError: null,
        productsError: null,
        conversationsError: null,
        enableAutoCleanup: false,
        enableLazyMocks: false,
        enablePerformanceOptimization: false,
        enableDOMOptimization: false,
      });

      // Connect mocks to hook implementations
      vi.mocked(useChat).mockImplementation(testContext.chatMock.getMock());
      vi.mocked(useConversations).mockImplementation(
        testContext.conversationsMock.getMock()
      );
      vi.mocked(useProducts).mockImplementation(
        testContext.productsMock.getMock()
      );
    });

    afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

    it('loading indicator appears when sending message and disappears when complete', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates loading
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state - this should show the loading indicator
          await testContext.updateChat({
            isLoading: true,
            error: null,
          });

          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Complete loading with new messages
          const newMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
          };

          const responseMessage: ChatMessage = {
            id: 'msg-2',
            content: `Response to: ${content}`,
            role: 'assistant',
            timestamp: new Date(),
          };

          await testContext.updateChat({
            isLoading: false,
            messages: [newMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state with the mock send function
      await testContext.updateChat({
        sendMessage: mockSendMessage,
      });

      // Render component
      testContext.renderComponent(<ChatInterface />);

      // Get input and send button
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Type a message
      await user.type(input, 'Test message');

      // Send the message
      await user.click(sendButton);

      // VERIFY: Loading indicator appears
      await waitFor(
        () => {
          const loadingSpinner = screen.getByTestId('chat-loading-spinner');
          expect(loadingSpinner).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // VERIFY: Loading indicator disappears when complete
      await waitFor(
        () => {
          const loadingSpinner = screen.queryByTestId('chat-loading-spinner');
          expect(loadingSpinner).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // VERIFY: Messages appear after loading completes
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Response to: Test message')).toBeInTheDocument();
    });

    it('loading indicator appears immediately when isLoading is set to true', async () => {
      // Set loading state BEFORE rendering
      await testContext.updateChat({
        isLoading: true,
      });

      // Render component
      testContext.renderComponent(<ChatInterface />);

      // VERIFY: Loading indicator is immediately visible
      const loadingSpinner = screen.getByTestId('chat-loading-spinner');
      expect(loadingSpinner).toBeInTheDocument();

      // Clear loading state
      await testContext.updateChat({
        isLoading: false,
      });

      // VERIFY: Loading indicator disappears
      await waitFor(() => {
        const loadingSpinner = screen.queryByTestId('chat-loading-spinner');
        expect(loadingSpinner).not.toBeInTheDocument();
      });
    });

    it('loading indicator disappears immediately when isLoading is set to false', async () => {
      // Start with loading state
      await testContext.updateChat({
        isLoading: true,
      });

      // Render component
      testContext.renderComponent(<ChatInterface />);

      // Verify loading indicator is visible
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();

      // Clear loading state
      await testContext.updateChat({
        isLoading: false,
      });

      // VERIFY: Loading indicator disappears immediately
      await waitFor(
        () => {
          const loadingSpinner = screen.queryByTestId('chat-loading-spinner');
          expect(loadingSpinner).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('loading indicator does not timeout during normal operations', async () => {
      const user = userEvent.setup();

      // Set up mock send function with realistic timing
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await testContext.updateChat({ isLoading: true });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const newMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
          };

          await testContext.updateChat({
            isLoading: false,
            messages: [newMessage],
          });
        });

      await testContext.updateChat({ sendMessage: mockSendMessage });
      testContext.renderComponent(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test');
      await user.click(sendButton);

      // VERIFY: Loading indicator appears
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      });

      // VERIFY: Loading indicator disappears within reasonable time (no timeout)
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // VERIFY: Message appears
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('handles multiple loading state transitions correctly', async () => {
      // Render component
      testContext.renderComponent(<ChatInterface />);

      // Initially no loading indicator
      expect(
        screen.queryByTestId('chat-loading-spinner')
      ).not.toBeInTheDocument();

      // Set loading state
      await testContext.updateChat({ isLoading: true });

      // VERIFY: Loading indicator appears
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      });

      // Clear loading state
      await testContext.updateChat({ isLoading: false });

      // VERIFY: Loading indicator disappears
      await waitFor(() => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      });

      // Set loading state again
      await testContext.updateChat({ isLoading: true });

      // VERIFY: Loading indicator appears again
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      });

      // Clear loading state again
      await testContext.updateChat({ isLoading: false });

      // VERIFY: Loading indicator disappears again
      await waitFor(() => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      });
    });
  }
);
