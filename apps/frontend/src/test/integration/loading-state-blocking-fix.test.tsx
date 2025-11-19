/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { ReactiveHookMock } from '@/test/reactive-mocks';
import type { ChatMessage } from '@repo/shared-types';

// Mock the hooks
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

describe('Loading State Blocking Fix', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chatMock: ReactiveHookMock<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let conversationsMock: ReactiveHookMock<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let productsMock: ReactiveHookMock<any>;

  beforeEach(() => {
    // Ensure clean slate before each test
    cleanup();
    vi.clearAllMocks();
    vi.resetAllMocks();

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

    // Setup mocks for each test
    setupMocks();
  });

  afterEach(async () => {
    // Force cleanup of all rendered components
    cleanup();

    // Wait a tick to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Reset all mocks
    chatMock?.reset();
    conversationsMock?.reset();
    productsMock?.reset();
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  function setupMocks(sendMessageImpl?: (content: string) => Promise<void>) {
    const mockSendMessage = vi.fn().mockImplementation(
      sendMessageImpl ||
        (async (content: string) => {
          await chatMock.updateValue({ isLoading: true });
          await new Promise((resolve) => setTimeout(resolve, 50));

          const currentValue = chatMock.getCurrentValue();
          const newMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            content,
            role: 'user',
            timestamp: new Date(),
            conversation_id:
              (currentValue.conversationId as string | null) || null,
          };

          const currentMessages =
            (currentValue.messages as ChatMessage[]) || [];
          await chatMock.updateValue({
            isLoading: false,
            messages: [...currentMessages, newMessage],
          });
        })
    );

    chatMock = new ReactiveHookMock({
      messages: [],
      conversationId: null,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: vi.fn(),
      loadConversation: vi.fn(),
      retryLastMessage: vi.fn(),
      isRetryable: false,
    });

    conversationsMock = new ReactiveHookMock({
      conversations: [],
      isLoading: false,
      error: null,
      loadConversations: vi.fn(),
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      updateConversationTitle: vi.fn(),
      retry: vi.fn(),
      isRetryable: false,
    });

    productsMock = new ReactiveHookMock({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: null,
      searchProducts: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      retry: vi.fn(),
      isRetryable: false,
    });

    vi.mocked(useChat).mockImplementation(
      () => chatMock.getMock()() as unknown as ReturnType<typeof useChat>
    );
    vi.mocked(useConversations).mockImplementation(
      () =>
        conversationsMock.getMock()() as unknown as ReturnType<
          typeof useConversations
        >
    );
    vi.mocked(useProducts).mockImplementation(
      () =>
        productsMock.getMock()() as unknown as ReturnType<typeof useProducts>
    );
  }

  it('prevents loading states from blocking interface indefinitely', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).not.toBeDisabled();
    expect(sendButton).toBeDisabled();

    await user.type(input, 'Test message');
    await user.click(sendButton);

    expect(input).toHaveValue('');

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(input).not.toBeDisabled();
  });

  it('handles proper timeout for async operations', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    for (let i = 1; i <= 3; i++) {
      await user.type(input, `Message ${i}`);
      await user.click(sendButton);

      await waitFor(
        () => {
          expect(chatMock.getCurrentValue().isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      expect(input).not.toBeDisabled();
    }
  });

  it('ensures loading states resolve correctly after API responses', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test query');
    await user.click(sendButton);

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(input).not.toBeDisabled();

    await user.type(input, 'Second message');
    await user.click(sendButton);

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );
  });

  it('fixes concurrent request prevention and re-enabling logic', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'First message');
    await user.click(sendButton);

    expect(input).toHaveValue('');

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(input).not.toBeDisabled();

    await user.type(input, 'Second message');
    await user.click(sendButton);

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );
  });

  it('handles conversation loading without blocking', async () => {
    const user = userEvent.setup();

    // Override clearMessages for this test
    const mockClearMessages = vi.fn().mockImplementation(async () => {
      await chatMock.updateValue({ isLoading: true });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await chatMock.updateValue({
        isLoading: false,
        messages: [],
        conversationId: null,
      });
    });

    await chatMock.updateValue({ clearMessages: mockClearMessages });

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    expect(input).not.toBeDisabled();

    const newButton = screen.getByRole('button', { name: /new/i });
    await user.click(newButton);

    await waitFor(
      () => {
        expect(chatMock.getCurrentValue().isLoading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(input).not.toBeDisabled();
  });

  it('maintains performance with multiple operations', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const startTime = Date.now();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    for (let i = 1; i <= 5; i++) {
      await user.type(input, `Performance test ${i}`);
      await user.click(sendButton);
      await waitFor(
        () => {
          expect(chatMock.getCurrentValue().isLoading).toBe(false);
        },
        { timeout: 1000 }
      );
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(2000);
    expect(chatMock.getCurrentValue().isLoading).toBe(false);
    expect(input).not.toBeDisabled();
  });
});
