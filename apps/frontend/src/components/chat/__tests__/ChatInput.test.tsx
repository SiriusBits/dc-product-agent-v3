import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatInput from '../ChatInput';
import { setupTest, typeIntoInput, submitForm } from '@/test';

describe('ChatInput', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest();
  });

  it('renders with placeholder text', () => {
    const mockOnSendMessage = vi.fn();
    testContext.renderComponent(
      <ChatInput onSendMessage={mockOnSendMessage} />
    );

    expect(
      screen.getByPlaceholderText(/Ask about chemical products/)
    ).toBeInTheDocument();
  });

  it('calls onSendMessage when form is submitted', async () => {
    const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
    testContext.renderComponent(
      <ChatInput onSendMessage={mockOnSendMessage} />
    );

    const input = screen.getByPlaceholderText(/Ask about chemical products/);
    const button = screen.getByRole('button');

    await typeIntoInput(input, 'Test message');
    await userEvent.setup().click(button);

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });
  });

  it('clears input after sending message', async () => {
    const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
    testContext.renderComponent(
      <ChatInput onSendMessage={mockOnSendMessage} />
    );

    const input = screen.getByPlaceholderText(
      /Ask about chemical products/
    ) as HTMLInputElement;
    const button = screen.getByRole('button');

    await typeIntoInput(input, 'Test message');
    await userEvent.setup().click(button);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows loading state when isLoading is true', () => {
    const mockOnSendMessage = vi.fn();
    testContext.renderComponent(
      <ChatInput onSendMessage={mockOnSendMessage} isLoading={true} />
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  // New tests for form submission behavior (Requirements 1.2, 1.4)
  describe('Form submission behavior', () => {
    it('wraps input in form element for proper form submission', () => {
      const mockOnSendMessage = vi.fn();
      const { container } = testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} />
      );

      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(form?.tagName).toBe('FORM');
    });

    it('prevents default form behavior on submit', async () => {
      const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
      const { container } = testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} />
      );

      const form = container.querySelector('form');
      const input = screen.getByPlaceholderText(/Ask about chemical products/);

      await typeIntoInput(input, 'Test message');

      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');

      fireEvent(form!, submitEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('submits form when Enter key is pressed', async () => {
      const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} />
      );

      const input = screen.getByPlaceholderText(/Ask about chemical products/);

      await typeIntoInput(input, 'Test message');
      await userEvent.setup().keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('allows new line with Shift+Enter', async () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} />
      );

      const input = screen.getByPlaceholderText(
        /Ask about chemical products/
      ) as HTMLTextAreaElement;

      await typeIntoInput(input, 'Line 1', { clearFirst: false });
      await userEvent.setup().keyboard('{Shift>}{Enter}{/Shift}');
      await typeIntoInput(input, 'Line 2', { clearFirst: false });

      expect(input.value).toBe('Line 1\nLine 2');
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('has submit button type for proper form submission', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });
  });

  // New tests for disabled state handling (Requirements 1.1, 1.3, 1.4)
  describe('Disabled state handling', () => {
    it('disables textarea when disabled prop is true', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} disabled={true} />
      );

      const input = screen.getByPlaceholderText(/Ask about chemical products/);
      expect(input).toBeDisabled();
    });

    it('disables button when disabled prop is true', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} disabled={true} />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('uses disabled prop directly without redundant logic', () => {
      const mockOnSendMessage = vi.fn();

      // Test with disabled=false and isLoading=true
      const { rerender } = testContext.renderComponent(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          disabled={false}
          isLoading={true}
        />
      );

      const input = screen.getByPlaceholderText(/Ask about chemical products/);
      const button = screen.getByRole('button');

      // Input should not be disabled when disabled=false (even if isLoading=true)
      expect(input).not.toBeDisabled();

      // Button should be disabled only if no message or disabled=true
      expect(button).toBeDisabled(); // Because no message

      // Test with disabled=true
      rerender(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          disabled={true}
          isLoading={false}
        />
      );

      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    });

    it('prevents message sending when disabled', async () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} disabled={true} />
      );

      const input = screen.getByPlaceholderText(/Ask about chemical products/);

      // Try to type and submit (should fail because input is disabled)
      try {
        await typeIntoInput(input, 'Test message');
        await userEvent.setup().keyboard('{Enter}');
      } catch (error) {
        // Expected to fail because input is disabled
      }

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('shows proper disabled styling', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} disabled={true} />
      );

      const input = screen.getByPlaceholderText(/Ask about chemical products/);
      const button = screen.getByRole('button');

      // Check for disabled classes
      expect(input).toHaveClass(
        'disabled:cursor-not-allowed',
        'disabled:opacity-50'
      );
      expect(button).toHaveClass(
        'disabled:pointer-events-none',
        'disabled:opacity-50'
      );
    });
  });

  // Test for loading spinner display (Requirements 1.1)
  describe('Loading state display', () => {
    it('shows loading spinner when isLoading is true', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} isLoading={true} />
      );

      // Look for the Loader2 icon (loading spinner)
      const spinner = screen.getByRole('button').querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows send icon when not loading', () => {
      const mockOnSendMessage = vi.fn();
      testContext.renderComponent(
        <ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />
      );

      // Look for the Send icon
      const sendIcon = screen.getByRole('button').querySelector('svg');
      expect(sendIcon).toBeInTheDocument();
      expect(sendIcon).not.toHaveClass('animate-spin');
    });
  });
});
