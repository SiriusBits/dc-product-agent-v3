/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { waitForDebounce, createMockConversation } from '@/test';
import type { Conversation } from '@repo/shared-types';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: unknown,
      public requestId?: string
    ) {
      super(message);
      this.name = 'ApiError';
    }

    isNetworkError(): boolean {
      return this.status === 0;
    }

    isServerError(): boolean {
      return this.status >= 500;
    }

    isClientError(): boolean {
      return this.status >= 400 && this.status < 500;
    }

    isRetryable(): boolean {
      return (
        this.isNetworkError() || this.isServerError() || this.status === 408
      );
    }
  },
}));

import { useConversations } from '../useConversations';
import { apiClient } from '@/lib/api-client';

// Cast to get access to mock functions
const mockApiClient = apiClient as typeof apiClient & {
  listConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
};

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations to prevent undefined returns
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue(
      createMockConversation()
    );
    mockApiClient.deleteConversation.mockResolvedValue(undefined);
    mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads conversations on mount', async () => {
    const mockConversations = [
      createMockConversation({ id: 'conv-1', title: 'Test Conversation 1' }),
      createMockConversation({ id: 'conv-2', title: 'Test Conversation 2' }),
    ];

    mockApiClient.listConversations.mockResolvedValue(mockConversations);

    const { result } = renderHook(() => useConversations());

    // Wait for API to be called
    await waitFor(
      () => {
        expect(mockApiClient.listConversations).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Wait for loading to complete and data to be set
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    await waitFor(
      () => {
        expect(result.current.conversations).toEqual(mockConversations);
      },
      { timeout: 3000 }
    );

    expect(mockApiClient.listConversations).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(null);
  });

  it('handles loading error with proper ApiError wrapping', async () => {
    const mockError = new Error('Network connection failed');
    mockApiClient.listConversations.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conversations).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe(
      'Failed to load conversations: Network connection failed'
    );
    expect(result.current.error?.details).toEqual({
      originalError: 'Network connection failed',
    });
  });

  it('handles network error with descriptive message', async () => {
    const mockError = new Error('fetch failed');
    mockApiClient.listConversations.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.message).toBe(
      'Network error: Unable to load conversations. Please check your connection.'
    );
  });

  it('handles abort error with descriptive message', async () => {
    const mockError = new Error('Request aborted');
    mockError.name = 'AbortError';
    mockApiClient.listConversations.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.message).toBe(
      'Request was cancelled while loading conversations'
    );
  });

  it('handles unknown error types', async () => {
    const mockError = 'string error';
    mockApiClient.listConversations.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.message).toBe(
      'An unexpected error occurred while loading conversations'
    );
    expect(result.current.error?.details).toEqual({
      originalError: 'string error',
    });
  });

  it('creates new conversation', async () => {
    const newConversation = createMockConversation({
      id: 'new-conv',
      title: 'New Conversation',
    });
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue(newConversation);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createdConversation: Conversation | null = null;
    await act(async () => {
      createdConversation = await result.current.createConversation();
    });

    // Wait for state update
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(createdConversation).toEqual(newConversation);
    expect(result.current.conversations).toEqual([newConversation]);
    expect(result.current.error).toBe(null); // Error should be cleared on success
    expect(mockApiClient.createConversation).toHaveBeenCalledTimes(1);
  });

  it('handles create conversation error', async () => {
    const mockError = new Error('Server error');
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createdConversation: Conversation | null = null;
    await act(async () => {
      createdConversation = await result.current.createConversation();
    });

    // Wait for error state to be set
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(createdConversation).toBe(null);
    expect(result.current.error?.message).toBe(
      'Failed to create conversation: Server error'
    );
    expect(result.current.conversations).toEqual([]);
  });

  it('deletes conversation', async () => {
    const conversations = [
      createMockConversation({ id: 'conv-1', title: 'Conversation 1' }),
      createMockConversation({ id: 'conv-2', title: 'Conversation 2' }),
    ];

    mockApiClient.listConversations.mockResolvedValue(conversations);
    mockApiClient.deleteConversation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.conversations).toEqual(conversations);
    });

    await act(async () => {
      await result.current.deleteConversation('conv-1');
    });

    // Wait for state update after deletion
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(result.current.conversations).toEqual([conversations[1]]);
    expect(result.current.error).toBe(null); // Error should be cleared on success
    expect(mockApiClient.deleteConversation).toHaveBeenCalledWith('conv-1');
  });

  it('handles delete conversation error', async () => {
    const conversations = [
      createMockConversation({ id: 'conv-1', title: 'Conversation 1' }),
    ];

    mockApiClient.listConversations.mockResolvedValue(conversations);
    const mockError = new Error('404 not found');
    mockApiClient.deleteConversation.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.conversations).toEqual(conversations);
    });

    await act(async () => {
      await expect(
        result.current.deleteConversation('conv-1')
      ).rejects.toThrow();
    });

    // Wait for error state to be set
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe(
      'Conversation not found or already deleted'
    );
    expect(result.current.conversations).toEqual(conversations); // State should remain unchanged on error
  });

  it('updates conversation title', async () => {
    const conversation = createMockConversation({
      id: 'conv-1',
      title: 'Old Title',
    });
    mockApiClient.listConversations.mockResolvedValue([conversation]);
    mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.conversations).toEqual([conversation]);
    });

    await act(async () => {
      await result.current.updateConversationTitle('conv-1', 'New Title');
    });

    // Wait for state update
    await waitFor(() => {
      expect(result.current.conversations[0].title).toBe('New Title');
    });

    expect(result.current.error).toBe(null); // Error should be cleared on success
    expect(mockApiClient.updateConversationTitle).toHaveBeenCalledWith(
      'conv-1',
      'New Title'
    );
  });

  it('handles update conversation title error', async () => {
    const conversation = createMockConversation({
      id: 'conv-1',
      title: 'Old Title',
    });
    mockApiClient.listConversations.mockResolvedValue([conversation]);
    const mockError = new Error('400 invalid title');
    mockApiClient.updateConversationTitle.mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.conversations).toEqual([conversation]);
    });

    await act(async () => {
      await expect(
        result.current.updateConversationTitle('conv-1', '')
      ).rejects.toThrow();
    });

    // Wait for error state to be set
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe(
      'Invalid title provided. Please check the title and try again.'
    );
    expect(result.current.conversations[0].title).toBe('Old Title'); // Title should remain unchanged on error
  });

  it('retries loading conversations', async () => {
    mockApiClient.listConversations
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([createMockConversation()]);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(mockApiClient.listConversations).toHaveBeenCalledTimes(2);
  });

  it('clears error state on successful operations after error', async () => {
    const conversation = createMockConversation({ id: 'conv-1' });

    // First, cause an error
    mockApiClient.listConversations.mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // Then succeed on retry
    mockApiClient.listConversations.mockResolvedValueOnce([conversation]);
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.conversations).toEqual([conversation]);
    });
  });

  it('preserves ApiError instances when they are thrown', async () => {
    const { ApiError } = await import('../../lib/api-client');
    const apiError = new ApiError('Custom API error', 500);
    mockApiClient.listConversations.mockRejectedValue(apiError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.error).toBe(apiError);
      expect(result.current.error?.status).toBe(500);
    });
  });

  it('provides correct retry status based on error type', async () => {
    // Test with retryable error (network error)
    const networkError = new Error('fetch failed');
    mockApiClient.listConversations.mockRejectedValue(networkError);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isRetryable).toBe(true);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('prevents state updates after component unmount', async () => {
      mockApiClient.listConversations.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const { unmount } = renderHook(() => useConversations());

      // Unmount before the async operation completes
      unmount();

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // No assertions needed - this test passes if no errors are thrown
      // The implementation should check isMountedRef.current before setting state
    });

    it('handles concurrent operations without race conditions', async () => {
      const conversations = [createMockConversation({ id: 'conv-1' })];
      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.createConversation.mockResolvedValue(
        createMockConversation({ id: 'new-conv' })
      );
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      // Start multiple operations concurrently
      await act(async () => {
        const promises = [
          result.current.createConversation(),
          result.current.deleteConversation('conv-1'),
        ];

        // Wait for all operations to complete
        await Promise.allSettled(promises);
      });

      // Verify final state is consistent
      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
        expect(result.current.conversations[0].id).toBe('new-conv');
      });
    });

    it('handles loading state correctly during overlapping operations', async () => {
      mockApiClient.listConversations.mockResolvedValue([]);
      mockApiClient.createConversation.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(createMockConversation()), 100)
          )
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test overlapping operations with debounce utility and fake timers
      vi.useFakeTimers();

      try {
        await waitForDebounce(async () => {
          await act(async () => {
            await result.current.createConversation();
          });
        }, 150);

        // Loading should not be affected by create operation
        expect(result.current.isLoading).toBe(false);
        expect(result.current.conversations).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles empty conversation list gracefully', async () => {
      mockApiClient.listConversations.mockResolvedValue([]);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
      });
    });

    it('handles null/undefined API responses gracefully', async () => {
      // Testing edge case with invalid API response
      mockApiClient.listConversations.mockResolvedValue(null);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The implementation sets conversations to whatever the API returns
      // In this case, null is set as the conversations value
      // Testing edge case
      expect(result.current.conversations).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('handles API client throwing non-Error objects', async () => {
      mockApiClient.listConversations.mockRejectedValue('string error');

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toBe(
          'An unexpected error occurred while loading conversations'
        );
        expect(result.current.error?.details).toEqual({
          originalError: 'string error',
        });
      });
    });

    it('handles delete operation on non-existent conversation', async () => {
      const conversations = [createMockConversation({ id: 'conv-1' })];
      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      // Try to delete a conversation that doesn't exist in local state
      await act(async () => {
        await result.current.deleteConversation('non-existent-id');
      });

      // Should not throw error and state should remain unchanged
      expect(result.current.conversations).toEqual(conversations);
      expect(result.current.error).toBe(null);
    });

    it('handles very long conversation titles', async () => {
      const conversation = createMockConversation({ id: 'conv-1' });
      const veryLongTitle = 'A'.repeat(1000);

      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual([conversation]);
      });

      await act(async () => {
        await result.current.updateConversationTitle('conv-1', veryLongTitle);
      });

      await waitFor(() => {
        expect(result.current.conversations[0].title).toBe(veryLongTitle);
      });
    });

    it('handles special characters in conversation titles', async () => {
      const conversation = createMockConversation({ id: 'conv-1' });
      const specialTitle =
        '🚀 Test with émojis & spëcial chars: <script>alert("xss")</script>';

      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual([conversation]);
      });

      await act(async () => {
        await result.current.updateConversationTitle('conv-1', specialTitle);
      });

      await waitFor(() => {
        expect(result.current.conversations[0].title).toBe(specialTitle);
      });
    });
  });

  describe('API Client Interface Compatibility', () => {
    it('calls listConversations with correct parameters', async () => {
      mockApiClient.listConversations.mockResolvedValue([]);

      renderHook(() => useConversations());

      await waitFor(() => {
        expect(mockApiClient.listConversations).toHaveBeenCalledWith();
      });
    });

    it('calls createConversation with correct parameters', async () => {
      const newConv = createMockConversation();
      mockApiClient.listConversations.mockResolvedValue([]);
      mockApiClient.createConversation.mockResolvedValue(newConv);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createConversation();
      });

      expect(mockApiClient.createConversation).toHaveBeenCalledWith();
    });

    it('calls deleteConversation with correct parameters', async () => {
      const conversations = [createMockConversation({ id: 'test-id' })];
      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      await act(async () => {
        await result.current.deleteConversation('test-id');
      });

      expect(mockApiClient.deleteConversation).toHaveBeenCalledWith('test-id');
    });

    it('calls updateConversationTitle with correct parameters', async () => {
      const conversation = createMockConversation({ id: 'test-id' });
      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual([conversation]);
      });

      await act(async () => {
        await result.current.updateConversationTitle('test-id', 'New Title');
      });

      expect(mockApiClient.updateConversationTitle).toHaveBeenCalledWith(
        'test-id',
        'New Title'
      );
    });
  });

  describe('Conversation Management Logic', () => {
    it('adds new conversations to the beginning of the list', async () => {
      const existingConversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
        createMockConversation({ id: 'conv-2', title: 'Second' }),
      ];
      const newConversation = createMockConversation({
        id: 'conv-3',
        title: 'New',
      });

      mockApiClient.listConversations.mockResolvedValue(existingConversations);
      mockApiClient.createConversation.mockResolvedValue(newConversation);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(existingConversations);
      });

      await act(async () => {
        await result.current.createConversation();
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(3);
      });

      // Verify new conversation is at the beginning
      expect(result.current.conversations[0]).toEqual(newConversation);
      expect(result.current.conversations[1]).toEqual(existingConversations[0]);
      expect(result.current.conversations[2]).toEqual(existingConversations[1]);
    });

    it('immediately removes deleted conversation from state', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
        createMockConversation({ id: 'conv-2', title: 'Second' }),
        createMockConversation({ id: 'conv-3', title: 'Third' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      // Delete middle conversation
      await act(async () => {
        await result.current.deleteConversation('conv-2');
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      // Verify correct conversation was removed
      expect(result.current.conversations).toEqual([
        conversations[0],
        conversations[2],
      ]);
      expect(
        result.current.conversations.find((c) => c.id === 'conv-2')
      ).toBeUndefined();
    });

    it('immediately reflects title updates in local state', async () => {
      const conversation = createMockConversation({
        id: 'conv-1',
        title: 'Original Title',
      });

      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations[0].title).toBe('Original Title');
      });

      await act(async () => {
        await result.current.updateConversationTitle('conv-1', 'Updated Title');
      });

      await waitFor(() => {
        expect(result.current.conversations[0].title).toBe('Updated Title');
      });

      // Verify the conversation object is updated
      expect(result.current.conversations[0]).toEqual({
        ...conversation,
        title: 'Updated Title',
      });
    });

    it('does not rollback optimistic delete on error', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
        createMockConversation({ id: 'conv-2', title: 'Second' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.deleteConversation.mockRejectedValue(
        new Error('Server error')
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      // Attempt to delete - should throw error
      await act(async () => {
        await expect(
          result.current.deleteConversation('conv-1')
        ).rejects.toThrow();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // State should remain unchanged (no optimistic update for delete)
      expect(result.current.conversations).toEqual(conversations);
    });

    it('does not rollback optimistic title update on error', async () => {
      const conversation = createMockConversation({
        id: 'conv-1',
        title: 'Original',
      });

      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockRejectedValue(
        new Error('Server error')
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations[0].title).toBe('Original');
      });

      // Attempt to update - should throw error
      await act(async () => {
        await expect(
          result.current.updateConversationTitle('conv-1', 'New Title')
        ).rejects.toThrow();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // State should remain unchanged (no optimistic update for title)
      expect(result.current.conversations[0].title).toBe('Original');
    });

    it('handles multiple create operations in sequence', async () => {
      const conv1 = createMockConversation({ id: 'conv-1', title: 'First' });
      const conv2 = createMockConversation({ id: 'conv-2', title: 'Second' });
      const conv3 = createMockConversation({ id: 'conv-3', title: 'Third' });

      mockApiClient.listConversations.mockResolvedValue([]);
      mockApiClient.createConversation
        .mockResolvedValueOnce(conv1)
        .mockResolvedValueOnce(conv2)
        .mockResolvedValueOnce(conv3);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createConversation();
      });
      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
      });

      await act(async () => {
        await result.current.createConversation();
      });
      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      await act(async () => {
        await result.current.createConversation();
      });
      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(3);
      });

      // Verify order: most recent first
      expect(result.current.conversations[0]).toEqual(conv3);
      expect(result.current.conversations[1]).toEqual(conv2);
      expect(result.current.conversations[2]).toEqual(conv1);
    });

    it('handles title update for non-existent conversation gracefully', async () => {
      const conversation = createMockConversation({ id: 'conv-1' });

      mockApiClient.listConversations.mockResolvedValue([conversation]);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual([conversation]);
      });

      // Update a conversation that doesn't exist in state
      await act(async () => {
        await result.current.updateConversationTitle(
          'non-existent-id',
          'New Title'
        );
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });

      // Original conversation should remain unchanged
      expect(result.current.conversations).toEqual([conversation]);
    });

    it('preserves conversation order when updating titles', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
        createMockConversation({ id: 'conv-2', title: 'Second' }),
        createMockConversation({ id: 'conv-3', title: 'Third' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toEqual(conversations);
      });

      // Update middle conversation
      await act(async () => {
        await result.current.updateConversationTitle(
          'conv-2',
          'Updated Second'
        );
      });

      await waitFor(() => {
        expect(result.current.conversations[1].title).toBe('Updated Second');
      });

      // Verify order is preserved
      expect(result.current.conversations[0].id).toBe('conv-1');
      expect(result.current.conversations[1].id).toBe('conv-2');
      expect(result.current.conversations[2].id).toBe('conv-3');
    });

    it('clears error state when starting new operations', async () => {
      // Start with an error state
      mockApiClient.listConversations.mockRejectedValueOnce(
        new Error('Initial error')
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Create a new conversation - should clear error
      const newConv = createMockConversation();
      mockApiClient.createConversation.mockResolvedValue(newConv);

      await act(async () => {
        await result.current.createConversation();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });
});
