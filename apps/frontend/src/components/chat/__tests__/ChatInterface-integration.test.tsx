import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../ChatInterface';
import { useChat } from '../../../hooks/useChat';
import { useConversations } from '../../../hooks/useConversations';
import type { ChatMessage } from '@repo/shared-types';

// Mock the hooks
vi.mock('../../../hooks/useChat');
vi.mock('../../../hooks/useConversations');

describe('ChatInterface - Integration Tests', () => {
  const mockSendMessage = vi.fn();
  const mockClearMessages = vi.fn();
  const mockLoadConversation = vi.fn();
  const mockRetryLastMessage = vi.fn();
  const mockCreateConversation = vi.fn();
  const mockDeleteConversation = vi.fn();
  const mockUpdateConversationTitle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      conversationId: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      loadConversation: mockLoadConversation,
      retryLastMessage: mockRetryLastMessage,
      isRetryable: false,
    });

    vi.mocked(useConversations).mockReturnValue({
      conversations: [],
      isLoading: false,
      error: null,
      createConversation: mockCreateConversation,
      deleteConversation: mockDeleteConversation,
      updateConversationTitle: mockUpdateConversationTitle,
      refreshConversations: vi.fn(),
    });
  });

  describe('Defensive Programming', () => {
    it('should handle undefined messages array', () => {
      vi.mocked(useChat).mockReturnValue({
        messages: undefined as any,
        isLoading: false,
        error: null,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);

      // Should render without crashing
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('should handle null messages array', () => {
      vi.mocked(useChat).mockReturnValue({
        messages: null as any,
        isLoading: false,
        error: null,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);

      // Should render without crashing
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('should handle undefined conversations array', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: undefined as any,
        isLoading: false,
        error: null,
        createConversation: mockCreateConversation,
        deleteConversation: mockDeleteConversation,
        updateConversationTitle: mockUpdateConversationTitle,
        refreshConversations: vi.fn(),
      });

      render(<ChatInterface />);

      // Should render without crashing
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });
  });

  describe('Test Identifiers', () => {
    it('should have data-testid="chat-interface" on main container', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('should have data-testid="chat-messages" on message display area', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    });

    it('should have data-testid="loading-spinner" when loading', () => {
      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: true,
        error: null,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should have data-testid="chat-error" when error occurs', () => {
      const mockError = {
        message: 'Test error',
        status: 500,
        isRetryable: () => true,
      };

      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: false,
        error: mockError as any,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: true,
      });

      render(<ChatInterface />);
      expect(screen.getByTestId('chat-error')).toBeInTheDocument();
    });
  });

  describe('Message Rendering', () => {
    it('should render empty state when no messages', () => {
      render(<ChatInterface />);
      expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
    });

    it('should render single message correctly', () => {
      const mockMessage: ChatMessage = {
        id: '1',
        content: 'Test message',
        role: 'user',
        timestamp: new Date(),
        conversation_id: 'conv-1',
      };

      vi.mocked(useChat).mockReturnValue({
        messages: [mockMessage],
        isLoading: false,
        error: null,
        conversationId: 'conv-1',
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render multiple messages correctly', () => {
      const mockMessages: ChatMessage[] = [
        {
          id: '1',
          content: 'First message',
          role: 'user',
          timestamp: new Date(),
          conversation_id: 'conv-1',
        },
        {
          id: '2',
          content: 'Second message',
          role: 'assistant',
          timestamp: new Date(),
          conversation_id: 'conv-1',
        },
        {
          id: '3',
          content: 'Third message',
          role: 'user',
          timestamp: new Date(),
          conversation_id: 'conv-1',
        },
      ];

      vi.mocked(useChat).mockReturnValue({
        messages: mockMessages,
        isLoading: false,
        error: null,
        conversationId: 'conv-1',
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when isLoading is true', () => {
      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: true,
        error: null,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: false,
      });

      render(<ChatInterface />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    });

    it('should not display loading indicator when isLoading is false', () => {
      render(<ChatInterface />);
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error occurs', () => {
      const mockError = {
        message: 'Network error occurred',
        status: 500,
        isRetryable: () => true,
      };

      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: false,
        error: mockError as any,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: true,
      });

      render(<ChatInterface />);
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('should display retry button for retryable errors', () => {
      const mockError = {
        message: 'Server error',
        status: 500,
        isRetryable: () => true,
      };

      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: false,
        error: mockError as any,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: true,
      });

      render(<ChatInterface />);
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });

    it('should call retryLastMessage when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockError = {
        message: 'Server error',
        status: 500,
        isRetryable: () => true,
      };

      vi.mocked(useChat).mockReturnValue({
        messages: [],
        isLoading: false,
        error: mockError as any,
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: true,
      });

      render(<ChatInterface />);
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRetryLastMessage).toHaveBeenCalledTimes(1);
    });
  });
});
