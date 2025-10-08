import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.listConversations();
      setConversations(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Failed to load conversations: ${err.message}`);
      } else {
        setError('Failed to load conversations. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await apiClient.deleteConversation(id);
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(`Failed to delete conversation: ${err.message}`);
      } else {
        throw new Error('Failed to delete conversation. Please try again.');
      }
    }
  }, []);

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      try {
        await apiClient.updateConversationTitle(id, title);
        setConversations((prev) =>
          prev.map((conv) => (conv.id === id ? { ...conv, title } : conv))
        );
      } catch (err) {
        if (err instanceof ApiError) {
          throw new Error(
            `Failed to update conversation title: ${err.message}`
          );
        } else {
          throw new Error(
            'Failed to update conversation title. Please try again.'
          );
        }
      }
    },
    []
  );

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    error,
    loadConversations,
    deleteConversation,
    updateConversationTitle,
  };
}
