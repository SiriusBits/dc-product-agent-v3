/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { ReactiveHookMock } from '@/test/reactive-mocks';
import { ApiError } from '@/lib/api-client';
import type { ChatMessage, Conversation } from '@repo/shared-types';

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

describe('Loading State Management Fixes', () => {
  let chatMock: ReactiveHookMock<any>;
  let conversationsMock: ReactiveHookMock<any>;
  let productsMock: ReactiveHookMock<unknown>;

  beforeEach(() => {
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

    // Create reactive mocks directly
    chatMock = new ReactiveHookMock({
      messages: [],
      conversationId: null,
      isLoading: false,
      error: null,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      retryLastMessage: vi.fn(),
      isRetryable: false,
    });

    conversationsMock = new ReactiveHookMock({
      conversations: [],
      isLoading: false,
      error: null,
      loadConversations: vi.fn(),
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      loadConversation: vi.fn(),
    });

    productsMock = new ReactiveHookMock({
      products: [],
      isLoading: false,
      error: null,
      searchProducts: vi.fn(),
      clearSearch: vi.fn(),
    });

    // Set up the mocks
    vi.mocked(useChat).mockImplementation(chatMock.getMock());
    vi.mocked(useConversations).mockImplementation(conversationsMock.getMock());
    vi.mocked(useProducts).mockImplementation(productsMock.getMock());
  });

  afterEach(() => {
    chatMock?.reset();
    conversationsMock?.reset();
    productsMock?.reset();
    vi.clearAllMocks();
  });

  describe('Loading State Transitions', () => {
    it('properly manages loading states during message sending', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates loading
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Complete loading with new message
          const newMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
          };

          const responseMessage: ChatMessage = {
            id: 'msg-2',
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
          };

          await chatMock.updateValue({
            isLoading: false,
            messages: [newMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Initially, input should be enabled but send button disabled (no message)
      expect(input).not.toBeDisabled();
      expect(sendButton).toBeDisabled();

      // Type a message
      await user.type(input, 'What is ASA 150?');
      expect(input).toHaveValue('What is ASA 150?');

      // Now send button should be enabled
      expect(sendButton).not.toBeDisabled();

      // Send the message
      await user.click(sendButton);

      // During loading, input and button should be disabled
      await waitFor(
        () => {
          expect(input).toBeDisabled();
          expect(sendButton).toBeDisabled();
        },
        { timeout: 500 }
      );

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
          expect(sendButton).not.toBeDisabled();
        },
        { timeout: 1000 }
      );

      // Input should be cleared
      expect(input).toHaveValue('');

      // Messages should appear
      expect(screen.getByText('What is ASA 150?')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: What is ASA 150?')
      ).toBeInTheDocument();
    });

    it('handles loading states with proper timeouts', async () => {
      const user = userEvent.setup();

      // Set up mock send function with timeout handling
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate async operation with timeout
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Complete loading
          await chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Verify loading state is active
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Wait for operation to complete within timeout
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
          expect(sendButton).not.toBeDisabled();
        },
        { timeout: 1000 }
      );
    });

    it('prevents concurrent message sending', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates loading
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate longer async operation
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Complete loading
          await chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send first message
      await user.type(input, 'First message');
      await user.click(sendButton);

      // Verify loading state
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Try to send another message while loading (should be prevented)
      expect(input).toHaveValue(''); // Input should be cleared
      expect(sendButton).toBeDisabled(); // Button should remain disabled

      // Wait for first message to complete
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
          expect(sendButton).not.toBeDisabled();
        },
        { timeout: 1000 }
      );

      // Verify first message appeared
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: First message')
      ).toBeInTheDocument();
    });

    it('handles conversation loading states', async () => {
      const user = userEvent.setup();

      // Setup with existing conversations
      const existingConversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Existing Conversation',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockLoadConversation = vi
        .fn()
        .mockImplementation(async (id: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate loading conversation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Complete loading with conversation messages
          await chatMock.updateValue({
            isLoading: false,
            conversationId: id,
            messages: [
              {
                id: 'msg-1',
                content: 'Previous message',
                role: 'user',
                timestamp: new Date(),
              },
            ],
            error: null,
          });
        });

      // Set initial state with conversations
      await conversationsMock.updateValue({
        conversations: existingConversations,
        isLoading: false,
        error: null,
        loadConversation: mockLoadConversation,
      });

      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      // Conversation should appear in sidebar
      await waitFor(() => {
        expect(screen.getByText('Existing Conversation')).toBeInTheDocument();
      });

      // Click on conversation to load it
      const conversationItem = screen.getByText('Existing Conversation');
      await user.click(conversationItem);

      // Wait for conversation to load
      await waitFor(
        () => {
          expect(screen.getByText('Previous message')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('handles new conversation creation with loading states', async () => {
      const user = userEvent.setup();

      const mockClearMessages = vi.fn().mockImplementation(async () => {
        // Set loading state
        await chatMock.updateValue({
          isLoading: true,
          error: null,
        });

        // Simulate clearing messages
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Complete loading
        await chatMock.updateValue({
          isLoading: false,
          messages: [],
          conversationId: null,
          error: null,
        });
      });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        clearMessages: mockClearMessages,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      // Click new conversation button
      const newButton = screen.getByRole('button', { name: /new/i });
      await user.click(newButton);

      // Wait for conversation creation to complete
      await waitFor(
        () => {
          // Check that loading has completed by verifying the mock was called
          expect(mockClearMessages).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Error Handling with Loading States', () => {
    it('clears loading states when errors occur', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates error
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate error after delay
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Set error state and clear loading
          await chatMock.updateValue({
            isLoading: false,
            error: new ApiError('Network error', 0),
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Input should be enabled again after error (not disabled by error)
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('handles timeout errors properly', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates timeout
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // Set loading state
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate timeout - loading should clear after timeout
          setTimeout(async () => {
            await chatMock.updateValue({
              isLoading: false,
              error: new ApiError('Request timeout', 408),
            });
          }, 100);
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Wait for timeout to occur
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Input should be enabled again
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Complex Loading Scenarios', () => {
    it('handles multiple concurrent operations', async () => {
      const user = userEvent.setup();

      const mockClearMessages = vi.fn().mockImplementation(async () => {
        await chatMock.updateValue({
          isLoading: true,
          error: null,
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        await chatMock.updateValue({
          isLoading: false,
          messages: [],
          conversationId: null,
          error: null,
        });
      });

      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 100));

          await chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        clearMessages: mockClearMessages,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      // Start multiple operations
      const newChatButton = screen.getByRole('button', { name: /new/i });
      await user.click(newChatButton); // Create conversation

      // Don't wait, immediately try to send a message
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await user.type(input, 'Quick message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton); // Send message

      // Wait for all operations to complete
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
          expect(sendButton).not.toBeDisabled();
        },
        { timeout: 1000 }
      );
    });

    it('maintains loading state consistency across re-renders', async () => {
      const user = userEvent.setup();

      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          await chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Start a message send
      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Verify loading state
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Force re-render
      rerender(<ChatInterface />);

      // Loading state should persist across re-render
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      // Wait for operation to complete
      await waitFor(
        () => {
          expect(input).not.toBeDisabled();
          expect(sendButton).not.toBeDisabled();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Loading State Performance', () => {
    it('completes loading operations within reasonable time', async () => {
      const user = userEvent.setup();

      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 100));

          const newMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
          };

          const responseMessage: ChatMessage = {
            id: 'msg-2',
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
          };

          await chatMock.updateValue({
            isLoading: false,
            messages: [newMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const startTime = Date.now();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Performance test message');
      await user.click(sendButton);

      // Wait for operation to complete
      await waitFor(
        () => {
          expect(
            screen.getByText('Performance test message')
          ).toBeInTheDocument();
          expect(
            screen.getByText('Response to: Performance test message')
          ).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('does not block interface indefinitely', async () => {
      const user = userEvent.setup();

      let messageCount = 0;
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 50));

          messageCount++;
          const newMessage: ChatMessage = {
            id: `msg-${messageCount}`,
            content,
            role: 'user',
            timestamp: new Date(),
          };

          const responseMessage: ChatMessage = {
            id: `msg-${messageCount + 100}`,
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
          };

          await chatMock.updateValue({
            isLoading: false,
            messages: [
              ...(chatMock.getValue().messages || []),
              newMessage,
              responseMessage,
            ],
            error: null,
          });
        });

      // Set initial state
      await chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<ChatInterface />);
      rerender(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send multiple messages in sequence
      for (let i = 1; i <= 3; i++) {
        await user.type(input, `Message ${i}`);
        await user.click(sendButton);

        // Wait for this message to complete before sending next
        await waitFor(
          () => {
            expect(screen.getByText(`Message ${i}`)).toBeInTheDocument();
            expect(
              screen.getByText(`Response to: Message ${i}`)
            ).toBeInTheDocument();
          },
          { timeout: 1000 }
        );
      }

      // Interface should be responsive
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });
});
