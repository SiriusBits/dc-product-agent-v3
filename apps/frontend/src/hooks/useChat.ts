import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Conversation,
} from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';

interface UseChatOptions {
  conversationId?: string;
  maxResults?: number;
  includeSource?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
  loadConversation: (id: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  );

  const lastQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);
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

      try {
        const request: ChatRequest = {
          query,
          conversation_id: conversationId || undefined,
          max_results: options.maxResults || 10,
          include_sources: options.includeSource !== false,
        };

        const response: ChatResponse = await apiClient.sendMessage(request);

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

        // Update user message with proper ID and conversation ID
        setMessages((prev) => {
          const updated = [...prev];
          const userMsgIndex = updated.findIndex(
            (m) => m.id === userMessage.id
          );
          if (userMsgIndex !== -1) {
            updated[userMsgIndex] = {
              ...updated[userMsgIndex],
              conversation_id: response.conversation_id,
            };
          }
          return [...updated, assistantMessage];
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, don't show error
          return;
        } else {
          setError('Failed to send message. Please try again.');
        }

        // Remove the user message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [conversationId, isLoading, options.maxResults, options.includeSource]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    lastQueryRef.current = '';
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const conversation: Conversation = await apiClient.getConversation(id);
      setMessages(conversation.messages);
      setConversationId(id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Failed to load conversation: ${err.message}`);
      } else {
        setError('Failed to load conversation. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (lastQueryRef.current) {
      await sendMessage(lastQueryRef.current);
    }
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
  };
}
