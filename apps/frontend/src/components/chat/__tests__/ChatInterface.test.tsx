/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../ChatInterface';
import type { ChatMessage } from '@/types';
import { render, MockApiError } from '@/test/test-utils';

// Mock the hooks
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(),
}));

import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';

const mockUseChat = vi.mocked(useChat);
const mockUseConversations = vi.mocked(useConversations);

describe('ChatInterface', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      content: 'What is the viscosity of ASA 150?',
      role: 'user',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      conversation_id: 'conv-123',
    },
    {
      id: '2',
      content: 'ASA 150 has a viscosity of 150 cP at 25°C.',
      role: 'assistant',
      timestamp: new Date('2024-01-01T10:00:01Z'),
      conversation_id: 'conv-123',
      sources: [
        {
          content: 'ASA 150 viscosity: 150 cP',
          score: 0.95,
          source: 'vector',
          metadata: { doc_id: 'asa-150-spec' },
          provenance: { document: 'ASA 150 Technical Bulletin' },
        },
      ],
    },
  ];

  const mockChatHook = {
    messages: mockMessages,
    isLoading: false,
    error: null,
    conversationId: 'conv-123',
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    retryLastMessage: vi.fn(),
    isRetryable: false,
  };

  const mockConversationsHook = {
    conversations: [
      {
        id: 'conv-123',
        title: 'ASA 150 Questions',
        lastMessage: 'ASA 150 has a viscosity of 150 cP at 25°C.',
        timestamp: new Date('2024-01-01T10:00:01Z'),
        messageCount: 2,
        messages: mockMessages,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:01Z'),
      },
    ],
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    loadConversation: vi.fn(),
    loadConversations: vi.fn(),
    updateConversationTitle: vi.fn(),
    retry: vi.fn(),
    isRetryable: false,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock return values
    mockUseChat.mockReturnValue(mockChatHook);
    mockUseConversations.mockReturnValue(mockConversationsHook);

    // Reset mock function implementations
    mockChatHook.sendMessage.mockReset();
    mockChatHook.clearMessages.mockReset();
    mockChatHook.loadConversation.mockReset();
    mockChatHook.retryLastMessage.mockReset();
    mockConversationsHook.createConversation.mockReset();
    mockConversationsHook.deleteConversation.mockReset();
    mockConversationsHook.loadConversation.mockReset();
    mockConversationsHook.updateConversationTitle.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with messages', () => {
    render(<ChatInterface />);

    expect(
      screen.getByText('What is the viscosity of ASA 150?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('ASA 150 has a viscosity of 150 cP at 25°C.')
    ).toBeInTheDocument();
  });

  it('renders message input and send button', () => {
    render(<ChatInterface />);

    expect(
      screen.getByPlaceholderText(/ask about chemical products/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('sends message when form is submitted', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'What is DCA 467 used for?');
    await user.click(sendButton);

    expect(mockChatHook.sendMessage).toHaveBeenCalledWith(
      'What is DCA 467 used for?'
    );
  });

  it('sends message when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(mockChatHook.sendMessage).toHaveBeenCalledWith('Test message');
  });

  it('does not send empty messages', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(mockChatHook.sendMessage).not.toHaveBeenCalled();
  });

  it('disables input and button when loading', () => {
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      isLoading: true,
    });

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading indicator when sending message', () => {
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      isLoading: true,
    });

    render(<ChatInterface />);

    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('displays error message when there is an error', () => {
    const mockError = new MockApiError('Failed to send message', 500);

    mockUseChat.mockReturnValue({
      ...mockChatHook,
      error: mockError,
    });

    render(<ChatInterface />);

    expect(screen.getByText('Failed to send message')).toBeInTheDocument();
  });

  it('clears messages when new chat button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    await user.click(newChatButton);

    expect(mockConversationsHook.createConversation).toHaveBeenCalled();
  });

  it('shows conversation sidebar', () => {
    render(<ChatInterface />);

    expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
  });

  it('handles conversation selection', async () => {
    const user = userEvent.setup();

    // Mock a different conversation ID to test the selection logic
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      conversationId: 'different-conv',
    });

    render(<ChatInterface />);

    const conversationItem = screen.getByText('ASA 150 Questions');
    await user.click(conversationItem);

    expect(mockChatHook.loadConversation).toHaveBeenCalledWith('conv-123');
  });

  it('creates new conversation', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    await user.click(newChatButton);

    expect(mockConversationsHook.createConversation).toHaveBeenCalled();
  });

  it('displays source information for assistant messages', () => {
    render(<ChatInterface />);

    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // Test Ctrl+K for new conversation
    await user.keyboard('{Control>}k{/Control}');
    expect(mockConversationsHook.createConversation).toHaveBeenCalled();
  });

  it('auto-scrolls to bottom when new message is added', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<ChatInterface />);

    // Add a new message
    const newMessages = [
      ...mockMessages,
      {
        id: '3',
        content: 'New message',
        role: 'user' as const,
        timestamp: new Date(),
        conversation_id: 'conv-123',
      },
    ];

    mockUseChat.mockReturnValue({
      ...mockChatHook,
      messages: newMessages,
    });

    rerender(<ChatInterface />);

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it('handles message retry on error', async () => {
    const user = userEvent.setup();

    // Mock an error state
    const mockError = new MockApiError('Failed to send message', 500);
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      error: mockError,
      isRetryable: true,
    });

    render(<ChatInterface />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(mockChatHook.retryLastMessage).toHaveBeenCalled();
  });

  it('formats timestamps correctly', () => {
    render(<ChatInterface />);

    // Check that timestamps are displayed in the conversation sidebar
    // The messages themselves are rendered by ChatHistory/ChatMessage components
    expect(screen.getByText('1/1/2024')).toBeInTheDocument();
  });

  it('handles long messages with proper text wrapping', () => {
    const longMessage = 'A'.repeat(1000);
    const messagesWithLongText = [
      {
        id: '1',
        content: longMessage,
        role: 'user' as const,
        timestamp: new Date(),
        conversation_id: 'conv-123',
      },
    ];

    mockUseChat.mockReturnValue({
      ...mockChatHook,
      messages: messagesWithLongText,
    });

    render(<ChatInterface />);

    const messageElement = screen.getByText(longMessage);
    expect(messageElement).toBeInTheDocument();
  });

  it('supports message selection and copying', async () => {
    const user = userEvent.setup();

    render(<ChatInterface />);

    // Find the assistant message text
    const assistantMessage = screen.getByText(
      'ASA 150 has a viscosity of 150 cP at 25°C.'
    );

    // Find the parent message container by traversing up the DOM
    const messageContainer = assistantMessage.closest(
      '[data-testid="message-container"]'
    );
    expect(messageContainer).toBeInTheDocument();

    // Hover over the message container to make the copy button visible
    await user.hover(messageContainer!);

    // Wait for hover state
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The copy button should now be visible
    const copyButton = screen.queryByRole('button', { name: /copy/i });

    // Just verify the copy button appears on hover - this tests the integration
    expect(copyButton).toBeInTheDocument();
  });
});
