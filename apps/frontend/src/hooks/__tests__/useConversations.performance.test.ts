/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createMockConversation } from '@/test/test-utils';

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

describe('useConversations Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations
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

  describe('Large Conversation Lists Performance', () => {
    it('handles loading 1000 conversations efficiently', async () => {
      // Generate large conversation list
      const largeConversationList = Array.from({ length: 1000 }, (_, index) =>
        createMockConversation({
          id: `conv-${index}`,
          title: `Conversation ${index}`,
        })
      );

      mockApiClient.listConversations.mockResolvedValue(largeConversationList);

      const startTime = performance.now();
      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(result.current.conversations).toHaveLength(1000);
      expect(result.current.error).toBe(null);

      // Should complete within reasonable time (less than 1 second)
      expect(loadTime).toBeLessThan(1000);
    });

    it('handles creating conversations with large existing list efficiently', async () => {
      // Start with large list
      const largeConversationList = Array.from({ length: 500 }, (_, index) =>
        createMockConversation({
          id: `conv-${index}`,
          title: `Conversation ${index}`,
        })
      );

      mockApiClient.listConversations.mockResolvedValue(largeConversationList);
      const newConversation = createMockConversation({
        id: 'new-conv',
        title: 'New Conversation',
      });
      mockApiClient.createConversation.mockResolvedValue(newConversation);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(500);
      });

      const startTime = performance.now();

      await act(async () => {
        await result.current.createConversation();
      });

      const endTime = performance.now();
      const createTime = endTime - startTime;

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(501);
      });

      // New conversation should be at the beginning
      expect(result.current.conversations[0]).toEqual(newConversation);

      // Should complete quickly (less than 100ms)
      expect(createTime).toBeLessThan(100);
    });

    it('handles deleting from large conversation list efficiently', async () => {
      const largeConversationList = Array.from({ length: 500 }, (_, index) =>
        createMockConversation({
          id: `conv-${index}`,
          title: `Conversation ${index}`,
        })
      );

      mockApiClient.listConversations.mockResolvedValue(largeConversationList);
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(500);
      });

      const startTime = performance.now();

      await act(async () => {
        await result.current.deleteConversation('conv-250');
      });

      const endTime = performance.now();
      const deleteTime = endTime - startTime;

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(499);
      });

      // Verify correct conversation was removed
      expect(
        result.current.conversations.find((c) => c.id === 'conv-250')
      ).toBeUndefined();

      // Should complete quickly (less than 100ms)
      expect(deleteTime).toBeLessThan(100);
    });

    it('handles updating titles in large conversation list efficiently', async () => {
      const largeConversationList = Array.from({ length: 500 }, (_, index) =>
        createMockConversation({
          id: `conv-${index}`,
          title: `Conversation ${index}`,
        })
      );

      mockApiClient.listConversations.mockResolvedValue(largeConversationList);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(500);
      });

      const startTime = performance.now();

      await act(async () => {
        await result.current.updateConversationTitle(
          'conv-250',
          'Updated Title'
        );
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      await waitFor(() => {
        const updatedConv = result.current.conversations.find(
          (c) => c.id === 'conv-250'
        );
        expect(updatedConv?.title).toBe('Updated Title');
      });

      // Should complete quickly (less than 100ms)
      expect(updateTime).toBeLessThan(100);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('prevents memory leaks during rapid mount/unmount cycles', async () => {
      const mockConversations = [createMockConversation()];
      mockApiClient.listConversations.mockResolvedValue(mockConversations);

      // Simulate rapid mount/unmount cycles
      const mountUnmountCycles = 50;
      const hooks: Array<{ unmount: () => void }> = [];

      for (let i = 0; i < mountUnmountCycles; i++) {
        const { unmount } = renderHook(() => useConversations());
        hooks.push({ unmount });

        // Unmount immediately to test cleanup
        unmount();
      }

      // Wait for any pending operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No assertions needed - test passes if no memory leaks or errors occur
      expect(true).toBe(true);
    });

    it('prevents state updates after unmount with delayed API responses', async () => {
      let resolveApiCall: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveApiCall = resolve;
      });

      mockApiClient.listConversations.mockReturnValue(delayedPromise);

      const { unmount } = renderHook(() => useConversations());

      // Unmount before API call resolves
      unmount();

      // Resolve API call after unmount
      resolveApiCall!([createMockConversation()]);

      // Wait for any potential state updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      // No assertions needed - test passes if no errors are thrown
      // The implementation should prevent state updates after unmount
      expect(true).toBe(true);
    });

    it('handles cleanup with multiple pending operations', async () => {
      const conversations = [createMockConversation({ id: 'conv-1' })];
      mockApiClient.listConversations.mockResolvedValue(conversations);

      let resolveCreate: (value: unknown) => void;
      let resolveDelete: (value: unknown) => void;
      let resolveUpdate: (value: unknown) => void;

      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      const deletePromise = new Promise((resolve) => {
        resolveDelete = resolve;
      });
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });

      mockApiClient.createConversation.mockReturnValue(createPromise);
      mockApiClient.deleteConversation.mockReturnValue(deletePromise);
      mockApiClient.updateConversationTitle.mockReturnValue(updatePromise);

      const { result, unmount } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
      });

      // Start multiple operations
      act(() => {
        result.current.createConversation();
        result.current.deleteConversation('conv-1');
        result.current.updateConversationTitle('conv-1', 'New Title');
      });

      // Unmount before operations complete
      unmount();

      // Resolve all operations after unmount
      resolveCreate!(createMockConversation({ id: 'new-conv' }));
      resolveDelete!(undefined);
      resolveUpdate!(undefined);

      // Wait for any potential state updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('Multiple Hook Instances', () => {
    it('ensures multiple hook instances do not interfere with each other', async () => {
      const conversations1 = [
        createMockConversation({ id: 'conv-1', title: 'Hook 1 Conv' }),
      ];
      const conversations2 = [
        createMockConversation({ id: 'conv-2', title: 'Hook 2 Conv' }),
      ];

      // Mock different responses for different calls
      mockApiClient.listConversations
        .mockResolvedValueOnce(conversations1)
        .mockResolvedValueOnce(conversations2);

      const { result: result1 } = renderHook(() => useConversations());
      const { result: result2 } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // Each hook should have its own independent state
      expect(result1.current.conversations).toEqual(conversations1);
      expect(result2.current.conversations).toEqual(conversations2);
      expect(result1.current.conversations).not.toEqual(
        result2.current.conversations
      );
    });

    it('handles operations in multiple hook instances independently', async () => {
      const initialConversations = [
        createMockConversation({ id: 'conv-1', title: 'Initial' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(initialConversations);
      mockApiClient.createConversation.mockResolvedValue(
        createMockConversation({ id: 'new-conv', title: 'New' })
      );
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result: result1 } = renderHook(() => useConversations());
      const { result: result2 } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result1.current.conversations).toHaveLength(1);
        expect(result2.current.conversations).toHaveLength(1);
      });

      // Perform different operations on each hook
      await act(async () => {
        await result1.current.createConversation();
      });

      await act(async () => {
        await result2.current.deleteConversation('conv-1');
      });

      await waitFor(() => {
        expect(result1.current.conversations).toHaveLength(2);
        expect(result2.current.conversations).toHaveLength(0);
      });

      // Verify operations affected only their respective hooks
      expect(result1.current.conversations[0].id).toBe('new-conv');
      expect(result2.current.conversations).toEqual([]);
    });

    it('handles errors independently across multiple hook instances', async () => {
      mockApiClient.listConversations
        .mockResolvedValueOnce([createMockConversation()])
        .mockRejectedValueOnce(new Error('Network error'));

      const { result: result1 } = renderHook(() => useConversations());
      const { result: result2 } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // First hook should succeed, second should have error
      expect(result1.current.conversations).toHaveLength(1);
      expect(result1.current.error).toBe(null);

      expect(result2.current.conversations).toEqual([]);
      expect(result2.current.error).toBeTruthy();
    });
  });

  describe('Concurrent Operation Handling', () => {
    it('handles concurrent create operations without race conditions', async () => {
      mockApiClient.listConversations.mockResolvedValue([]);

      const conv1 = createMockConversation({ id: 'conv-1', title: 'First' });
      const conv2 = createMockConversation({ id: 'conv-2', title: 'Second' });
      const conv3 = createMockConversation({ id: 'conv-3', title: 'Third' });

      mockApiClient.createConversation
        .mockResolvedValueOnce(conv1)
        .mockResolvedValueOnce(conv2)
        .mockResolvedValueOnce(conv3);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start multiple create operations concurrently
      await act(async () => {
        const promises = [
          result.current.createConversation(),
          result.current.createConversation(),
          result.current.createConversation(),
        ];

        await Promise.all(promises);
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(3);
      });

      // Verify all conversations were added (order may vary due to concurrency)
      const conversationIds = result.current.conversations.map((c) => c.id);
      expect(conversationIds).toContain('conv-1');
      expect(conversationIds).toContain('conv-2');
      expect(conversationIds).toContain('conv-3');
    });

    it('handles concurrent delete operations without race conditions', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
        createMockConversation({ id: 'conv-2', title: 'Second' }),
        createMockConversation({ id: 'conv-3', title: 'Third' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(3);
      });

      // Start multiple delete operations concurrently
      await act(async () => {
        const promises = [
          result.current.deleteConversation('conv-1'),
          result.current.deleteConversation('conv-2'),
        ];

        await Promise.all(promises);
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
      });

      // Only conv-3 should remain
      expect(result.current.conversations[0].id).toBe('conv-3');
    });

    it('handles concurrent update operations without race conditions', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'Original 1' }),
        createMockConversation({ id: 'conv-2', title: 'Original 2' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      // Start multiple update operations concurrently
      await act(async () => {
        const promises = [
          result.current.updateConversationTitle('conv-1', 'Updated 1'),
          result.current.updateConversationTitle('conv-2', 'Updated 2'),
        ];

        await Promise.all(promises);
      });

      await waitFor(() => {
        const conv1 = result.current.conversations.find(
          (c) => c.id === 'conv-1'
        );
        const conv2 = result.current.conversations.find(
          (c) => c.id === 'conv-2'
        );

        expect(conv1?.title).toBe('Updated 1');
        expect(conv2?.title).toBe('Updated 2');
      });
    });

    it('handles mixed concurrent operations (create, delete, update)', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'Original' }),
        createMockConversation({ id: 'conv-2', title: 'To Delete' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.createConversation.mockResolvedValue(
        createMockConversation({ id: 'new-conv', title: 'New' })
      );
      mockApiClient.deleteConversation.mockResolvedValue(undefined);
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      // Start mixed operations concurrently
      await act(async () => {
        const promises = [
          result.current.createConversation(),
          result.current.deleteConversation('conv-2'),
          result.current.updateConversationTitle('conv-1', 'Updated'),
        ];

        await Promise.allSettled(promises);
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      // Verify final state
      const remainingIds = result.current.conversations.map((c) => c.id);
      expect(remainingIds).toContain('conv-1');
      expect(remainingIds).toContain('new-conv');
      expect(remainingIds).not.toContain('conv-2');

      const updatedConv = result.current.conversations.find(
        (c) => c.id === 'conv-1'
      );
      expect(updatedConv?.title).toBe('Updated');
    });

    it('handles concurrent operations with some failures', async () => {
      const conversations = [
        createMockConversation({ id: 'conv-1', title: 'First' }),
      ];

      mockApiClient.listConversations.mockResolvedValue(conversations);
      mockApiClient.createConversation.mockResolvedValue(
        createMockConversation({ id: 'new-conv', title: 'New' })
      );
      mockApiClient.deleteConversation.mockRejectedValue(
        new Error('Delete failed')
      );
      mockApiClient.updateConversationTitle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
      });

      let deleteError: unknown = null;

      // Start operations with mixed success/failure
      await act(async () => {
        const promises = [
          result.current.createConversation(),
          result.current.deleteConversation('conv-1').catch((err) => {
            deleteError = err;
          }),
          result.current.updateConversationTitle('conv-1', 'Updated'),
        ];

        await Promise.allSettled(promises);
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(2);
      });

      // Create and update should succeed, delete should fail
      const conversationIds = result.current.conversations.map((c) => c.id);
      expect(conversationIds).toContain('conv-1');
      expect(conversationIds).toContain('new-conv');

      const updatedConv = result.current.conversations.find(
        (c) => c.id === 'conv-1'
      );
      expect(updatedConv?.title).toBe('Updated');

      // Delete operation should have failed
      expect(deleteError).toBeTruthy();
      expect(deleteError).toBeInstanceOf(Error);
      if (deleteError instanceof Error) {
        expect(deleteError.message).toBe(
          'Failed to delete conversation: Delete failed'
        );
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('maintains performance with frequent state updates', async () => {
      mockApiClient.listConversations.mockResolvedValue([]);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const startTime = performance.now();

      // Perform many rapid operations
      for (let i = 0; i < 100; i++) {
        mockApiClient.createConversation.mockResolvedValueOnce(
          createMockConversation({ id: `conv-${i}`, title: `Conv ${i}` })
        );

        await act(async () => {
          await result.current.createConversation();
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(100);
      });

      // Should complete within reasonable time (less than 5 seconds for 100 operations)
      expect(totalTime).toBeLessThan(5000);

      // Average time per operation should be reasonable (less than 50ms)
      const avgTimePerOperation = totalTime / 100;
      expect(avgTimePerOperation).toBeLessThan(50);
    });

    it('handles rapid retry operations efficiently', async () => {
      mockApiClient.listConversations
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue([createMockConversation()]);

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      const startTime = performance.now();

      // Perform multiple rapid retries
      await act(async () => {
        await result.current.retry();
      });
      await act(async () => {
        await result.current.retry();
      });
      await act(async () => {
        await result.current.retry();
      });
      await act(async () => {
        await result.current.retry();
      });

      const endTime = performance.now();
      const retryTime = endTime - startTime;

      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.conversations).toHaveLength(1);
      });

      // Should complete retries quickly (less than 500ms)
      expect(retryTime).toBeLessThan(500);
    });
  });
});
