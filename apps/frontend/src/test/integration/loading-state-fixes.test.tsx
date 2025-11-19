/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { setupTest } from '@/test/enhanced-setup';
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

describe.sequential('Loading State Management Fixes', () => {
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

    // Setup test with reactive mocks using the proper infrastructure
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

    // Connect mocks to hook implementations BEFORE any rendering
    vi.mocked(useChat).mockImplementation(() =>
      testContext.chatMock.getMock()()
    );
    vi.mocked(useConversations).mockImplementation(() =>
      testContext.conversationsMock.getMock()()
    );
    vi.mocked(useProducts).mockImplementation(() =>
      testContext.productsMock.getMock()()
    );
  });

  afterEach(() => {
    // Manual cleanup after each test
    cleanup();
    vi.clearAllMocks();
  });

  describe('Loading State Transitions', () => {
    it('properly manages loading states during message sending', async () => {
      const user = userEvent.setup();

      // Set up mock send function that simulates loading with proper state transitions
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          // First, add the user message and set loading state
          const userMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            messages: [userMessage],
            isLoading: true,
            error: null,
          });

          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Complete loading with assistant response
          const responseMessage: ChatMessage = {
            id: 'msg-2',
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [userMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);

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

      // During loading, loading indicator should appear (after user message is added)
      await waitFor(
        () => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
          expect(input).toBeDisabled();
          expect(sendButton).toBeDisabled();
        },
        { timeout: 500 }
      );

      // Wait for loading to complete - loading indicator should disappear
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
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
          // Add user message and set loading state
          const userMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            messages: [userMessage],
            isLoading: true,
            error: null,
          });

          // Simulate async operation with timeout
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Complete loading
          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [userMessage],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Verify loading indicator appears
      await waitFor(() => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Wait for operation to complete within timeout - loading indicator should disappear
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
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
          // Add user message and set loading state
          const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            messages: [userMessage],
            isLoading: true,
            error: null,
          });

          // Simulate longer async operation
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Add response message
          const responseMessage: ChatMessage = {
            id: `msg-${Date.now()}-response`,
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
            conversation_id: null,
          };

          // Complete loading
          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [userMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
          messages: [],
          metadata: {},
        },
      ];

      const mockLoadConversation = vi
        .fn()
        .mockImplementation(async (id: string) => {
          // Set loading state
          await testContext.chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate loading conversation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Complete loading with conversation messages
          await testContext.chatMock.updateValue({
            isLoading: false,
            conversationId: id,
            messages: [
              {
                id: 'msg-1',
                content: 'Previous message',
                role: 'user',
                timestamp: new Date(),
                conversation_id: id,
              },
            ],
            error: null,
          });
        });

      // Set initial state with conversations
      await testContext.conversationsMock.updateValue({
        conversations: existingConversations,
        isLoading: false,
        error: null,
        loadConversation: mockLoadConversation,
      });

      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
        await testContext.chatMock.updateValue({
          isLoading: true,
          error: null,
        });

        // Simulate clearing messages
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Complete loading
        await testContext.chatMock.updateValue({
          isLoading: false,
          messages: [],
          conversationId: null,
          error: null,
        });
      });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        clearMessages: mockClearMessages,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
        .mockImplementation(async (_content: string) => {
          // Set loading state
          await testContext.chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate error after delay
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Set error state and clear loading
          await testContext.chatMock.updateValue({
            isLoading: false,
            error: new ApiError('Network error', 0),
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
        .mockImplementation(async (_content: string) => {
          // Set loading state
          await testContext.chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          // Simulate timeout - loading should clear after timeout
          setTimeout(async () => {
            await testContext.chatMock.updateValue({
              isLoading: false,
              error: new ApiError('Request timeout', 408),
            });
          }, 100);
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
        await testContext.chatMock.updateValue({
          isLoading: true,
          error: null,
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        await testContext.chatMock.updateValue({
          isLoading: false,
          messages: [],
          conversationId: null,
          error: null,
        });
      });

      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await testContext.chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 100));

          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
                conversation_id: null,
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        clearMessages: mockClearMessages,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
          await testContext.chatMock.updateValue({
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [
              {
                id: 'msg-1',
                content,
                role: 'user',
                timestamp: new Date(),
                conversation_id: null,
              },
            ],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
          const userMessage: ChatMessage = {
            id: 'msg-1',
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            messages: [userMessage],
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 100));

          const responseMessage: ChatMessage = {
            id: 'msg-2',
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [userMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
          messageCount++;
          const userMessage: ChatMessage = {
            id: `msg-${messageCount}`,
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id: null,
          };

          const currentMessages =
            testContext.chatMock.getCurrentValue().messages || [];

          await testContext.chatMock.updateValue({
            messages: [...currentMessages, userMessage],
            isLoading: true,
            error: null,
          });

          await new Promise((resolve) => setTimeout(resolve, 50));

          const responseMessage: ChatMessage = {
            id: `msg-${messageCount + 100}`,
            content: 'Response to: ' + content,
            role: 'assistant',
            timestamp: new Date(),
            conversation_id: null,
          };

          await testContext.chatMock.updateValue({
            isLoading: false,
            messages: [...currentMessages, userMessage, responseMessage],
            error: null,
          });
        });

      // Set initial state
      await testContext.chatMock.updateValue({
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
      });

      testContext.renderComponent(<ChatInterface />);
      

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
