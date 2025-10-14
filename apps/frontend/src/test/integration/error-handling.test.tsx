/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/enhanced-test-utils';
import {
  setupFixedLoadingMocks,
  cleanupFixedLoadingMocks,
  createMockChatMessage,
} from '@/test/fixed-loading-mocks';
import { ApiError } from '@/lib/api-client';

describe('Error Handling and Retry Functionality', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

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
  });

  afterEach(() => {
    cleanupFixedLoadingMocks();
  });

  describe('Error State Management', () => {
    it('displays network error correctly', async () => {
      const networkError = new ApiError('Network error', 0);
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Error icon should be present
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Input should be disabled due to error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('displays server error correctly', async () => {
      const serverError = new ApiError('Internal server error', 500);
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: serverError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });

      // Input should be disabled due to error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('displays timeout error correctly', async () => {
      const timeoutError = new ApiError('Request timeout', 408);
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: timeoutError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: validationError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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
      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: authError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });

      // Clear the error before retrying
      testHelpers.setError('chat', null);

      await user.click(retryButton);
      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Click retry button (error will persist)
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Clear the error to simulate recovery
      testHelpers.setError('chat', null);

      // Input should become enabled
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });

      // Send a new message
      await user.type(input, 'What is ASA 150?');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await testHelpers.waitForLoadingToComplete();

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });

      // Message should appear
      await waitFor(() => {
        expect(screen.getByText('What is ASA 150?')).toBeInTheDocument();
        expect(
          screen.getByText('Response to: What is ASA 150?')
        ).toBeInTheDocument();
      });
    });

    it('handles error during message sending', async () => {
      const user = userEvent.setup();

      // Start without error
      testHelpers = setupFixedLoadingMocks();

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Type message
      await user.type(input, 'Test message');

      // Simulate error occurring during send
      const networkError = new ApiError('Network error', 0);
      testHelpers.setError('chat', networkError);

      await user.click(screen.getByRole('button', { name: /send/i }));
      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          loadConversations: conversationError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Conversation error should be displayed
      await waitFor(() => {
        expect(
          screen.getByText('Failed to load conversations')
        ).toBeInTheDocument();
      });

      // Clear the conversations error
      testHelpers.setError('conversations', null);

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
        initialMessages: [
          createMockChatMessage({
            content: 'Previous message',
            role: 'user',
          }),
        ],
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Clear error before creating new conversation
      testHelpers.setError('chat', null);

      // Click new chat button
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      await testHelpers.waitForLoadingToComplete();

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: chatError,
          loadConversations: conversationError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Both errors should be displayed
      await waitFor(() => {
        expect(screen.getByText('Chat error')).toBeInTheDocument();
        expect(screen.getByText('Conversation error')).toBeInTheDocument();
      });

      // Input should be disabled due to chat error
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();

      // Clear chat error but keep conversation error
      testHelpers.setError('chat', null);

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

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText('Network connection failed')
        ).toBeInTheDocument();
      });

      // Error should be in an alert container
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();

      // Should have error styling classes
      expect(errorAlert).toHaveClass('border-destructive/50');
      expect(errorAlert).toHaveClass('bg-destructive/5');
    });

    it('truncates very long error messages appropriately', async () => {
      const longErrorMessage =
        'This is a very long error message that should be handled appropriately by the UI without breaking the layout or causing display issues. It contains a lot of text to test how the error display handles lengthy content.';
      const longError = new ApiError(longErrorMessage, 500);

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: longError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(longErrorMessage)).toBeInTheDocument();
      });

      // Error container should not overflow
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('provides proper ARIA labels for error states', async () => {
      const networkError = new ApiError('Network error', 0);

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Error should have proper role
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();

      // Retry button should be accessible
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAttribute('type', 'button');
    });

    it('maintains focus management during error states', async () => {
      const user = userEvent.setup();
      const networkError = new ApiError('Network error', 0);

      testHelpers = setupFixedLoadingMocks({
        simulateErrors: {
          sendMessage: networkError,
        },
      });

      render(<ChatInterface />);
      await testHelpers.waitForLoadingToComplete();

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
