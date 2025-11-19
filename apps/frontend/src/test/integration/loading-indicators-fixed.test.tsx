/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { setupTest } from '@/test/enhanced-setup';
import type { ChatMessage } from '@repo/shared-types';

// Mock the hooks - EXACT pattern from working test
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
}));

import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { useProducts } from '@/hooks/useProducts';

const mockUseChat = vi.mocked(useChat);
const mockUseConversations = vi.mocked(useConversations);
const mockUseProducts = vi.mocked(useProducts);

describe.sequential('Loading Indicators - Fixed Pattern', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    cleanup();

    // Mock DOM APIs
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });

    // Setup test with reactive mocks - EXACT pattern from working test
    testContext = setupTest({
      initialChatMessages: [],
      initialConversations: [],
      initialProducts: [],
      chatLoading: false,
      productsLoading: false,
      conversationsLoading: false,
      chatError: null,
      productsError: null,
      conversationsError: null,
      enableAutoCleanup: true, // Enable auto cleanup to prevent mock registry conflicts
    });

    // Connect mocks to hook implementations - EXACT pattern from working test
    mockUseChat.mockImplementation(testContext.chatMock.getMock());
    mockUseConversations.mockImplementation(
      testContext.conversationsMock.getMock()
    );
    mockUseProducts.mockImplementation(testContext.productsMock.getMock());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sanity check - component renders', () => {
    testContext.renderComponent(<ChatInterface />);

    // Should find the chat interface
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });

  it('loading indicator appears when isLoading is set to true', async () => {
    // Render component FIRST (like working test)
    testContext.renderComponent(<ChatInterface />);

    // Then update to loading state
    await testContext.updateChat({
      isLoading: true,
    });

    // VERIFY: Loading indicator appears
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Clear loading state
    await testContext.updateChat({
      isLoading: false,
    });

    // VERIFY: Loading indicator disappears
    await waitFor(() => {
      const loadingSpinner = screen.queryByTestId('chat-loading-spinner');
      expect(loadingSpinner).not.toBeInTheDocument();
    });
  });

  it('loading indicator disappears when isLoading is set to false', async () => {
    // Render component FIRST
    testContext.renderComponent(<ChatInterface />);

    // Set loading state
    await testContext.updateChat({
      isLoading: true,
    });

    // Verify loading indicator appears
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Clear loading state
    await testContext.updateChat({
      isLoading: false,
    });

    // VERIFY: Loading indicator disappears
    await waitFor(
      () => {
        const loadingSpinner = screen.queryByTestId('chat-loading-spinner');
        expect(loadingSpinner).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it('handles multiple loading state transitions correctly', async () => {
    // Render component
    testContext.renderComponent(<ChatInterface />);

    // Initially no loading indicator
    expect(
      screen.queryByTestId('chat-loading-spinner')
    ).not.toBeInTheDocument();

    // Set loading state
    await testContext.updateChat({ isLoading: true });

    // VERIFY: Loading indicator appears
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Clear loading state
    await testContext.updateChat({ isLoading: false });

    // VERIFY: Loading indicator disappears
    await waitFor(() => {
      expect(
        screen.queryByTestId('chat-loading-spinner')
      ).not.toBeInTheDocument();
    });

    // Set loading state again
    await testContext.updateChat({ isLoading: true });

    // VERIFY: Loading indicator appears again
    await waitFor(() => {
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
    });

    // Clear loading state again
    await testContext.updateChat({ isLoading: false });

    // VERIFY: Loading indicator disappears again
    await waitFor(() => {
      expect(
        screen.queryByTestId('chat-loading-spinner')
      ).not.toBeInTheDocument();
    });
  });
});
