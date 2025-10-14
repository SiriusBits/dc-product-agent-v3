/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import {
  setupFixedLoadingMocks,
  cleanupFixedLoadingMocks,
} from '@/test/fixed-loading-mocks';
import { ApiError } from '@/lib/api-client';

describe('Hook Mock Test', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

  afterEach(() => {
    cleanupFixedLoadingMocks();
  });

  it('should return error from mocked useChat hook', async () => {
    const networkError = new ApiError('Network error', 0);
    testHelpers = setupFixedLoadingMocks({
      simulateErrors: {
        sendMessage: networkError,
      },
    });

    const { result } = renderHook(() => useChat());

    console.log('useChat result:', result.current);
    console.log('useChat error:', result.current.error);
    console.log('useChat error message:', result.current.error?.message);

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should return error from mocked useConversations hook', async () => {
    const conversationError = new ApiError('Conversation error', 500);
    testHelpers = setupFixedLoadingMocks({
      simulateErrors: {
        loadConversations: conversationError,
      },
    });

    const { result } = renderHook(() => useConversations());

    console.log('useConversations result:', result.current);
    console.log('useConversations error:', result.current.error);
    console.log(
      'useConversations error message:',
      result.current.error?.message
    );

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Conversation error');
  });
});
