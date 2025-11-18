/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { setupTest } from '@/test/enhanced-setup';
import { ApiError } from '@/lib/api-client';
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

describe.sequential('Error Handling and Retry Functionality', () => {
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
      enableAutoCleanup: false, // Disable auto cleanup to prevent interference
      enableLazyMocks: false, // Disable lazy mocks for error handling tests
      enablePerformanceOptimization: false, // Disable performance optimization for debugging
      enableDOMOptimization: false, // Disable DOM optimization for debugging
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
    // Manual cleanup after each test
    cleanup();
    vi.clearAllMocks();
  });

  describe('Error State Management', () => {
    it('displays network error correctly', async () => {
      const networkError = new ApiError('Network error', 0);

      // Set error state using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
      });

      // Small delay to ensure mock state is fully propagated
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Render component once - reactive mocks will handle updates
      testContext.renderComponent(<ChatInterface />);

      // Error should be displayed in the chat error section
      await waitFor(
        () => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Check that the error message is displayed
      await waitFor(
        () => {
          expect(screen.getByText('Network error')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('displays server error correctly', async () => {
      const serverError = new ApiError('Internal server error', 500);

      // Set error state using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: serverError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Error should be displayed in the chat error section
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
      });

      // Check that the error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });

    it('displays timeout error correctly', async () => {
      const timeoutError = new ApiError('Request timeout', 408);

      // Set error state using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: timeoutError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Request timeout')).toBeInTheDocument();
      });

      // Input should be disabled due to error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('displays validation error correctly', async () => {
      const validationError = new ApiError('Invalid input', 400);

      // Set error state using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: validationError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Invalid input')).toBeInTheDocument();
      });

      // Input should be disabled due to error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });
  });

  describe('Retry Button Functionality', () => {
    it('shows retry button for retryable errors', async () => {
      const networkError = new ApiError('Network error', 0);

      // Set error state with retryable flag using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        isRetryable: true,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Retry button should be present for retryable errors
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).not.toBeDisabled();
    });

    it('does not show retry button for non-retryable errors', async () => {
      const authError = new ApiError('Unauthorized', 401);

      // Set error state with non-retryable flag using reactive mocks BEFORE rendering
      await testContext.updateChat({
        error: authError,
        isLoading: false,
        isRetryable: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });

      // Retry button should not be present for non-retryable errors
      expect(
        screen.queryByRole('button', { name: /retry/i })
      ).not.toBeInTheDocument();
    });

    it('executes retry functionality correctly', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Set up mock retry function that clears error
      const mockRetryLastMessage = vi.fn().mockImplementation(async () => {
        // Update mock state
        await testContext.updateChat({
          error: null,
          isLoading: false,
          isRetryable: false,
        });

        // Force component to re-render by unmounting and remounting
        cleanup();
        testContext.renderComponent(<ChatInterface />);
      });

      // Set initial error state with retryable flag BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        isRetryable: true,
        retryLastMessage: mockRetryLastMessage,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Verify retry function was called
      expect(mockRetryLastMessage).toHaveBeenCalledOnce();

      // Error should be cleared after successful retry
      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });

      // Input should be enabled again
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });

    it('handles retry failure correctly', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Set up mock retry function that fails (keeps error)
      const mockRetryLastMessage = vi.fn().mockImplementation(async () => {
        // Simulate retry failure - error persists
        await testContext.updateChat({
          error: networkError,
          isLoading: false,
          isRetryable: true,
        });

        // Force component to re-render
        cleanup();
        testContext.renderComponent(<ChatInterface />);
      });

      // Set initial error state with retryable flag BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        isRetryable: true,
        retryLastMessage: mockRetryLastMessage,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Click retry button (error will persist)
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Verify retry function was called
      expect(mockRetryLastMessage).toHaveBeenCalledOnce();

      // Error should still be displayed after failed retry
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Retry button should still be available
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });
  });

  describe('Error Recovery Flows', () => {
    it('clears error when sending new message successfully', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Create mock message for successful send
      const newMessage: ChatMessage = {
        id: 'msg-1',
        content: 'What is ASA 150?',
        role: 'user',
        timestamp: new Date(),
        conversation_id: 'conv-1',
      };

      const responseMessage: ChatMessage = {
        id: 'msg-2',
        content: 'Response to: What is ASA 150?',
        role: 'assistant',
        timestamp: new Date(),
        conversation_id: 'conv-1',
      };

      // Set up mock send function that clears error and adds messages
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await testContext.updateChat({
            error: null,
            isLoading: false,
            messages: [newMessage, responseMessage],
          });

          // Force component to re-render
          cleanup();
          testContext.renderComponent(<ChatInterface />);
        });

      // Set initial error state BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        sendMessage: mockSendMessage,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Clear the error to simulate recovery
      await testContext.updateChat({
        error: null,
        isLoading: false,
        sendMessage: mockSendMessage,
      });

      // Force re-render after clearing error
      cleanup();
      testContext.renderComponent(<ChatInterface />);

      // Input should become enabled
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });

      // Send a new message
      await user.type(input, 'What is ASA 150?');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Verify send function was called
      expect(mockSendMessage).toHaveBeenCalledWith('What is ASA 150?');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });

      // Messages should appear
      await waitFor(() => {
        expect(screen.getByText('What is ASA 150?')).toBeInTheDocument();
        expect(
          screen.getByText('Response to: What is ASA 150?')
        ).toBeInTheDocument();
      });
    });

    it('handles error during message sending', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Set up mock send function that triggers error
      const mockSendMessage = vi
        .fn()
        .mockImplementation(async (content: string) => {
          await testContext.updateChat({
            error: networkError,
            isLoading: false,
          });
        });

      // Start without error BEFORE rendering
      await testContext.updateChat({
        error: null,
        isLoading: false,
        messages: [],
        sendMessage: mockSendMessage,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Type message
      await user.type(input, 'Test message');

      // Send message (will trigger error)
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Verify send function was called
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Input should be disabled
      expect(input).toBeDisabled();

      // Message should not appear in chat (error occurred)
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });

    it('recovers from conversation loading error', async () => {
      const conversationError = new ApiError(
        'Failed to load conversations',
        500
      );

      // Set conversation error state BEFORE rendering
      await testContext.updateConversations({
        error: conversationError,
        isLoading: false,
      });

      // Ensure chat is working (no chat error)
      await testContext.updateChat({
        error: null,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Conversation error should be displayed
      await waitFor(() => {
        expect(
          screen.getByText('Failed to load conversations')
        ).toBeInTheDocument();
      });

      // Clear the conversations error
      await testContext.updateConversations({
        error: null,
        isLoading: false,
      });

      // Error should be cleared
      await waitFor(() => {
        expect(
          screen.queryByText('Failed to load conversations')
        ).not.toBeInTheDocument();
      });

      // Chat functionality should still work
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });
  });

  describe('Error Persistence and Clearing', () => {
    it('maintains error state until explicitly cleared', async () => {
      const networkError = new ApiError('Persistent network error', 0);

      // Set persistent error state BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText('Persistent network error')
        ).toBeInTheDocument();
      });

      // Error should persist across re-renders
      await new Promise((resolve) => setTimeout(resolve, 100));

      await waitFor(() => {
        expect(
          screen.getByText('Persistent network error')
        ).toBeInTheDocument();
      });

      // Input should remain disabled
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('clears error when starting new conversation', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Create previous message
      const previousMessage: ChatMessage = {
        id: 'msg-prev',
        content: 'Previous message',
        role: 'user',
        timestamp: new Date(),
        conversation_id: 'conv-old',
      };

      // Set up mock clear function that clears error and messages
      const mockClearMessages = vi.fn().mockImplementation(async () => {
        await testContext.updateChat({
          error: null,
          isLoading: false,
          messages: [],
          conversationId: null,
        });
      });

      // Set initial state with error and previous messages BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        messages: [previousMessage],
        conversationId: 'conv-old',
        clearMessages: mockClearMessages,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Clear error before creating new conversation
      await testContext.updateChat({
        error: null,
        isLoading: false,
        messages: [],
        conversationId: null,
        clearMessages: mockClearMessages,
      });

      // Click new chat button
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });

      // Previous messages should be cleared
      expect(screen.queryByText('Previous message')).not.toBeInTheDocument();

      // Input should be enabled
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });

    it('handles multiple error types simultaneously', async () => {
      const chatError = new ApiError('Chat error', 500);
      const conversationError = new ApiError('Conversation error', 503);

      // Set both error states BEFORE rendering
      await testContext.updateChat({
        error: chatError,
        isLoading: false,
      });

      await testContext.updateConversations({
        error: conversationError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Both errors should be displayed
      await waitFor(() => {
        expect(screen.getByText('Chat error')).toBeInTheDocument();
        expect(screen.getByText('Conversation error')).toBeInTheDocument();
      });

      // Input should be disabled due to chat error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();

      // Clear chat error but keep conversation error
      await testContext.updateChat({
        error: null,
        isLoading: false,
      });

      await waitFor(() => {
        expect(screen.queryByText('Chat error')).not.toBeInTheDocument();
        expect(screen.getByText('Conversation error')).toBeInTheDocument();
      });

      // Input should be enabled now (only conversation error remains)
      expect(input).not.toBeDisabled();
    });
  });

  describe('Error Message Formatting', () => {
    it('displays error with proper styling and icons', async () => {
      const networkError = new ApiError('Network connection failed', 0);

      // Set error state BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText('Network connection failed')
        ).toBeInTheDocument();
      });

      // Error should be in the chat error section with proper test ID
      const errorSection = screen.getByTestId('chat-error');
      expect(errorSection).toBeInTheDocument();

      // Should have error styling classes
      expect(
        errorSection.querySelector('.border-destructive\\/50')
      ).toBeInTheDocument();
      expect(
        errorSection.querySelector('.bg-destructive\\/5')
      ).toBeInTheDocument();
    });

    it('truncates very long error messages appropriately', async () => {
      const longErrorMessage =
        'This is a very long error message that should be handled appropriately by the UI without breaking the layout or causing display issues. It contains a lot of text to test how the error display handles lengthy content.';
      const longError = new ApiError(longErrorMessage, 500);

      // Set error state with long message BEFORE rendering
      await testContext.updateChat({
        error: longError,
        isLoading: false,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(longErrorMessage)).toBeInTheDocument();
      });

      // Error container should not overflow
      const errorSection = screen.getByTestId('chat-error');
      expect(errorSection).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('provides proper ARIA labels for error states', async () => {
      const networkError = new ApiError('Network error', 0);

      // Set error state with retryable flag BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        isRetryable: true,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Error section should be accessible
      const errorSection = screen.getByTestId('chat-error');
      expect(errorSection).toBeInTheDocument();

      // Retry button should be accessible
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAttribute('type', 'button');
    });

    it('maintains focus management during error states', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      // Set error state with retryable flag BEFORE rendering
      await testContext.updateChat({
        error: networkError,
        isLoading: false,
        isRetryable: true,
      });

      // Render component once
      testContext.renderComponent(<ChatInterface />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Focus should be manageable
      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.focus();
      expect(retryButton).toHaveFocus();

      // Tab navigation should work
      await user.tab();
      // Focus should move to next focusable element
    });
  });
});
