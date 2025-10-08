/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../useChat';
import type { ChatMessage, ChatResponse } from '@/types';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    chat: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockApiClient = vi.mocked(apiClient);

describe('useChat', () => {
  const mockChatResponse: ChatResponse = {
    answer: 'ASA 150 has a viscosity of 150 cP at 25°C.',
    sources: [
      {
        content: 'ASA 150 viscosity: 150 cP',
        score: 0.95,
        source: 'vector',
        metadata: { doc_id: 'asa-150-spec' },
        provenance: { document: 'ASA 150 Technical Bulletin' },
      },
    ],
    conversationId: 'conv-123',
    queryAnalysis: {
      queryType: 'specification',
      entities: ['ASA 150'],
      intentConfidence: 0.9,
    },
    responseTimeMs: 250,
    kgEnhanced: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty messages', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentConversationId).toBeNull();
  });

  it('sends message and updates state correctly', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('What is the viscosity of ASA 150?');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe(
      'What is the viscosity of ASA 150?'
    );
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].content).toBe(
      'ASA 150 has a viscosity of 150 cP at 25°C.'
    );
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.currentConversationId).toBe('conv-123');
  });

  it('sets loading state during message sending', async () => {
    let resolvePromise: (value: ChatResponse) => void;
    const promise = new Promise<ChatResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.chat.mockReturnValue(promise);

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.sendMessage('Test message');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!(mockChatResponse);
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles API errors correctly', async () => {
    const errorMessage = 'Network error';
    mockApiClient.chat.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1); // Only user message
    expect(result.current.messages[0].error).toBe(errorMessage);
  });

  it('clears messages', () => {
    const { result } = renderHook(() => useChat());

    // Add some messages first
    act(() => {
      result.current.sendMessage('Test message');
    });

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.currentConversationId).toBeNull();
  });

  it('loads conversation from ID', async () => {
    const conversationMessages: ChatMessage[] = [
      {
        id: '1',
        content: 'Previous question',
        role: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        content: 'Previous answer',
        role: 'assistant',
        timestamp: new Date('2024-01-01T10:00:01Z'),
      },
    ];

    // Mock API call to load conversation
    mockApiClient.getConversation = vi.fn().mockResolvedValue({
      id: 'conv-456',
      messages: conversationMessages,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadConversation('conv-456');
    });

    expect(result.current.messages).toEqual(conversationMessages);
    expect(result.current.currentConversationId).toBe('conv-456');
  });

  it('persists messages to localStorage', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    const storedMessages = JSON.parse(
      localStorage.getItem('chat-messages') || '[]'
    );
    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[0].content).toBe('Test message');
  });

  it('loads messages from localStorage on initialization', () => {
    const storedMessages: ChatMessage[] = [
      {
        id: '1',
        content: 'Stored message',
        role: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    localStorage.setItem('chat-messages', JSON.stringify(storedMessages));

    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual(storedMessages);
  });

  it('generates unique message IDs', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('First message');
    });

    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    const messageIds = result.current.messages.map((m) => m.id);
    const uniqueIds = new Set(messageIds);
    expect(uniqueIds.size).toBe(messageIds.length);
  });

  it('includes sources in assistant messages', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    const assistantMessage = result.current.messages.find(
      (m) => m.role === 'assistant'
    );
    expect(assistantMessage?.sources).toEqual(mockChatResponse.sources);
  });

  it('handles empty message gracefully', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockApiClient.chat).not.toHaveBeenCalled();
  });

  it('handles whitespace-only message gracefully', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('   \n\t  ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockApiClient.chat).not.toHaveBeenCalled();
  });

  it('retries failed messages', async () => {
    // First call fails
    mockApiClient.chat.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    mockApiClient.chat.mockResolvedValueOnce(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // Send message that fails
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.messages[0].error).toBe('Network error');

    // Retry the message
    await act(async () => {
      await result.current.retryMessage(result.current.messages[0]);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe(
      'ASA 150 has a viscosity of 150 cP at 25°C.'
    );
  });

  it('updates conversation ID when provided in response', async () => {
    const responseWithNewConversation = {
      ...mockChatResponse,
      conversationId: 'new-conv-789',
    };

    mockApiClient.chat.mockResolvedValue(responseWithNewConversation);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.currentConversationId).toBe('new-conv-789');
  });

  it('passes conversation ID to subsequent API calls', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // First message
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    // Second message should include conversation ID
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    expect(mockApiClient.chat).toHaveBeenLastCalledWith({
      query: 'Second message',
      conversationId: 'conv-123',
      maxResults: 10,
    });
  });

  it('clears error when sending new message', async () => {
    // First call fails
    mockApiClient.chat.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    mockApiClient.chat.mockResolvedValueOnce(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // Send message that fails
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    expect(result.current.error).toBe('Network error');

    // Send another message
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    expect(result.current.error).toBeNull();
  });

  it('handles concurrent message sending', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // Send two messages concurrently
    await act(async () => {
      const promise1 = result.current.sendMessage('First message');
      const promise2 = result.current.sendMessage('Second message');
      await Promise.all([promise1, promise2]);
    });

    // Should have handled both messages
    expect(result.current.messages.length).toBeGreaterThan(2);
  });

  it('formats timestamps correctly', async () => {
    mockApiClient.chat.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    const userMessage = result.current.messages[0];
    expect(userMessage.timestamp).toBeInstanceOf(Date);
    expect(userMessage.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
