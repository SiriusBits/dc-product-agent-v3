/**
 * @vitest-environment jsdom
 *
 * Loading Indicators Test - API-Level Mocking Migration
 *
 * This test demonstrates the correct approach: mocking @/lib/api-client
 * instead of mocking hooks. Real hooks manage state and trigger re-renders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  screen,
  waitFor,
  cleanup,
  render,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock API client at module level (BEFORE imports)
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    getConversationMessages: vi.fn(),
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    getRelatedProducts: vi.fn(),
    compareProducts: vi.fn(),
    getProductFamilies: vi.fn(),
    getProductApplications: vi.fn(),
    getProductProperties: vi.fn(),
    getProductStatistics: vi.fn(),
    queryKnowledgeGraph: vi.fn(),
    getEntityNeighbors: vi.fn(),
    getSystemStatus: vi.fn(),
    checkHealth: vi.fn(),
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

// Import AFTER mocking
import { apiClient } from '@/lib/api-client';
import ChatInterface from '@/components/chat/ChatInterface';
import type { ChatResponse } from '@repo/shared-types';

describe.sequential('Loading Indicators - API-Level Mocking', () => {
  beforeEach(() => {
    // Complete cleanup
    document.body.innerHTML = '';
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
    vi.mocked(apiClient.listConversations).mockResolvedValue([]);
    vi.mocked(apiClient.createConversation).mockResolvedValue({
      id: 'conv-1',
      title: 'New Conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('shows loading indicator during message send', async () => {
    const user = userEvent.setup();

    // Setup delayed API response
    vi.mocked(apiClient.sendMessage).mockImplementation(
      () =>
        new Promise<ChatResponse>((resolve) =>
          setTimeout(
            () =>
              resolve({
                message: {
                  id: 'msg-2',
                  conversation_id: 'conv-1',
                  role: 'assistant',
                  content: 'Response message',
                  timestamp: new Date().toISOString(),
                },
                conversation_id: 'conv-1',
                sources: [],
              }),
            200
          )
        )
    );

    const { container } = render(<ChatInterface />);

    // Find input using container to avoid multiple element issues
    const input = container.querySelector(
      'textarea[placeholder*="Ask about"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Verify loading indicator appears
    await waitFor(
      () => {
        expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Verify loading indicator disappears after response
    await waitFor(
      () => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify message appears
    await waitFor(() => {
      expect(screen.getByText('Response message')).toBeInTheDocument();
    });
  });

  it('loading indicator appears and disappears correctly', async () => {
    const user = userEvent.setup();

    // Setup API response with controlled delay
    vi.mocked(apiClient.sendMessage).mockImplementation(
      () =>
        new Promise<ChatResponse>((resolve) =>
          setTimeout(
            () =>
              resolve({
                message: {
                  id: 'msg-2',
                  conversation_id: 'conv-1',
                  role: 'assistant',
                  content: 'Test response',
                  timestamp: new Date().toISOString(),
                },
                conversation_id: 'conv-1',
                sources: [],
              }),
            150
          )
        )
    );

    const { container } = render(<ChatInterface />);

    const input = container.querySelector(
      'textarea[placeholder*="Ask about"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    const sendButton = screen.getByRole('button', { name: /send/i });

    // Initially no loading indicator
    expect(
      screen.queryByTestId('chat-loading-spinner')
    ).not.toBeInTheDocument();

    // Send message
    await user.type(input, 'Hello');
    await user.click(sendButton);

    // Loading indicator should appear
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Loading indicator should disappear
    await waitFor(
      () => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('handles fast API responses without flickering', async () => {
    const user = userEvent.setup();

    // Setup immediate API response
    vi.mocked(apiClient.sendMessage).mockResolvedValue({
      message: {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Fast response',
        timestamp: new Date().toISOString(),
      },
      conversation_id: 'conv-1',
      sources: [],
    });

    const { container } = render(<ChatInterface />);

    const input = container.querySelector(
      'textarea[placeholder*="Ask about"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Quick question');
    await user.click(sendButton);

    // Wait for response (loading may be too fast to see)
    await waitFor(
      () => {
        expect(screen.getByText('Fast response')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Ensure no loading indicator remains
    expect(
      screen.queryByTestId('chat-loading-spinner')
    ).not.toBeInTheDocument();
  });

  it('handles multiple sequential messages with loading states', async () => {
    const user = userEvent.setup();

    // Setup API responses
    vi.mocked(apiClient.sendMessage)
      .mockResolvedValueOnce({
        message: {
          id: 'msg-2',
          conversation_id: 'conv-1',
          role: 'assistant',
          content: 'First response',
          timestamp: new Date().toISOString(),
        },
        conversation_id: 'conv-1',
        sources: [],
      })
      .mockResolvedValueOnce({
        message: {
          id: 'msg-4',
          conversation_id: 'conv-1',
          role: 'assistant',
          content: 'Second response',
          timestamp: new Date().toISOString(),
        },
        conversation_id: 'conv-1',
        sources: [],
      });

    const { container } = render(<ChatInterface />);

    const input = container.querySelector(
      'textarea[placeholder*="Ask about"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message
    await user.type(input, 'First message');
    await user.click(sendButton);

    // Wait for first response
    await waitFor(() => {
      expect(screen.getByText('First response')).toBeInTheDocument();
    });

    // Ensure loading cleared
    expect(
      screen.queryByTestId('chat-loading-spinner')
    ).not.toBeInTheDocument();

    // Send second message
    await user.clear(input);
    await user.type(input, 'Second message');
    await user.click(sendButton);

    // Wait for second response
    await waitFor(() => {
      expect(screen.getByText('Second response')).toBeInTheDocument();
    });

    // Ensure loading cleared again
    expect(
      screen.queryByTestId('chat-loading-spinner')
    ).not.toBeInTheDocument();
  });

  it('shows loading indicator for slow API responses', async () => {
    const user = userEvent.setup();

    // Setup slow API response (500ms)
    vi.mocked(apiClient.sendMessage).mockImplementation(
      () =>
        new Promise<ChatResponse>((resolve) =>
          setTimeout(
            () =>
              resolve({
                message: {
                  id: 'msg-2',
                  conversation_id: 'conv-1',
                  role: 'assistant',
                  content: 'Slow response',
                  timestamp: new Date().toISOString(),
                },
                conversation_id: 'conv-1',
                sources: [],
              }),
            500
          )
        )
    );

    const { container } = render(<ChatInterface />);

    const input = container.querySelector(
      'textarea[placeholder*="Ask about"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Slow question');
    await user.click(sendButton);

    // Loading indicator should be visible for extended period
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Verify it stays visible for at least 200ms
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();

    // Eventually disappears
    await waitFor(
      () => {
        expect(
          screen.queryByTestId('chat-loading-spinner')
        ).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Response appears
    expect(screen.getByText('Slow response')).toBeInTheDocument();
  });
});
