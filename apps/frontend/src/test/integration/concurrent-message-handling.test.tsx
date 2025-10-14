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

describe('Concurrent Message Handling', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;
  let messageIdCounter = 0;

  // Helper to create unique message IDs
  const createUniqueMessageId = () => {
    messageIdCounter++;
    return `msg-${Date.now()}-${messageIdCounter}`;
  };

  beforeEach(() => {
    messageIdCounter = 0;
    testHelpers = setupFixedLoadingMocks();

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

  it('prevents concurrent message sending with same query', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type a message
    await user.type(input, 'Test message');

    // Verify button is enabled with text
    expect(sendButton).not.toBeDisabled();

    // Send the message
    await user.click(sendButton);

    // Input should be cleared immediately after clicking send
    expect(input).toHaveValue('');

    // Button should be disabled because input is empty (not because of loading)
    expect(sendButton).toBeDisabled();

    // During loading, input should be disabled
    if (testHelpers.isAnyLoading()) {
      expect(input).toBeDisabled();
    }

    // Wait for the operation to complete
    await testHelpers.waitForLoadingToComplete();

    // After completion, input should be enabled again
    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });

    // Button should still be disabled because input is empty
    expect(sendButton).toBeDisabled();

    // Type new text to enable button again
    await user.type(input, 'Second message');
    expect(sendButton).not.toBeDisabled();

    // Message should appear
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Response to: Test message')).toBeInTheDocument();
    });
  });

  it('disables input and button during loading state', async () => {
    const user = userEvent.setup();

    // Set up with a longer loading delay to test the disabled state
    testHelpers = setupFixedLoadingMocks({
      loadingDelays: {
        sendMessage: 500, // 500ms delay
      },
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type a message
    await user.type(input, 'Loading test message');
    expect(sendButton).not.toBeDisabled();

    // Start the loading process by clicking send
    await user.click(sendButton);

    // Input should be cleared immediately
    expect(input).toHaveValue('');

    // During loading, input should be disabled
    if (testHelpers.isAnyLoading()) {
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled(); // Disabled due to empty input + loading
    }

    // Wait for loading to complete
    await testHelpers.waitForLoadingToComplete();

    // After loading completes, input should be enabled
    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });

    // Button should be disabled because input is empty
    expect(sendButton).toBeDisabled();
  });

  it('prevents multiple rapid clicks on send button', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type a message
    await user.type(input, 'Rapid click test');
    expect(sendButton).not.toBeDisabled();

    // Try to click multiple times rapidly
    const clickPromise1 = user.click(sendButton);
    const clickPromise2 = user.click(sendButton);
    const clickPromise3 = user.click(sendButton);

    await Promise.all([clickPromise1, clickPromise2, clickPromise3]);

    // Input should be cleared after first click
    expect(input).toHaveValue('');

    // Wait for any loading to complete
    await testHelpers.waitForLoadingToComplete();

    // Should only have one message sent (user + assistant response)
    await waitFor(() => {
      expect(screen.getByText('Rapid click test')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: Rapid click test')
      ).toBeInTheDocument();
    });

    // Should have exactly 2 messages (1 user + 1 assistant)
    const messageContainers = screen.getAllByTestId('message-container');
    expect(messageContainers).toHaveLength(2);
  });

  it('handles proper re-enabling after message completion', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message
    await user.type(input, 'First message');
    expect(sendButton).not.toBeDisabled();
    await user.click(sendButton);

    // Wait for completion
    await testHelpers.waitForLoadingToComplete();

    // Verify first message appears
    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
    });

    // Input should be enabled and empty
    expect(input).not.toBeDisabled();
    expect(input).toHaveValue('');
    expect(sendButton).toBeDisabled(); // Disabled because input is empty

    // Send second message
    await user.type(input, 'Second message');
    expect(sendButton).not.toBeDisabled();
    await user.click(sendButton);

    // Wait for completion
    await testHelpers.waitForLoadingToComplete();

    // Verify both messages appear
    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: First message')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Response to: Second message')
      ).toBeInTheDocument();
    });

    // Should have 4 messages total (2 user + 2 assistant)
    const messageContainers = screen.getAllByTestId('message-container');
    expect(messageContainers).toHaveLength(4);
  });

  it('handles message queue correctly with rapid typing and sending', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send multiple messages in sequence
    const messages = ['Message 1', 'Message 2', 'Message 3'];

    for (const message of messages) {
      await user.type(input, message);
      expect(sendButton).not.toBeDisabled();
      await user.click(sendButton);

      // Wait for this message to complete before sending next
      await testHelpers.waitForLoadingToComplete();

      // Verify message appears
      await waitFor(() => {
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(screen.getByText(`Response to: ${message}`)).toBeInTheDocument();
      });
    }

    // Verify all messages are present
    for (const message of messages) {
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByText(`Response to: ${message}`)).toBeInTheDocument();
    }

    // Should have 6 messages total (3 user + 3 assistant)
    const messageContainers = screen.getAllByTestId('message-container');
    expect(messageContainers).toHaveLength(6);
  });

  it('prevents sending empty messages', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Button should be disabled with empty input
    expect(sendButton).toBeDisabled();

    // Try to click the disabled button
    await user.click(sendButton);

    // No messages should be sent
    const messageContainers = screen.queryAllByTestId('message-container');
    expect(messageContainers).toHaveLength(0);

    // Type only spaces
    await user.type(input, '   ');

    // Button should still be disabled (spaces only)
    expect(sendButton).toBeDisabled();

    // Try to click again
    await user.click(sendButton);

    // Still no messages
    const messageContainersAfter = screen.queryAllByTestId('message-container');
    expect(messageContainersAfter).toHaveLength(0);
  });

  it('handles Enter key for sending messages', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    // Type message and press Enter
    await user.type(input, 'Enter key test');
    await user.keyboard('{Enter}');

    // Wait for message to be processed
    await testHelpers.waitForLoadingToComplete();

    // Verify message was sent
    await waitFor(() => {
      expect(screen.getByText('Enter key test')).toBeInTheDocument();
      expect(
        screen.getByText('Response to: Enter key test')
      ).toBeInTheDocument();
    });

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('handles Shift+Enter for new lines without sending', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    // Type message and press Shift+Enter
    await user.type(input, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Line 2');

    // Message should not be sent yet
    const messageContainers = screen.queryAllByTestId('message-container');
    expect(messageContainers).toHaveLength(0);

    // Input should contain the text with newline
    expect(input).toHaveValue('Line 1\nLine 2');

    // Now press Enter to send
    await user.keyboard('{Enter}');

    // Wait for message to be processed
    await testHelpers.waitForLoadingToComplete();

    // Verify message was sent with newlines
    await waitFor(() => {
      expect(screen.getByText('Line 1\nLine 2')).toBeInTheDocument();
    });
  });
});
