import { useState, useCallback } from 'react';
import type { Conversation } from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';
import { useApi, useApiQuery } from './useApi';

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Use API query hook to automatically load conversations on mount
  const loadConversationsApi = useApiQuery(
    () => apiClient.listConversations(),
    [],
    {
      onSuccess: (data: Conversation[]) => {
        setConversations(data);
      },
      retryOnMount: true,
    }
  );

  // Use API hook for delete operations
  const deleteConversationApi = useApi(apiClient.deleteConversation);

  // Use API hook for title updates
  const updateTitleApi = useApi(apiClient.updateConversationTitle);

  const loadConversations = useCallback(async () => {
    await loadConversationsApi.execute();
  }, [loadConversationsApi]);

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteConversationApi.execute(id);
      if (deleteConversationApi.error) {
        throw deleteConversationApi.error;
      }
      // Update local state on success
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
    },
    [deleteConversationApi]
  );

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      await updateTitleApi.execute(id, title);
      if (updateTitleApi.error) {
        throw updateTitleApi.error;
      }
      // Update local state on success
      setConversations((prev) =>
        prev.map((conv) => (conv.id === id ? { ...conv, title } : conv))
      );
    },
    [updateTitleApi]
  );

  const retry = useCallback(async () => {
    await loadConversationsApi.retry();
  }, [loadConversationsApi]);

  return {
    conversations,
    isLoading:
      loadConversationsApi.loading ||
      deleteConversationApi.loading ||
      updateTitleApi.loading,
    error:
      loadConversationsApi.error ||
      deleteConversationApi.error ||
      updateTitleApi.error,
    loadConversations,
    deleteConversation,
    updateConversationTitle,
    retry,
    isRetryable: loadConversationsApi.isRetryable,
  };
}
