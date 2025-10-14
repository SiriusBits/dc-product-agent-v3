/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/enhanced-test-utils';
import {
  setupEnhancedLoadingMocks,
  cleanupEnhancedLoadingMocks,
  createMockChatMessage,
  createMockConversation,
} from '@/test/enhanced-loading-mocks';
import { ApiError } from '@/lib/api-client';

describe('Loading State Management Fixes', () => {
  let testHelpers: ReturnType<typeof setupEnhancedLoadingMocks>;

  beforeEach(() => {
    testHelpers = setupEnhancedLoadingMocks({
      loadingConfig: {
        sendMessageDelay: 100,
        loadConversationsDelay: 50,
        autoResolveLoading: true,
      },
    });

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
    cleanupEnhancedLoadingMocks();
  });

  describe('Loading State Transitions', () => {
    it('properly manages loading states during message sending', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      // Wait for initial load
      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Initially, input and button should be enabled
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();

      // Type a message
      await user.type(input, 'What is ASA 150?');
      expect(input).toHaveValue('What is ASA 150?');

      // Send the message
      await user.click(sendButton);

      // During loading, input and button should be disabled
      await waitFor(
        () => {
          expect(input).toBeDisabled();
          expect(sendButton).toBeDisabled();
        },
        { timeout: 200 }
      );

      // Wait for loading to complete
      await testHelpers.waitForLoadingToComplete();

      // After loading, input and button should be enabled again
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });

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

      // Setup with longer delays to test timeout handling
      testHelpers = setupEnhancedLoadingMocks({
        loadingConfig: {
          sendMessageDelay: 50,
          defaultTimeout: 1000,
          autoResolveLoading: true,
        },
      });

      render(<ChatInterface />);

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
      await testHelpers.waitForLoadingToComplete();

      // Verify loading state is cleared
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('prevents concurrent message sending', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

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
      await testHelpers.waitForLoadingToComplete();

      // Now input should be enabled again
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });

      // Verify first message appeared
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: First message')
      ).toBeInTheDocument();
    });

    it('handles conversation loading states', async () => {
      const user = userEvent.setup();

      // Setup with existing conversations
      const existingConversations = [
        createMockConversation({
          id: 'conv-1',
          title: 'Existing Conversation',
          messages: [
            createMockChatMessage({
              content: 'Previous message',
              conversation_id: 'conv-1',
            }),
          ],
        }),
      ];

      testHelpers = setupEnhancedLoadingMocks({
        initialConversations: existingConversations,
      });

      render(<ChatInterface />);

      // Wait for conversations to load
      await testHelpers.waitForLoadingToComplete();

      // Conversation should appear in sidebar
      await waitFor(() => {
        expect(screen.getByText('Existing Conversation')).toBeInTheDocument();
      });

      // Click on conversation to load it
      const conversationItem = screen.getByText('Existing Conversation');
      await user.click(conversationItem);

      // Wait for conversation to load
      await testHelpers.waitForLoadingToComplete();

      // Previous message should appear
      await waitFor(() => {
        expect(screen.getByText('Previous message')).toBeInTheDocument();
      });
    });

    it('handles new conversation creation with loading states', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      // Click new conversation button
      const newButton = screen.getByRole('button', { name: /new/i });
      await user.click(newButton);

      // Wait for conversation creation to complete
      await testHelpers.waitForLoadingToComplete();

      // New conversation should be created (no specific UI change expected in this test)
      // The main thing is that loading states resolve properly
      expect(testHelpers.isAnyLoading()).toBe(false);
    });
  });

  describe('Error Handling with Loading States', () => {
    it('clears loading states when errors occur', async () => {
      const user = userEvent.setup();

      // Setup to simulate error
      testHelpers = setupEnhancedLoadingMocks({
        simulateErrors: {
          sendMessage: new ApiError('Network error', 0),
        },
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');

      // Manually trigger error by setting error state
      testHelpers.setError('chat', new ApiError('Network error', 0));

      // Input should be disabled due to error
      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Retry button should be available
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Clear error and retry
      testHelpers.setError('chat', null);
      await user.click(retryButton);

      // Wait for retry to complete
      await testHelpers.waitForLoadingToComplete();

      // Input should be enabled again
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });

    it('handles timeout errors properly', async () => {
      const user = userEvent.setup();

      // Setup with very short timeout to trigger timeout error
      testHelpers = setupEnhancedLoadingMocks({
        loadingConfig: {
          defaultTimeout: 50, // Very short timeout
          sendMessageDelay: 100, // Longer than timeout
          autoResolveLoading: false, // Don't auto-resolve
        },
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Wait for timeout to occur
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Loading should be cleared after timeout
      expect(testHelpers.isAnyLoading()).toBe(false);

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
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      // Start multiple operations
      const newChatButton = screen.getByRole('button', { name: /new/i });
      await user.click(newChatButton); // Create conversation

      // Don't wait, immediately try to send a message
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await user.type(input, 'Quick message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton); // Send message

      // Wait for all operations to complete
      await testHelpers.waitForLoadingToComplete();

      // All operations should complete successfully
      expect(testHelpers.isAnyLoading()).toBe(false);

      // UI should be in a consistent state
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('maintains loading state consistency across re-renders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

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
      await testHelpers.waitForLoadingToComplete();

      // Loading state should be cleared
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading State Performance', () => {
    it('completes loading operations within reasonable time', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const startTime = Date.now();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Performance test message');
      await user.click(sendButton);

      // Wait for operation to complete
      await testHelpers.waitForLoadingToComplete();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Message should appear
      expect(screen.getByText('Performance test message')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: Performance test message')
      ).toBeInTheDocument();
    });

    it('does not block interface indefinitely', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send multiple messages in sequence
      for (let i = 1; i <= 3; i++) {
        await user.type(input, `Message ${i}`);
        await user.click(sendButton);

        // Wait for this message to complete before sending next
        await testHelpers.waitForLoadingToComplete();

        // Verify message appeared
        await waitFor(() => {
          expect(screen.getByText(`Message ${i}`)).toBeInTheDocument();
          expect(
            screen.getByText(`Response to: Message ${i}`)
          ).toBeInTheDocument();
        });
      }

      // All operations should be complete
      expect(testHelpers.isAnyLoading()).toBe(false);

      // Interface should be responsive
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });
});
