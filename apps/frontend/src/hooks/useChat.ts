import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Conversation,
} from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';
import { useApi } from './useApi';

interface UseChatOptions {
  conversationId?: string;
  maxResults?: number;
  includeSource?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ApiError | null;
  conversationId: string | null;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
  loadConversation: (id: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  isRetryable: boolean;
}

const STORAGE_KEYS = {
  MESSAGES: 'chat-messages',
  CONVERSATION_ID: 'current-conversation-id',
} as const;

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  );

  const lastQueryRef = useRef<string>('');

  // Load messages and conversation ID from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const savedConversationId = localStorage.getItem(
        STORAGE_KEYS.CONVERSATION_ID
      );

      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      }

      if (savedConversationId && !options.conversationId) {
        setConversationId(savedConversationId);
      }
    } catch (error) {
      console.error('Failed to load chat data from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.CONVERSATION_ID);
    }
  }, [options.conversationId]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
      } catch (error) {
        console.error('Failed to save messages to localStorage:', error);
      }
    }
  }, [messages]);

  // Save conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (conversationId) {
      try {
        localStorage.setItem(STORAGE_KEYS.CONVERSATION_ID, conversationId);
      } catch (error) {
        console.error('Failed to save conversation ID to localStorage:', error);
      }
    }
  }, [conversationId]);

  // Use the generic API hook for sending messages
  const sendMessageApi = useApi(apiClient.sendMessage, {
    onSuccess: (response: ChatResponse) => {
      // Update conversation ID if it was generated
      if (!conversationId) {
        setConversationId(response.conversation_id);
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `response-${Date.now()}`,
        content: response.answer,
        role: 'assistant',
        sources: response.sources,
        timestamp: new Date(),
        conversation_id: response.conversation_id,
      };

      // Update messages
      setMessages((prev) => {
        const updated = [...prev];
        // Update user message with proper conversation ID
        const lastUserMsgIndex = updated.length - 1;
        if (
          lastUserMsgIndex >= 0 &&
          updated[lastUserMsgIndex].role === 'user'
        ) {
          updated[lastUserMsgIndex] = {
            ...updated[lastUserMsgIndex],
            conversation_id: response.conversation_id,
          };
        }
        return [...updated, assistantMessage];
      });
    },
    onError: () => {
      // Remove the user message on error
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  // Use the generic API hook for loading conversations
  const loadConversationApi = useApi(apiClient.getConversation, {
    onSuccess: (conversation: Conversation) => {
      setMessages(conversation.messages);
      setConversationId(conversation.id);
    },
  });

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || sendMessageApi.loading) return;

      lastQueryRef.current = query;

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: query,
        role: 'user',
        timestamp: new Date(),
        conversation_id: conversationId || '',
      };

      setMessages((prev) => [...prev, userMessage]);

      const request: ChatRequest = {
        query,
        conversation_id: conversationId || undefined,
        max_results: options.maxResults || 10,
        include_sources: options.includeSource !== false,
      };

      await sendMessageApi.execute(request);
    },
    [conversationId, sendMessageApi, options.maxResults, options.includeSource]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    sendMessageApi.reset();
    loadConversationApi.reset();
    lastQueryRef.current = '';

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.CONVERSATION_ID);
    } catch (error) {
      console.error('Failed to clear chat data from localStorage:', error);
    }
  }, [sendMessageApi, loadConversationApi]);

  const loadConversation = useCallback(
    async (id: string) => {
      await loadConversationApi.execute(id);
    },
    [loadConversationApi]
  );

  const retryLastMessage = useCallback(async () => {
    if (lastQueryRef.current) {
      await sendMessage(lastQueryRef.current);
    } else if (sendMessageApi.isRetryable) {
      await sendMessageApi.retry();
    }
  }, [sendMessage, sendMessageApi]);

  return {
    messages,
    isLoading: sendMessageApi.loading || loadConversationApi.loading,
    error: sendMessageApi.error || loadConversationApi.error,
    conversationId,
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
    isRetryable: sendMessageApi.isRetryable || loadConversationApi.isRetryable,
  };
}
