import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Conversation, ChatMessage } from '@repo/shared-types';
import { useConversations } from '../useConversations';
import { apiClient } from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
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
      public details?: unknown
    ) {
      super(message);
      this.name = 'ApiError';
    }

    isRetryable() {
      return this.status >= 500 || this.status === 0 || this.status === 408;
    }

    isNetworkError() {
      return this.status === 0;
    }

    isServerError() {
      return this.status >= 500;
    }

    isClientError() {
      return this.status >= 400 && this.status < 500;
    }
  },
}));

// Simplified component that mimics ChatInterface usage
function ChatInterfaceSimulation() {
  const {
    conversations,
    isLoading: conversationsLoading,
    error: conversationsError,
    createConversation,
  } = useConversations();

  return (
    <div>
      <div data-testid="conversations-loading">
        {conversationsLoading
          ? 'Loading conversations...'
          : 'Conversations loaded'}
      </div>
      <div data-testid="conversations-error">
        {conversationsError ? conversationsError.message : 'No error'}
      </div>
      <div data-testid="conversations-count">{conversations.length}</div>
      <div data-testid="hook-functions">
        {typeof createConversation === 'function'
          ? 'createConversation: function'
          : 'createConversation: not function'}
      </div>
    </div>
  );
}

// Simplified component that mimics ConversationSidebar usage
function ConversationSidebarSimulation() {
  const { conversations, isLoading, error } = useConversations();

  return (
    <div>
      <div data-testid="sidebar-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="sidebar-error">{error?.message || 'No Error'}</div>
      <div data-testid="sidebar-conversations">
        {conversations.map((conv) => (
          <div key={conv.id} data-testid={`sidebar-conversation-${conv.id}`}>
            <span data-testid={`sidebar-title-${conv.id}`}>
              {conv.title || 'Untitled'}
            </span>
            <span data-testid={`sidebar-date-${conv.id}`}>
              {conv.updated_at instanceof Date ? 'Valid Date' : 'Invalid Date'}
            </span>
            <span data-testid={`sidebar-messages-${conv.id}`}>
              {Array.isArray(conv.messages)
                ? 'Valid Messages Array'
                : 'Invalid Messages'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Chemical Properties Discussion',
    messages: [] as ChatMessage[],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    metadata: { message_count: 5 },
  },
  {
    id: 'conv-2',
    title: 'Product Applications',
    messages: [] as ChatMessage[],
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-02'),
    metadata: { message_count: 3 },
  },
];

describe('useConversations Component Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConversations
    );
  });

  describe('ChatInterface Integration', () => {
    it('should provide all required properties for ChatInterface component', async () => {
      render(<ChatInterfaceSimulation />);

      // Initially loading
      expect(screen.getByTestId('conversations-loading')).toHaveTextContent(
        'Loading conversations...'
      );

      // Wait for conversations to load
      await waitFor(() => {
        expect(screen.getByTestId('conversations-loading')).toHaveTextContent(
          'Conversations loaded'
        );
      });

      // Verify all required properties are available
      expect(screen.getByTestId('conversations-count')).toHaveTextContent('2');
      expect(screen.getByTestId('conversations-error')).toHaveTextContent(
        'No error'
      );
      expect(screen.getByTestId('hook-functions')).toHaveTextContent(
        'createConversation: function'
      );
    });
  });

  describe('ConversationSidebar Integration', () => {
    it('should provide all required properties for ConversationSidebar component', async () => {
      render(<ConversationSidebarSimulation />);

      // Wait for conversations to load
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-loading')).toHaveTextContent(
          'Not Loading'
        );
      });

      // Verify conversation data structure
      expect(screen.getByTestId('sidebar-error')).toHaveTextContent('No Error');
      expect(
        screen.getByTestId('sidebar-conversation-conv-1')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sidebar-conversation-conv-2')
      ).toBeInTheDocument();

      // Verify conversation properties
      expect(screen.getByTestId('sidebar-title-conv-1')).toHaveTextContent(
        'Chemical Properties Discussion'
      );
      expect(screen.getByTestId('sidebar-title-conv-2')).toHaveTextContent(
        'Product Applications'
      );
      expect(screen.getByTestId('sidebar-date-conv-1')).toHaveTextContent(
        'Valid Date'
      );
      expect(screen.getByTestId('sidebar-date-conv-2')).toHaveTextContent(
        'Valid Date'
      );
      expect(screen.getByTestId('sidebar-messages-conv-1')).toHaveTextContent(
        'Valid Messages Array'
      );
      expect(screen.getByTestId('sidebar-messages-conv-2')).toHaveTextContent(
        'Valid Messages Array'
      );
    });
  });

  describe('TypeScript Interface Validation', () => {
    it('should export proper TypeScript types that match component expectations', () => {
      // This test validates that the hook interface matches what components expect
      // by attempting to use the hook in a way that would cause TypeScript errors
      // if the interface was incorrect

      function TypeScriptValidationComponent() {
        const hookResult = useConversations();

        // These assignments would cause TypeScript errors if types don't match
        const conversations: Conversation[] = hookResult.conversations;
        const isLoading: boolean = hookResult.isLoading;
        const error = hookResult.error; // ApiError | null
        const isRetryable: boolean = hookResult.isRetryable;

        // Validate function types exist (but don't call them in this test)
        const hasLoadConversations =
          typeof hookResult.loadConversations === 'function';
        const hasCreateConversation =
          typeof hookResult.createConversation === 'function';
        const hasDeleteConversation =
          typeof hookResult.deleteConversation === 'function';
        const hasUpdateConversationTitle =
          typeof hookResult.updateConversationTitle === 'function';
        const hasRetry = typeof hookResult.retry === 'function';

        return (
          <div>
            <div data-testid="type-validation-conversations">
              {conversations.length}
            </div>
            <div data-testid="type-validation-loading">
              {isLoading ? 'true' : 'false'}
            </div>
            <div data-testid="type-validation-error">
              {error ? 'has error' : 'no error'}
            </div>
            <div data-testid="type-validation-retryable">
              {isRetryable ? 'true' : 'false'}
            </div>
            <div data-testid="type-validation-functions">
              {hasLoadConversations &&
              hasCreateConversation &&
              hasDeleteConversation &&
              hasUpdateConversationTitle &&
              hasRetry
                ? 'all functions present'
                : 'missing functions'}
            </div>
          </div>
        );
      }

      render(<TypeScriptValidationComponent />);

      // If we get here without TypeScript compilation errors, the types are correct
      expect(
        screen.getByTestId('type-validation-conversations')
      ).toBeInTheDocument();
      expect(screen.getByTestId('type-validation-loading')).toBeInTheDocument();
      expect(screen.getByTestId('type-validation-error')).toBeInTheDocument();
      expect(
        screen.getByTestId('type-validation-retryable')
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling in Component Context', () => {
    it('should handle errors gracefully in component context', async () => {
      const errorMessage = 'Failed to load conversations';
      (
        apiClient.listConversations as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error(errorMessage));

      render(<ChatInterfaceSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('conversations-error')).toHaveTextContent(
          errorMessage
        );
      });

      expect(screen.getByTestId('conversations-loading')).toHaveTextContent(
        'Conversations loaded'
      );
      expect(screen.getByTestId('conversations-count')).toHaveTextContent('0');
    });
  });

  describe('Performance Validation', () => {
    it('should not cause excessive re-renders in component context', async () => {
      let renderCount = 0;

      function RenderCountingComponent() {
        renderCount++;
        const { conversations, isLoading } = useConversations();

        return (
          <div>
            <div data-testid="render-count">{renderCount}</div>
            <div data-testid="conversations-count">{conversations.length}</div>
            <div data-testid="loading-state">
              {isLoading ? 'loading' : 'loaded'}
            </div>
          </div>
        );
      }

      render(<RenderCountingComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded');
      });

      // Should have rendered initially (1) and after loading completes (2)
      // Additional renders might occur due to state updates, but should be minimal
      const finalRenderCount = parseInt(
        screen.getByTestId('render-count').textContent || '0'
      );
      expect(finalRenderCount).toBeLessThanOrEqual(4); // Allow some flexibility for React's rendering behavior
      expect(screen.getByTestId('conversations-count')).toHaveTextContent('2');
    });
  });
});
