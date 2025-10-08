/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';
import type { ChatMessage, ChatResponse } from '@/types';
import {
  mockApiClient,
  setupTest,
  cleanupTest,
  createMockChatResponse,
  createMockChatMessage,
} from '@/test/test-utils';

describe('useChat', () => {
  const mockChatResponse: ChatResponse = createMockChatResponse();

  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    cleanupTest();
  });

  it('initializes with empty messages', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.conversationId).toBeNull();
  });

  it('sends message and updates state correctly', async () => {
    mockApiClient.sendMessage.mockResolvedValue(mockChatResponse);

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
    expect(result.current.conversationId).toBe('conv-123');
  });

  it('sets loading state during message sending', async () => {
    let resolvePromise: (value: ChatResponse) => void;
    const promise = new Promise<ChatResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.sendMessage.mockReturnValue(promise);

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
    mockApiClient.sendMessage.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error?.message).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1); // Only user message
  });

  it('clears messages', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
  });

  it('loads conversation from ID', async () => {
    const conversationMessages: ChatMessage[] = [
      createMockChatMessage({
        id: '1',
        content: 'Previous question',
        role: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      }),
      createMockChatMessage({
        id: '2',
        content: 'Previous answer',
        role: 'assistant',
        timestamp: new Date('2024-01-01T10:00:01Z'),
      }),
    ];

    // Mock API call to load conversation
    mockApiClient.getConversation.mockResolvedValue({
      id: 'conv-456',
      messages: conversationMessages,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadConversation('conv-456');
    });

    expect(result.current.messages).toEqual(conversationMessages);
    expect(result.current.conversationId).toBe('conv-456');
  });

  it('handles empty message gracefully', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
  });

  it('handles whitespace-only message gracefully', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('   \n\t  ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
  });

  it('retries failed messages', async () => {
    // First call fails
    mockApiClient.sendMessage.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    mockApiClient.sendMessage.mockResolvedValueOnce(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // Send message that fails
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error?.message).toBe('Network error');

    // Retry the message
    await act(async () => {
      await result.current.retryLastMessage();
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
      conversation_id: 'new-conv-789',
    };

    mockApiClient.sendMessage.mockResolvedValue(responseWithNewConversation);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.conversationId).toBe('new-conv-789');
  });

  it('passes conversation ID to subsequent API calls', async () => {
    mockApiClient.sendMessage.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // First message
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    // Second message should include conversation ID
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    expect(mockApiClient.sendMessage).toHaveBeenLastCalledWith({
      query: 'Second message',
      conversation_id: 'conv-123',
      max_results: 10,
    });
  });

  it('clears error when sending new message', async () => {
    // First call fails
    mockApiClient.sendMessage.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    mockApiClient.sendMessage.mockResolvedValueOnce(mockChatResponse);

    const { result } = renderHook(() => useChat());

    // Send message that fails
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    expect(result.current.error?.message).toBe('Network error');

    // Send another message
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    expect(result.current.error).toBeNull();
  });

  it('handles concurrent message sending', async () => {
    mockApiClient.sendMessage.mockResolvedValue(mockChatResponse);

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
    mockApiClient.sendMessage.mockResolvedValue(mockChatResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    const userMessage = result.current.messages[0];
    expect(userMessage.timestamp).toBeInstanceOf(Date);
    expect(userMessage.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
