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

describe('Loading State Blocking Fix', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

  beforeEach(() => {
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

  it('prevents loading states from blocking interface indefinitely', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // Wait for initial loading to complete
    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Initially, interface should be enabled
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();

    // Type and send a message
    await user.type(input, 'Test message');
    expect(input).toHaveValue('Test message');

    await user.click(sendButton);

    // Input should be cleared immediately
    expect(input).toHaveValue('');

    // Wait for loading to complete (should not block indefinitely)
    await testHelpers.waitForLoadingToComplete();

    // Interface should be enabled again
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    // Verify no loading states are active
    expect(testHelpers.isAnyLoading()).toBe(false);
  });

  it('handles proper timeout for async operations', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send multiple messages quickly to test timeout handling
    for (let i = 1; i <= 3; i++) {
      await user.type(input, `Message ${i}`);
      await user.click(sendButton);

      // Wait for this operation to complete before next
      await testHelpers.waitForLoadingToComplete();

      // Verify interface is responsive
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    }

    // All operations should complete within reasonable time
    expect(testHelpers.isAnyLoading()).toBe(false);
  });

  it('ensures loading states resolve correctly after API responses', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send a message
    await user.type(input, 'Test query');
    await user.click(sendButton);

    // Wait for the async operation to complete
    await testHelpers.waitForLoadingToComplete();

    // Verify loading states are properly cleared
    expect(testHelpers.isAnyLoading()).toBe(false);

    // Interface should be fully responsive
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();

    // Should be able to send another message immediately
    await user.type(input, 'Second message');
    expect(sendButton).not.toBeDisabled();

    await user.click(sendButton);
    await testHelpers.waitForLoadingToComplete();

    expect(testHelpers.isAnyLoading()).toBe(false);
  });

  it('fixes concurrent request prevention and re-enabling logic', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Start first message
    await user.type(input, 'First message');
    await user.click(sendButton);

    // Input should be cleared and interface should handle the loading state
    expect(input).toHaveValue('');

    // Wait for operation to complete
    await testHelpers.waitForLoadingToComplete();

    // Interface should be re-enabled
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    // Should be able to send second message
    await user.type(input, 'Second message');
    await user.click(sendButton);

    await testHelpers.waitForLoadingToComplete();

    // Final state should be clean
    expect(testHelpers.isAnyLoading()).toBe(false);
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();
  });

  it('handles conversation loading without blocking', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // Wait for initial conversation loading
    await testHelpers.waitForLoadingToComplete();

    // Interface should be responsive after conversation loading
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();

    // Create new conversation
    const newButton = screen.getByRole('button', { name: /new/i });
    await user.click(newButton);

    // Wait for conversation creation
    await testHelpers.waitForLoadingToComplete();

    // Interface should remain responsive
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();
    expect(testHelpers.isAnyLoading()).toBe(false);
  });

  it('maintains performance with multiple operations', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const startTime = Date.now();

    await testHelpers.waitForLoadingToComplete();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Perform multiple operations
    for (let i = 1; i <= 5; i++) {
      await user.type(input, `Performance test ${i}`);
      await user.click(sendButton);
      await testHelpers.waitForLoadingToComplete();
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete all operations within reasonable time (less than 2 seconds)
    expect(totalTime).toBeLessThan(2000);

    // Final state should be clean
    expect(testHelpers.isAnyLoading()).toBe(false);
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();
  });
});
