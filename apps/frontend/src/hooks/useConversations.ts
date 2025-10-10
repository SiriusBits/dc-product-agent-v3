import { useState, useCallback, useEffect, useRef } from 'react';
import type { Conversation } from '@repo/shared-types';
import { apiClient, ApiError } from '../lib/api-client';

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<Conversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Load conversations function
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.listConversations();
      if (!isMountedRef.current) return;

      setConversations(data);
      setError(null); // Clear any previous errors on success
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      // Ensure all errors are properly wrapped in ApiError instances
      let apiError: ApiError;
      if (err instanceof ApiError) {
        apiError = err;
      } else if (err instanceof Error) {
        // Create descriptive error message based on error type
        const message =
          err.name === 'AbortError'
            ? 'Request was cancelled while loading conversations'
            : err.message.includes('fetch')
              ? 'Network error: Unable to load conversations. Please check your connection.'
              : `Failed to load conversations: ${err.message}`;
        apiError = new ApiError(message, 0, { originalError: err.message });
      } else {
        // Handle unknown error types
        apiError = new ApiError(
          'An unexpected error occurred while loading conversations',
          0,
          { originalError: String(err) }
        );
      }

      setError(apiError);
      setIsLoading(false);
    }
  }, []);

  // Create conversation function
  const createConversation =
    useCallback(async (): Promise<Conversation | null> => {
      setError(null);

      try {
        const newConversation = await apiClient.createConversation();
        if (!isMountedRef.current) return null;

        // Add new conversation to the beginning of the list
        setConversations((prev) => [newConversation, ...prev]);
        setError(null); // Clear any previous errors on success
        return newConversation;
      } catch (err) {
        if (!isMountedRef.current) return null;

        // Ensure all errors are properly wrapped in ApiError instances
        let apiError: ApiError;
        if (err instanceof ApiError) {
          apiError = err;
        } else if (err instanceof Error) {
          // Create descriptive error message based on error type
          const message =
            err.name === 'AbortError'
              ? 'Request was cancelled while creating conversation'
              : err.message.includes('fetch')
                ? 'Network error: Unable to create conversation. Please check your connection.'
                : `Failed to create conversation: ${err.message}`;
          apiError = new ApiError(message, 0, { originalError: err.message });
        } else {
          // Handle unknown error types
          apiError = new ApiError(
            'An unexpected error occurred while creating conversation',
            0,
            { originalError: String(err) }
          );
        }

        setError(apiError);
        return null;
      }
    }, []);

  // Delete conversation function
  const deleteConversation = useCallback(async (id: string) => {
    setError(null);

    try {
      await apiClient.deleteConversation(id);
      if (!isMountedRef.current) return;

      // Remove conversation from local state
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      setError(null); // Clear any previous errors on success
    } catch (err) {
      if (!isMountedRef.current) return;

      // Ensure all errors are properly wrapped in ApiError instances
      let apiError: ApiError;
      if (err instanceof ApiError) {
        apiError = err;
      } else if (err instanceof Error) {
        // Create descriptive error message based on error type
        const message =
          err.name === 'AbortError'
            ? 'Request was cancelled while deleting conversation'
            : err.message.includes('fetch')
              ? 'Network error: Unable to delete conversation. Please check your connection.'
              : err.message.includes('404') || err.message.includes('not found')
                ? 'Conversation not found or already deleted'
                : `Failed to delete conversation: ${err.message}`;
        apiError = new ApiError(message, 0, { originalError: err.message });
      } else {
        // Handle unknown error types
        apiError = new ApiError(
          'An unexpected error occurred while deleting conversation',
          0,
          { originalError: String(err) }
        );
      }

      setError(apiError);
      throw apiError;
    }
  }, []);

  // Update conversation title function
  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      setError(null);

      try {
        await apiClient.updateConversationTitle(id, title);
        if (!isMountedRef.current) return;

        // Update conversation title in local state
        setConversations((prev) =>
          prev.map((conv) => (conv.id === id ? { ...conv, title } : conv))
        );
        setError(null); // Clear any previous errors on success
      } catch (err) {
        if (!isMountedRef.current) return;

        // Ensure all errors are properly wrapped in ApiError instances
        let apiError: ApiError;
        if (err instanceof ApiError) {
          apiError = err;
        } else if (err instanceof Error) {
          // Create descriptive error message based on error type
          const message =
            err.name === 'AbortError'
              ? 'Request was cancelled while updating conversation title'
              : err.message.includes('fetch')
                ? 'Network error: Unable to update conversation title. Please check your connection.'
                : err.message.includes('404') ||
                    err.message.includes('not found')
                  ? 'Conversation not found or no longer exists'
                  : err.message.includes('400') ||
                      err.message.includes('invalid')
                    ? 'Invalid title provided. Please check the title and try again.'
                    : `Failed to update conversation title: ${err.message}`;
          apiError = new ApiError(message, 0, { originalError: err.message });
        } else {
          // Handle unknown error types
          apiError = new ApiError(
            'An unexpected error occurred while updating conversation title',
            0,
            { originalError: String(err) }
          );
        }

        setError(apiError);
        throw apiError;
      }
    },
    []
  );

  // Retry function
  const retry = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Cleanup on unmount - prevent state updates after unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    conversations,
    isLoading,
    error,
    loadConversations,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    retry,
    isRetryable: error?.isRetryable() ?? false,
  };
}
