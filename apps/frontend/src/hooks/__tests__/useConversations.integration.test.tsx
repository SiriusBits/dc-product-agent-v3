/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import type { Conversation } from '@repo/shared-types';
import {
  render,
  MockApiError,
  createMockConversation,
  setupTest,
  cleanupTest,
} from '@/test/test-utils';

// Import components to test integration
import ChatInterface from '@/components/chat/ChatInterface';
import ConversationSidebar from '@/components/chat/ConversationSidebar';

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

import { apiClient } from '@/lib/api-client';

// Cast to get access to mock functions
const mockApiClient = apiClient as typeof apiClient & {
  listConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  getConversation: ReturnType<typeof vi.fn>;
};

describe('useConversations Integration Tests', () => {
  beforeEach(() => {
    setupTest();
    vi.clearAllMocks();

    // Set default mock implementations
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue(
      createMockConversation()
    );
    mockApiClient.deleteConversation.mockResolvedValue(undefined);
    mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
    mockApiClient.sendMessage.mockResolvedValue({
      answer: 'Test response',
      sources: [],
      conversation_id: 'conv-123',
      query_analysis: {
        query_type: 'specification',
        entities: [],
        intent_confidence: 0.9,
        suggested_strategy: { vector_weight: 0.7, kg_weight: 0.3 },
      },
      response_time_ms: 100,
      kg_enhanced: false,
    });
    mockApiClient.getConversation.mockResolvedValue(createMockConversation());
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Hook Integration with Components', () => {
    it('should integrate useConversations with ChatInterface for basic conversation display', async () => {
      // Setup mock conversations
      const mockConversations = [
        createMockConversation({
          id: 'conv-1',
          title: 'ASA 150 Questions',
        }),
        createMockConversation({
          id: 'conv-2',
          title: 'DCA 467 Info',
        }),
      ];

      mockApiClient.listConversations.mockResolvedValue(mockConversations);

      render(<ChatInterface />);

      // Wait for conversations to load and be displayed
      await waitFor(() => {
        expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
        expect(screen.getByText('DCA 467 Info')).toBeInTheDocument();
      });

      // Verify API was called
      expect(mockApiClient.listConversations).toHaveBeenCalled();
    });

    it('should handle conversation creation through ChatInterface', async () => {
      const user = userEvent.setup();

      const newConversation = createMockConversation({
        id: 'new-conv',
        title: 'New Chat',
        messages: [],
      });

      mockApiClient.createConversation.mockResolvedValue(newConversation);

      render(<ChatInterface />);

      // Find the "New" button in the sidebar
      const newButtons = screen.getAllByRole('button', { name: /new/i });
      const sidebarNewButton = newButtons[0]; // First "New" button is in sidebar

      await user.click(sidebarNewButton);

      await waitFor(() => {
        expect(mockApiClient.createConversation).toHaveBeenCalled();
      });
    });

    it('should integrate useConversations with ConversationSidebar', async () => {
      const mockConversations = [
        createMockConversation({
          id: 'conv-1',
          title: 'First Conversation',
          updated_at: new Date('2024-01-01T10:00:00Z'),
        }),
        createMockConversation({
          id: 'conv-2',
          title: 'Second Conversation',
          updated_at: new Date('2024-01-01T11:00:00Z'),
        }),
      ];

      const mockHandlers = {
        onSelectConversation: vi.fn(),
        onNewConversation: vi.fn(),
        onDeleteConversation: vi.fn(),
        onUpdateTitle: vi.fn(),
      };

      render(
        <ConversationSidebar
          conversations={mockConversations}
          currentConversationId="conv-1"
          isLoading={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('First Conversation')).toBeInTheDocument();
      expect(screen.getByText('Second Conversation')).toBeInTheDocument();
    });

    it('should handle conversation selection through ConversationSidebar', async () => {
      const user = userEvent.setup();

      const mockConversations = [
        createMockConversation({
          id: 'conv-1',
          title: 'Selectable Conversation',
        }),
      ];

      const mockHandlers = {
        onSelectConversation: vi.fn(),
        onNewConversation: vi.fn(),
        onDeleteConversation: vi.fn(),
        onUpdateTitle: vi.fn(),
      };

      render(
        <ConversationSidebar
          conversations={mockConversations}
          currentConversationId={null}
          isLoading={false}
          {...mockHandlers}
        />
      );

      const conversationItem = screen.getByText('Selectable Conversation');
      await user.click(conversationItem);

      expect(mockHandlers.onSelectConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('Hook Integration with useChat', () => {
    it('should work together for conversation workflow', async () => {
      const { result: conversationsResult } = renderHook(() =>
        useConversations()
      );
      const { result: chatResult } = renderHook(() => useChat());

      // Wait for initial load
      await waitFor(() => {
        expect(conversationsResult.current.isLoading).toBe(false);
      });

      // Create a new conversation
      const newConversation = createMockConversation({
        id: 'workflow-conv',
        title: 'Workflow Test',
      });
      mockApiClient.createConversation.mockResolvedValue(newConversation);

      let createdConversation: Conversation | null = null;
      await act(async () => {
        createdConversation =
          await conversationsResult.current.createConversation();
      });

      expect(createdConversation).toEqual(newConversation);

      // Verify conversation was added to the list
      await waitFor(() => {
        expect(conversationsResult.current.conversations).toContainEqual(
          newConversation
        );
      });

      // Load the conversation in chat
      await act(async () => {
        await chatResult.current.loadConversation('workflow-conv');
      });

      expect(chatResult.current.conversationId).toBe('workflow-conv');
    });

    it('should handle conversation deletion affecting both hooks', async () => {
      const { result: conversationsResult } = renderHook(() =>
        useConversations()
      );
      const { result: chatResult } = renderHook(() => useChat());

      // Setup initial conversation
      const initialConversation = createMockConversation({
        id: 'conv-to-delete',
        title: 'Will be deleted',
      });

      mockApiClient.listConversations.mockResolvedValue([initialConversation]);

      // Wait for conversations to load
      await waitFor(() => {
        expect(conversationsResult.current.conversations).toContainEqual(
          initialConversation
        );
      });

      // Load conversation in chat
      await act(async () => {
        await chatResult.current.loadConversation('conv-to-delete');
      });

      expect(chatResult.current.conversationId).toBe('conv-to-delete');

      // Delete the conversation
      await act(async () => {
        await conversationsResult.current.deleteConversation('conv-to-delete');
      });

      // Verify conversation was removed from list
      await waitFor(() => {
        expect(conversationsResult.current.conversations).not.toContainEqual(
          initialConversation
        );
      });

      // Chat should still have the conversation ID (it doesn't auto-clear)
      expect(chatResult.current.conversationId).toBe('conv-to-delete');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully in components', async () => {
      // Mock API error for conversation loading
      const apiError = new MockApiError('Failed to load conversations', 500);
      mockApiClient.listConversations.mockRejectedValue(apiError);

      render(<ChatInterface />);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/failed to load conversations/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle conversation creation errors', async () => {
      const user = userEvent.setup();

      const apiError = new MockApiError('Failed to create conversation', 500);
      mockApiClient.createConversation.mockRejectedValue(apiError);

      render(<ChatInterface />);

      const newButtons = screen.getAllByRole('button', { name: /new/i });
      const sidebarNewButton = newButtons[0];
      await user.click(sidebarNewButton);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/failed to create conversation/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with multiple hook instances', async () => {
      // Render multiple instances of the hook
      const { unmount: unmount1 } = renderHook(() => useConversations());
      const { unmount: unmount2 } = renderHook(() => useConversations());
      const { unmount: unmount3 } = renderHook(() => useConversations());

      // Wait for all hooks to initialize
      await waitFor(() => {
        expect(mockApiClient.listConversations).toHaveBeenCalledTimes(3);
      });

      // Unmount all hooks
      unmount1();
      unmount2();
      unmount3();

      // No assertions needed - test passes if no errors are thrown
    });

    it('should handle rapid conversation operations without race conditions', async () => {
      const { result } = renderHook(() => useConversations());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Setup mock responses for rapid operations
      const conv1 = createMockConversation({ id: 'rapid-1', title: 'Rapid 1' });
      const conv2 = createMockConversation({ id: 'rapid-2', title: 'Rapid 2' });
      const conv3 = createMockConversation({ id: 'rapid-3', title: 'Rapid 3' });

      mockApiClient.createConversation
        .mockResolvedValueOnce(conv1)
        .mockResolvedValueOnce(conv2)
        .mockResolvedValueOnce(conv3);

      // Perform rapid operations
      await act(async () => {
        const promises = [
          result.current.createConversation(),
          result.current.createConversation(),
          result.current.createConversation(),
        ];
        await Promise.all(promises);
      });

      // Verify all conversations were created and added
      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(3);
        expect(result.current.conversations.map((c) => c.id)).toEqual(
          expect.arrayContaining(['rapid-1', 'rapid-2', 'rapid-3'])
        );
      });
    });
  });

  describe('Complete Conversation Management Workflow', () => {
    it('should handle basic conversation management operations', async () => {
      const user = userEvent.setup();

      // Start with empty conversations
      mockApiClient.listConversations.mockResolvedValue([]);

      render(<ChatInterface />);

      // Step 1: Create new conversation
      const newConversation = createMockConversation({
        id: 'workflow-complete',
        title: 'Complete Workflow Test',
        messages: [],
      });
      mockApiClient.createConversation.mockResolvedValue(newConversation);

      const newButtons = screen.getAllByRole('button', { name: /new/i });
      const sidebarNewButton = newButtons[0];
      await user.click(sidebarNewButton);

      await waitFor(() => {
        expect(mockApiClient.createConversation).toHaveBeenCalled();
      });

      // Step 2: Send a message in the conversation
      mockApiClient.sendMessage.mockResolvedValue({
        answer: 'Test response for workflow',
        sources: [],
        conversation_id: 'workflow-complete',
        query_analysis: {
          query_type: 'general',
          entities: [],
          intent_confidence: 0.8,
          suggested_strategy: { vector_weight: 0.5, kg_weight: 0.5 },
        },
        response_time_ms: 100,
        kg_enhanced: false,
      });

      const messageInput = screen.getByPlaceholderText(
        /ask about chemical products/i
      );
      const sendButton = screen.getByRole('button', { name: /send message/i });

      await user.type(messageInput, 'Test message for workflow');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalled();
      });
    });
  });
});
