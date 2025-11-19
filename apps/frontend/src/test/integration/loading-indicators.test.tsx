/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import {
  createTestSetup,
  createReactiveMockImplementation,
} from '@/test/reactive-mock-helpers';
import type { ChatMessage } from '@repo/shared-types';

// Mock the hooks
vi.mock('@/hooks/useChat');
vi.mock('@/hooks/useConversations');
vi.mock('@/hooks/useProducts');

import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useProducts } from '@/hooks/useProducts';

describe.sequential(
  'Loading Indicators - Appear and Disappear Correctly',
  () => {
    let chatMock: ReturnType<typeof createTestSetup>['chatMock'];
    let conversationsMock: ReturnType<
      typeof createTestSetup
    >['conversationsMock'];
    let productsMock: ReturnType<typeof createTestSetup>['productsMock'];
    let updateChat: ReturnType<typeof createTestSetup>['updateChat'];

    beforeEach(() => {
      // Ensure clean slate before each test
      cleanup();
      vi.clearAllMocks();

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

      // Create reactive mocks using the helper
      const setup = createTestSetup();
      chatMock = setup.chatMock;
      conversationsMock = setup.conversationsMock;
      productsMock = setup.productsMock;
      updateChat = setup.updateChat;

      // Connect mocks to hooks using the helper function
      vi.mocked(useChat).mockImplementation(
        createReactiveMockImplementation(chatMock)
      );
      vi.mocked(useConversations).mockImplementation(
        createReactiveMockImplementation(conversationsMock)
      );
      vi.mocked(useProducts).mockImplementation(
        createReactiveMockImplementation(productsMock)
      );
    });

    afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

    it('sanity check - mocks return correct values', () => {
      // Verify all mocks are properly set up
      const chatValue = vi.mocked(useChat)();
      const conversationsValue = vi.mocked(useConversations)();
      const productsValue = vi.mocked(useProducts)();

      expect(chatValue).toBeDefined();
      expect(chatValue.messages).toEqual([]);
      expect(chatValue.isLoading).toBe(false);
      expect(typeof chatValue.sendMessage).toBe('function');

      expect(conversationsValue).toBeDefined();
      expect(conversationsValue.conversations).toEqual([]);

      expect(productsValue).toBeDefined();
      expect(productsValue.products).toEqual([]);
    });

    it('loading indicator appears when sending message and disappears when complete', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates loading
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state - this should show the loading indicator
          await updateChat({
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

          await updateChat({
            isLoading: false,
            messages: [newMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state with the mock send function
      await updateChat({
        sendMessage: mockSendMessage,
      });

      // Render component
      render(<ChatInterface />);

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
      await updateChat({
        isLoading: true,
      });

      // Debug: Verify mock is returning correct value
      const mockValue = vi.mocked(useChat)();
      console.log('Mock isLoading:', mockValue.isLoading);
      console.log('Mock functions:', Object.keys(mockValue));
      expect(mockValue.isLoading).toBe(true);

      // Render component
      let container;
      try {
        const result = render(<ChatInterface />);
        container = result.container;
        console.log('Rendered HTML length:', container.innerHTML.length);
      } catch (error) {
        console.error('Render error:', error);
        throw error;
      }

      // VERIFY: Loading indicator is immediately visible
      const loadingSpinner = screen.getByTestId('chat-loading-spinner');
      expect(loadingSpinner).toBeInTheDocument();

      // Clear loading state
      await updateChat({
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
      await updateChat({
        isLoading: true,
      });

      // Render component
      render(<ChatInterface />);

      // Verify loading indicator is visible
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();

      // Clear loading state
      await updateChat({
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
          await updateChat({ isLoading: true });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const newMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
          };

          await updateChat({
            isLoading: false,
            messages: [newMessage],
          });
        });

      await updateChat({ sendMessage: mockSendMessage });
      render(<ChatInterface />);

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
      render(<ChatInterface />);

      // Initially no loading indicator
      expect(
        screen.queryByTestId('chat-loading-spinner')
      ).not.toBeInTheDocument();

      // Set loading state
      await updateChat({ isLoading: true });

      // VERIFY: Loading indicator appears
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      });

      // Clear loading state
      await updateChat({ isLoading: false });

      // VERIFY: Loading indicator disappears
      await waitFor(() => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      });

      // Set loading state again
      await updateChat({ isLoading: true });

      // VERIFY: Loading indicator appears again
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      });

      // Clear loading state again
      await updateChat({ isLoading: false });

      // VERIFY: Loading indicator disappears again
      await waitFor(() => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      });
    });
  }
);
