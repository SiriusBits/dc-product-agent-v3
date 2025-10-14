/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '@/components/chat/ChatInput';

describe('ChatInput Concurrent Message Handling', () => {
  let mockOnSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSendMessage = vi.fn();
  });

  it('disables send button when input is empty', async () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    expect(sendButton).not.toBeDisabled();
  });

  it('disables input and button when loading', async () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={true}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('disables input and button when disabled prop is true', async () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={true}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('clears input after sending message', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValue(undefined);

    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    expect(input).toHaveValue('Test message');

    await user.click(sendButton);
    expect(input).toHaveValue('');
    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('prevents sending empty messages', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const sendButton = screen.getByRole('button', { name: /send/i });

    // Button should be disabled for empty input
    expect(sendButton).toBeDisabled();

    // Try clicking the disabled button
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('prevents sending whitespace-only messages', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type only spaces
    await user.type(input, '   ');

    // Button should still be disabled
    expect(sendButton).toBeDisabled();

    // Try clicking the disabled button
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('handles Enter key for sending messages', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValue(undefined);

    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');

    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    expect(input).toHaveValue('');
  });

  it('handles Shift+Enter for new lines without sending', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');

    await user.type(input, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Line 2');

    // Message should not be sent
    expect(mockOnSendMessage).not.toHaveBeenCalled();

    // Input should contain both lines (check that it contains both parts)
    const inputValue = (input as HTMLInputElement).value;
    expect(inputValue).toContain('Line 1');
    expect(inputValue).toContain('Line 2');
    // The exact newline character might vary, so just check it's not empty between lines
    expect(inputValue.length).toBeGreaterThan('Line 1Line 2'.length);
  });

  it('prevents multiple rapid clicks on send button', async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const sendPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockOnSendMessage.mockReturnValue(sendPromise);

    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');

    // Click multiple times rapidly
    await user.click(sendButton);
    await user.click(sendButton);
    await user.click(sendButton);

    // Only one call should be made because input is cleared after first click
    expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');

    // Resolve the promise
    resolvePromise!();
    await sendPromise;
  });

  it('shows loading spinner when isLoading is true', async () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={true}
        disabled={false}
      />
    );

    // Should show loading spinner instead of send icon
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('respects maxLength constraint', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');

    // Input should have maxLength attribute
    expect(input).toHaveAttribute('maxlength', '1000');

    // Type a long message
    const longMessage = 'a'.repeat(1001);
    await user.type(input, longMessage);

    // Input should be truncated to 1000 characters
    expect(input).toHaveValue('a'.repeat(1000));
  });

  it('shows character count', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');

    // Should show 0/1000 initially
    expect(screen.getByText('0/1000')).toBeInTheDocument();

    await user.type(input, 'Hello');

    // Should show 5/1000
    expect(screen.getByText('5/1000')).toBeInTheDocument();
  });

  it('focuses input after sending message', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValue(undefined);

    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        disabled={false}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Input should be focused after sending
    expect(input).toHaveFocus();
  });
});
