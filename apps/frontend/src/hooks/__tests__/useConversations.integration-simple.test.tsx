/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { render, createMockConversation } from '@/test/test-utils';

// Import hooks
import { useConversations } from '../useConversations';
import { useChat } from '../useChat';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = 'ApiError';
    }
    isRetryable() {
      return this.status >= 500 || this.status === 0;
    }
  },
}));

import { apiClient } from '@/lib/api-client';

const mockApiClient = apiClient as typeof apiClient & {
  listConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  getConversation: ReturnType<typeof vi.fn>;
};

describe('useConversations Integration Tests - Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue(
      createMockConversation()
    );
    mockApiClient.deleteConversation.mockResolvedValue(undefined);
    mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
  });

  it('should integrate useConversations and useChat hooks', async () => {
    const { result: conversationsResult } = renderHook(() =>
      useConversations()
    );
    const { result: chatResult } = renderHook(() => useChat());

    // Wait for initial load
    await waitFor(() => {
      expect(conversationsResult.current.isLoading).toBe(false);
    });

    // Both hooks should be initialized
    expect(conversationsResult.current.conversations).toEqual([]);
    expect(chatResult.current.messages).toEqual([]);
    expect(chatResult.current.conversationId).toBeNull();
  });

  it('should verify API integration correctness', async () => {
    const { result } = renderHook(() => useConversations());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called correctly
    expect(mockApiClient.listConversations).toHaveBeenCalledWith();
  });

  it('should handle conversation management operations', async () => {
    const { result } = renderHook(() => useConversations());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test create conversation
    const newConversation = createMockConversation({ id: 'new-conv' });
    mockApiClient.createConversation.mockResolvedValue(newConversation);

    const createdConv = await result.current.createConversation();
    expect(createdConv).toEqual(newConversation);
    expect(mockApiClient.createConversation).toHaveBeenCalled();
  });

  it('should verify proper integration with useChat hook', async () => {
    const conversationsHook = renderHook(() => useConversations());
    const chatHook = renderHook(() => useChat());

    // Wait for both hooks to initialize
    await waitFor(() => {
      expect(conversationsHook.result.current.isLoading).toBe(false);
    });

    // Both hooks should work independently
    expect(conversationsHook.result.current.conversations).toEqual([]);
    expect(chatHook.result.current.messages).toEqual([]);

    // Verify they can be used together without conflicts
    expect(conversationsHook.result.current.error).toBeNull();
    expect(chatHook.result.current.error).toBeNull();
  });

  it('should complete conversation management workflow', async () => {
    const { result } = renderHook(() => useConversations());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Create conversation
    const newConv = createMockConversation({
      id: 'workflow-test',
      title: 'Test',
    });
    mockApiClient.createConversation.mockResolvedValue(newConv);

    const created = await result.current.createConversation();
    expect(created).toEqual(newConv);

    // Update title
    await result.current.updateConversationTitle(
      'workflow-test',
      'Updated Title'
    );
    expect(mockApiClient.updateConversationTitle).toHaveBeenCalledWith(
      'workflow-test',
      'Updated Title'
    );

    // Delete conversation
    await result.current.deleteConversation('workflow-test');
    expect(mockApiClient.deleteConversation).toHaveBeenCalledWith(
      'workflow-test'
    );
  });
});
