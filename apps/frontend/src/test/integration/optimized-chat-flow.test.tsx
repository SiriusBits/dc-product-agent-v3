/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/enhanced-test-utils';
import {
  setupOptimizedMocks,
  cleanupOptimizedMocks,
  createOptimizedChatMessage,
  createOptimizedConversation,
} from '@/test/optimized-mocks';
import { optimizedTestUtils } from '@/test/optimized-setup';
import { ApiError } from '@/lib/api-client';

describe('Optimized Chat Flow Integration', () => {
  let testHelpers: ReturnType<typeof setupOptimizedMocks>;
  let testDuration: ReturnType<typeof optimizedTestUtils.measureTestDuration>;

  beforeEach(() => {
    testDuration = optimizedTestUtils.measureTestDuration('chat-flow-test');

    testHelpers = setupOptimizedMocks({
      config: {
        enableFastMode: true,
        defaultDelay: 15, // Very fast for performance testing
        maxDelay: 50,
        enableRetries: false, // Disable retries for faster failure
      },
    });
  });

  afterEach(() => {
    const duration = testDuration.end();
    cleanupOptimizedMocks();

    // Log performance stats for slow tests
    if (duration > 3000) {
      console.log('Performance stats:', testHelpers.getPerformanceStats());
    }
  });

  describe('Core Chat Functionality', () => {
    it('renders and completes basic chat interaction quickly', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      // Fast initial load
      await testHelpers.waitForLoadingToComplete();

      // Verify basic elements
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      expect(input).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();

      // Fast message sending
      await optimizedTestUtils.expectFastOperation(
        async () => {
          await user.type(input, 'What is ASA 150?');
          await user.click(sendButton);
          await testHelpers.waitForLoadingToComplete();
        },
        1500,
        'basic chat interaction'
      );

      // Verify results
      expect(screen.getByText('What is ASA 150?')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: What is ASA 150?')
      ).toBeInTheDocument();
    });

    it('handles multiple messages efficiently', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send multiple messages in batch for performance testing
      const messages = ['Message 1', 'Message 2', 'Message 3'];

      await optimizedTestUtils.expectFastOperation(
        async () => {
          for (const message of messages) {
            await user.type(input, message);
            await user.click(sendButton);
            await testHelpers.waitForLoadingToComplete();
          }
        },
        3000,
        'multiple messages'
      );

      // Verify all messages appeared
      messages.forEach((message) => {
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(screen.getByText(`Response to: ${message}`)).toBeInTheDocument();
      });

      // Should have 6 messages total (3 user + 3 assistant)
      const messageContainers = screen.getAllByTestId('message-container');
      expect(messageContainers).toHaveLength(6);
    });

    it('handles conversation management efficiently', async () => {
      const user = userEvent.setup();

      // Setup with existing conversations for faster testing
      const existingConversations = [
        createOptimizedConversation({
          id: 'conv-1',
          title: 'Existing Chat',
          messages: [
            createOptimizedChatMessage({
              content: 'Previous message',
              conversation_id: 'conv-1',
            }),
          ],
        }),
      ];

      testHelpers = setupOptimizedMocks({
        initialConversations: existingConversations,
        config: { enableFastMode: true, defaultDelay: 10 },
      });

      render(<ChatInterface />);

      await optimizedTestUtils.expectFastOperation(
        async () => {
          await testHelpers.waitForLoadingToComplete();

          // Switch to existing conversation
          const conversationItem = screen.getByText('Existing Chat');
          await user.click(conversationItem);
          await testHelpers.waitForLoadingToComplete();

          // Create new conversation
          const newButton = screen.getByRole('button', { name: /new/i });
          await user.click(newButton);
          await testHelpers.waitForLoadingToComplete();
        },
        2000,
        'conversation management'
      );

      // Verify conversation switching worked
      expect(testHelpers.isAnyLoading()).toBe(false);
    });
  });

  describe('Error Handling Performance', () => {
    it('handles errors quickly without blocking', async () => {
      const user = userEvent.setup();

      // Setup with immediate error
      testHelpers = setupOptimizedMocks({
        simulateErrors: {
          sendMessage: new ApiError('Network error', 0),
        },
        config: { enableFastMode: true, defaultDelay: 5 },
      });

      render(<ChatInterface />);

      await optimizedTestUtils.expectFastOperation(
        async () => {
          // Error should appear quickly
          await optimizedTestUtils.fastWaitFor(
            () => screen.queryByText('Network error') !== null
          );

          // Retry should work quickly
          testHelpers.setError('chat', null);
          const retryButton = screen.getByRole('button', { name: /retry/i });
          await user.click(retryButton);
          await testHelpers.waitForLoadingToComplete();
        },
        1000,
        'error handling'
      );

      // Interface should be responsive
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });
  });

  describe('Loading State Performance', () => {
    it('manages loading states without blocking', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await optimizedTestUtils.expectFastOperation(
        async () => {
          await user.type(input, 'Test message');
          await user.click(sendButton);

          // Loading should be brief and not block
          await optimizedTestUtils.fastWaitFor(() => input.disabled);
          await testHelpers.waitForLoadingToComplete();
          await optimizedTestUtils.fastWaitFor(() => !input.disabled);
        },
        1500,
        'loading state management'
      );

      // Message should appear
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('prevents concurrent operations efficiently', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await optimizedTestUtils.expectFastOperation(
        async () => {
          // Start first operation
          await user.type(input, 'First message');
          await user.click(sendButton);

          // Verify concurrent prevention
          expect(input).toHaveValue(''); // Cleared immediately
          expect(sendButton).toBeDisabled(); // Disabled during loading

          // Wait for completion
          await testHelpers.waitForLoadingToComplete();

          // Interface should be responsive again
          await optimizedTestUtils.fastWaitFor(() => !input.disabled);
        },
        1000,
        'concurrent operation prevention'
      );

      expect(screen.getByText('First message')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts Performance', () => {
    it('handles keyboard shortcuts efficiently', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      await optimizedTestUtils.expectFastOperation(
        async () => {
          // Test Enter key
          await user.type(input, 'Quick message');
          await user.keyboard('{Enter}');
          await testHelpers.waitForLoadingToComplete();

          // Test Ctrl+K
          await user.keyboard('{Control>}k{/Control}');
          await testHelpers.waitForLoadingToComplete();
        },
        1500,
        'keyboard shortcuts'
      );

      // New conversation should clear messages
      expect(screen.queryByText('Quick message')).not.toBeInTheDocument();
    });
  });

  describe('Performance Regression Tests', () => {
    it('completes full chat flow within performance budget', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      // Full chat flow should complete within 2 seconds
      await optimizedTestUtils.expectFastOperation(
        async () => {
          await testHelpers.waitForLoadingToComplete();

          // Send message
          const input = screen.getByPlaceholderText(
            /ask about chemical products/i
          );
          await user.type(input, 'Performance test');
          await user.click(screen.getByRole('button', { name: /send/i }));
          await testHelpers.waitForLoadingToComplete();

          // Verify response
          await optimizedTestUtils.fastWaitFor(
            () => screen.queryByText('Response to: Performance test') !== null
          );
        },
        2000,
        'full chat flow'
      );

      // Verify final state
      expect(screen.getByText('Performance test')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: Performance test')
      ).toBeInTheDocument();
    });

    it('maintains performance with large conversation history', async () => {
      const user = userEvent.setup();

      // Setup with large conversation history
      const largeHistory = Array.from({ length: 20 }, (_, i) =>
        createOptimizedChatMessage({
          content: `Message ${i + 1}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
        })
      );

      testHelpers = setupOptimizedMocks({
        initialMessages: largeHistory,
        config: { enableFastMode: true, defaultDelay: 10 },
      });

      render(<ChatInterface />);

      // Should still perform well with large history
      await optimizedTestUtils.expectFastOperation(
        async () => {
          await testHelpers.waitForLoadingToComplete();

          // Send new message
          const input = screen.getByPlaceholderText(
            /ask about chemical products/i
          );
          await user.type(input, 'New message');
          await user.click(screen.getByRole('button', { name: /send/i }));
          await testHelpers.waitForLoadingToComplete();
        },
        2000,
        'large conversation handling'
      );

      // Should have all messages plus new ones
      const messageContainers = screen.getAllByTestId('message-container');
      expect(messageContainers.length).toBeGreaterThan(20);
    });
  });

  describe('Reliability Tests', () => {
    it('runs consistently across multiple executions', async () => {
      // Run the same test multiple times to check for flakiness
      const results = await optimizedTestUtils.batchOperations(
        Array.from({ length: 3 }, () => async () => {
          const user = userEvent.setup();
          const { unmount } = render(<ChatInterface />);

          try {
            await testHelpers.waitForLoadingToComplete();

            const input = screen.getByPlaceholderText(
              /ask about chemical products/i
            );
            await user.type(input, 'Reliability test');
            await user.click(screen.getByRole('button', { name: /send/i }));
            await testHelpers.waitForLoadingToComplete();

            const messageExists =
              screen.queryByText('Reliability test') !== null;
            return messageExists;
          } finally {
            unmount();
          }
        }),
        2 // Lower concurrency for reliability
      );

      // All executions should succeed
      expect(results.every((result) => result === true)).toBe(true);
    });

    it('handles rapid user interactions without breaking', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Rapid interactions should not break the interface
      await optimizedTestUtils.expectFastOperation(
        async () => {
          // Rapid typing and clicking
          await user.type(input, 'Rapid test');
          await user.click(sendButton);
          await user.click(sendButton); // Second click should be ignored
          await user.click(sendButton); // Third click should be ignored

          await testHelpers.waitForLoadingToComplete();
        },
        1000,
        'rapid interactions'
      );

      // Should only have one message sent
      const userMessages = screen.getAllByText('Rapid test');
      expect(userMessages).toHaveLength(1);
    });
  });
});
