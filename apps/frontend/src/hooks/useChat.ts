import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ChatRequest } from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const lastQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingRequestsRef = useRef<Set<string>>(new Set());

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
        const messagesWithDates = parsedMessages.map(
          (msg: ChatMessage & { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })
        );
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

  // Cleanup on unmount
  useEffect(() => {
    const abortController = abortControllerRef.current;
    const pendingRequests = pendingRequestsRef.current;

    return () => {
      // Cancel any ongoing request
      if (abortController) {
        abortController.abort();
      }
      // Clear pending requests
      pendingRequests.clear();
    };
  }, []);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      // Prevent concurrent requests with the same query
      if (pendingRequestsRef.current.has(query)) {
        return;
      }

      pendingRequestsRef.current.add(query);
      lastQueryRef.current = query;

      // Clear any previous error when sending a new message
      setError(null);
      setIsLoading(true);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: query,
        role: 'user',
        timestamp: new Date(),
        conversation_id: conversationId || '',
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const request: ChatRequest = {
          query,
          conversation_id: conversationId || undefined,
          max_results: options.maxResults || 10,
          include_sources: options.includeSource !== false,
        };

        const response = await apiClient.sendMessage(request);

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

        setError(null);
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError(
                err instanceof Error ? err.message : 'Unknown error',
                0
              );

        setError(apiError);

        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        pendingRequestsRef.current.delete(query);
      }
    },
    [conversationId, options.maxResults, options.includeSource]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setIsLoading(false);
    lastQueryRef.current = '';
    pendingRequestsRef.current.clear();

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.CONVERSATION_ID);
    } catch (error) {
      console.error('Failed to clear chat data from localStorage:', error);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const conversation = await apiClient.getConversation(id);
      setMessages(conversation.messages);
      setConversationId(conversation.id);
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError(
              err instanceof Error ? err.message : 'Unknown error',
              0
            );
      setError(apiError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (lastQueryRef.current && !isLoading) {
      await sendMessage(lastQueryRef.current);
    }
  }, [sendMessage, isLoading]);

  const isRetryable = error?.isRetryable() ?? false;

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
    isRetryable,
  };
}
