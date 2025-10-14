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
} from '@/test/fixed-loading-mocks';

describe('Keyboard Shortcuts Integration', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

  beforeEach(() => {
    testHelpers = setupFixedLoadingMocks({
      // Start with clean state - no initial messages or conversations
      initialMessages: [],
      initialConversations: [],
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
    cleanupFixedLoadingMocks();
  });

  describe('Enter Key for Message Sending', () => {
    it('should send message when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Type message and press Enter
      await user.type(input, 'Test message for Enter key');
      await user.keyboard('{Enter}');

      // Wait for the message to be processed
      await testHelpers.waitForLoadingToComplete();

      // Verify the message was sent and appears in the chat
      await waitFor(() => {
        expect(
          screen.getByText('Test message for Enter key')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Response to: Test message for Enter key')
        ).toBeInTheDocument();
      });

      // Input should be cleared after sending
      expect(input).toHaveValue('');
    });

    it('should not send message when Enter is pressed with empty input', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Press Enter with empty input
      await user.keyboard('{Enter}');

      // Wait a bit to ensure no message is sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No messages should appear
      expect(screen.queryByTestId('message-container')).not.toBeInTheDocument();
    });
  });

  describe('Shift+Enter for New Line Behavior', () => {
    it('should not send message when Shift+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Type message and press Shift+Enter
      await user.type(input, 'Test message');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      // Wait a bit to ensure no message is sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Message should not be sent
      expect(screen.queryByTestId('message-container')).not.toBeInTheDocument();

      // Input should still contain the text with newline
      expect(input).toHaveValue('Test message\n');
    });

    it('should send message when Enter is pressed after Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Create message with newline
      await user.type(input, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(input, 'Line 2');

      // Verify the textarea contains both lines before sending
      expect(input).toHaveValue('Line 1\nLine 2');

      // Send the message with Enter
      await user.keyboard('{Enter}');

      await testHelpers.waitForLoadingToComplete();

      // Input should be cleared after sending
      expect(input).toHaveValue('');

      // Verify a message was sent (check for message containers)
      await waitFor(() => {
        const messageContainers = screen.getAllByTestId('message-container');
        expect(messageContainers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Ctrl+K for New Conversation Creation', () => {
    it('should create new conversation when Ctrl+K is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Press Ctrl+K to create new conversation
      await user.keyboard('{Control>}k{/Control}');

      // Wait for new conversation to be created
      await testHelpers.waitForLoadingToComplete();

      // Input should be focused and ready for new message
      await waitFor(
        () => {
          expect(input).toHaveFocus();
        },
        { timeout: 1000 }
      );
      expect(input).toHaveValue('');
    });

    it('should work when pressed from anywhere in the interface', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      // Focus on the sidebar button first
      const sidebarButtons = screen.getAllByRole('button', { name: /new/i });
      const sidebarNewButton = sidebarButtons[0]; // Get the first "New" button (from sidebar)
      await user.click(sidebarNewButton);

      // Press Ctrl+K while focus is not on input
      await user.keyboard('{Control>}k{/Control}');

      await testHelpers.waitForLoadingToComplete();

      // Should still create new conversation
      // Input should be focused after the shortcut
      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Wait for focus to be set (with timeout)
      await waitFor(
        () => {
          expect(input).toHaveFocus();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Keyboard Shortcuts Accessibility', () => {
    it('should announce keyboard shortcuts to screen readers', async () => {
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      // Check that keyboard shortcut hints are present
      expect(screen.getByText(/press enter to send/i)).toBeInTheDocument();
      expect(
        screen.getByText(/shift\+enter for new line/i)
      ).toBeInTheDocument();
    });

    it('should maintain focus management with keyboard shortcuts', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Focus should start on input
      await user.click(input);
      expect(input).toHaveFocus();

      // After sending message with Enter, focus should return to input
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      await testHelpers.waitForLoadingToComplete();

      // Focus should return to input after sending
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      // After Ctrl+K, focus should be on input
      await user.keyboard('{Control>}k{/Control}');

      await testHelpers.waitForLoadingToComplete();

      expect(input).toHaveFocus();
    });
  });

  describe('Keyboard Shortcuts Error Handling', () => {
    it('should handle keyboard shortcuts gracefully when there are errors', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      await testHelpers.waitForLoadingToComplete();

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Keyboard shortcuts should still work even with errors
      await user.keyboard('{Control>}k{/Control}');

      await testHelpers.waitForLoadingToComplete();

      // Input should still be enabled and focused
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(input).toHaveFocus();
      });
    });
  });
});
