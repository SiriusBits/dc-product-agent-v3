/**
 * @vitest-environment jsdom
 *
 * PROOF OF CONCEPT: API-Level Mocking (The Correct Approach)
 *
 * This test demonstrates the CORRECT way to test React components:
 * - Mock the API client, NOT the hooks
 * - Let real hooks run with mocked API responses
 * - State updates trigger re-renders naturally
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import type { ChatMessage, Conversation } from '@repo/shared-types';

// Mock the API client - NOT the hooks!
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import { apiClient } from '@/lib/api-client';

const mockApiClient = vi.mocked(apiClient);

describe('Loading Indicators - API Mocked (Correct Approach)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

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

    // Setup default API responses
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue({
      id: 'conv-1',
      title: 'New Conversation',
      created_at: new Date(),
      updated_at: new Date(),
      messageCount: 0,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('proof of concept - component renders with API mocking', () => {
    render(<ChatInterface />);

    // Component should render successfully
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });

  it('shows loading indicator while sending message', async () => {
    const user = userEvent.setup();

    // Mock API to delay response (simulating loading)
    mockApiClient.sendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'msg-1',
              content: 'Response',
              role: 'assistant',
              timestamp: new Date(),
              conversation_id: 'conv-1',
            } as ChatMessage);
          }, 100);
        })
    );

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type and send message
    await user.type(input, 'Test message');
    await user.click(sendButton);

    // VERIFY: Loading indicator appears (real hook sets this state)
    await waitFor(
      () => {
        expect(screen.getByText(/thinking/i)).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // VERIFY: Loading indicator disappears when API responds
    await waitFor(
      () => {
        expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('handles API errors correctly', async () => {
    // Mock API to return error
    mockApiClient.sendMessage.mockRejectedValue(new Error('Network error'));

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test');
    await userEvent.click(sendButton);

    // VERIFY: Error message appears
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
