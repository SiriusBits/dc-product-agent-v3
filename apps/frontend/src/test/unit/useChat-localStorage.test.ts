/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChatMessage, ChatResponse } from '@repo/shared-types';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: any
    ) {
      super(message);
      this.name = 'ApiError';
    }
    isRetryable() {
      return this.status >= 500 || this.status === 0;
    }
  },
}));

import { useChat } from '@/hooks/useChat';
import { apiClient } from '@/lib/api-client';

describe('useChat localStorage Integration', () => {
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Create a mock localStorage
    const storage = new Map<string, string>();
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn(),
    };

    // Replace global localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Reset API client mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Persistence', () => {
    it('loads messages from localStorage on initialization', async () => {
      const existingMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Persisted message',
          role: 'user',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          conversation_id: 'conv-123',
        },
      ];

      // Pre-populate localStorage
      (mockLocalStorage.setItem as any)(
        'chat-messages',
        JSON.stringify(existingMessages)
      );
      (mockLocalStorage.setItem as any)('current-conversation-id', 'conv-123');

      const { result } = renderHook(() => useChat());

      // Wait for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Verify localStorage was accessed
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('chat-messages');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        'current-conversation-id'
      );

      // Verify messages were loaded
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Persisted message');
      expect(result.current.conversationId).toBe('conv-123');
    });

    it('saves messages to localStorage when messages are added', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Test response',
        sources: [],
        conversation_id: 'conv-456',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 100,
        kg_enhanced: false,
      };

      (apiClient.sendMessage as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      // Send a message
      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      // Verify localStorage was called to save messages
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chat-messages',
        expect.stringContaining('Test query')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'current-conversation-id',
        'conv-456'
      );
    });

    it('saves conversation ID to localStorage when conversation is created', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Response',
        sources: [],
        conversation_id: 'new-conv-789',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 100,
        kg_enhanced: false,
      };

      (apiClient.sendMessage as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      // Send first message (creates conversation)
      await act(async () => {
        await result.current.sendMessage('First message');
      });

      // Verify conversation ID was saved
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'current-conversation-id',
        'new-conv-789'
      );

      expect(result.current.conversationId).toBe('new-conv-789');
    });

    it('clears localStorage when clearMessages is called', async () => {
      // Pre-populate localStorage
      (mockLocalStorage.setItem as any)(
        'chat-messages',
        JSON.stringify([
          {
            id: 'msg-1',
            content: 'Message to clear',
            role: 'user',
            timestamp: new Date(),
            conversation_id: 'conv-123',
          },
        ])
      );
      (mockLocalStorage.setItem as any)('current-conversation-id', 'conv-123');

      const { result } = renderHook(() => useChat());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Clear messages
      await act(async () => {
        result.current.clearMessages();
      });

      // Verify localStorage was cleared
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat-messages');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'current-conversation-id'
      );

      // Verify state was cleared
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.conversationId).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('handles corrupted localStorage data gracefully', async () => {
      // Set corrupted data
      (mockLocalStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'chat-messages') return 'invalid-json';
        if (key === 'current-conversation-id') return 'valid-id';
        return null;
      });

      const { result } = renderHook(() => useChat());

      // Wait for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should handle corrupted data gracefully
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.conversationId).toBeNull();

      // Should clear corrupted data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat-messages');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'current-conversation-id'
      );
    });

    it('handles localStorage quota exceeded error', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Response',
        sources: [],
        conversation_id: 'conv-quota',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 100,
        kg_enhanced: false,
      };

      (apiClient.sendMessage as any).mockResolvedValue(mockResponse);

      // Mock localStorage to throw quota exceeded error
      (mockLocalStorage.setItem as any).mockImplementation(
        (key: string, value: string) => {
          if (key === 'chat-messages') {
            throw new Error('QuotaExceededError');
          }
        }
      );

      const { result } = renderHook(() => useChat());

      // Send message should still work despite localStorage error
      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      // Message should still be in state
      expect(result.current.messages).toHaveLength(2); // user + assistant
      expect(result.current.conversationId).toBe('conv-quota');
    });

    it('handles localStorage being unavailable', async () => {
      // Mock localStorage to be undefined
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockResponse: ChatResponse = {
        answer: 'Response',
        sources: [],
        conversation_id: 'conv-no-storage',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 100,
        kg_enhanced: false,
      };

      (apiClient.sendMessage as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      // Should work without localStorage
      await act(async () => {
        await result.current.sendMessage('Test without storage');
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.conversationId).toBe('conv-no-storage');
    });
  });

  describe('Data Integrity', () => {
    it('preserves message timestamps when saving/loading', async () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const existingMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Message with timestamp',
          role: 'user',
          timestamp: timestamp,
          conversation_id: 'conv-123',
        },
      ];

      // Pre-populate localStorage with JSON that includes timestamp as string
      const messagesJson = JSON.stringify(existingMessages);
      (mockLocalStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'chat-messages') return messagesJson;
        if (key === 'current-conversation-id') return 'conv-123';
        return null;
      });

      const { result } = renderHook(() => useChat());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Verify timestamp was preserved as Date object
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].timestamp).toBeInstanceOf(Date);
      expect(result.current.messages[0].timestamp.toISOString()).toBe(
        timestamp.toISOString()
      );
    });

    it('handles messages with sources correctly', async () => {
      const messageWithSources: ChatMessage = {
        id: 'msg-with-sources',
        content: 'Message with sources',
        role: 'assistant',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        conversation_id: 'conv-sources',
        sources: [
          {
            content: 'Source content',
            score: 0.95,
            source: 'vector',
            metadata: { doc_id: 'test-doc' },
            provenance: { document: 'Test Doc' },
          },
        ],
      };

      // Pre-populate localStorage
      const messagesJson = JSON.stringify([messageWithSources]);
      (mockLocalStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'chat-messages') return messagesJson;
        if (key === 'current-conversation-id') return 'conv-sources';
        return null;
      });

      const { result } = renderHook(() => useChat());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Verify sources were preserved
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].sources).toHaveLength(1);
      expect(result.current.messages[0].sources![0].content).toBe(
        'Source content'
      );
      expect(result.current.messages[0].sources![0].score).toBe(0.95);
    });

    it('maintains conversation continuity across hook re-renders', async () => {
      const existingMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'First message',
          role: 'user',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          conversation_id: 'continuous-conv',
        },
      ];

      // Pre-populate localStorage
      (mockLocalStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'chat-messages') return JSON.stringify(existingMessages);
        if (key === 'current-conversation-id') return 'continuous-conv';
        return null;
      });

      const { result, rerender } = renderHook(() => useChat());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Verify initial state
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.conversationId).toBe('continuous-conv');

      // Re-render the hook
      rerender();

      // State should be maintained
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.conversationId).toBe('continuous-conv');
    });
  });

  describe('Performance', () => {
    it('efficiently handles large message histories', async () => {
      // Create large message history
      const largeHistory: ChatMessage[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `msg-${i}`,
          content: `Message ${i}`,
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          timestamp: new Date(Date.now() + i * 1000),
          conversation_id: 'large-conv',
        })
      );

      const messagesJson = JSON.stringify(largeHistory);
      (mockLocalStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'chat-messages') return messagesJson;
        if (key === 'current-conversation-id') return 'large-conv';
        return null;
      });

      const startTime = performance.now();

      const { result } = renderHook(() => useChat());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should load quickly (less than 100ms)
      expect(duration).toBeLessThan(100);

      // Should load all messages
      expect(result.current.messages).toHaveLength(100);
      expect(result.current.conversationId).toBe('large-conv');
    });

    it('handles localStorage operations efficiently', async () => {
      const mockResponse: ChatResponse = {
        answer: 'Response',
        sources: [],
        conversation_id: 'efficient-conv',
        query_analysis: {
          query_type: 'specification',
          entities: [],
          intent_confidence: 0.9,
          suggested_strategy: {},
        },
        response_time_ms: 100,
        kg_enhanced: false,
      };

      (apiClient.sendMessage as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      // Send multiple messages quickly
      await act(async () => {
        await result.current.sendMessage('Message 1');
      });

      await act(async () => {
        await result.current.sendMessage('Message 2');
      });

      await act(async () => {
        await result.current.sendMessage('Message 3');
      });

      // Should have called setItem for each message (messages and conversation ID)
      const setItemCalls = (mockLocalStorage.setItem as any).mock.calls;
      const messagesCalls = setItemCalls.filter(
        ([key]: [string]) => key === 'chat-messages'
      );

      // Should have multiple calls for messages
      expect(messagesCalls.length).toBeGreaterThan(0);

      // All messages should be in state
      expect(result.current.messages).toHaveLength(6); // 3 user + 3 assistant
    });
  });
});
