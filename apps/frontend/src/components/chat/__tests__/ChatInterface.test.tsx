/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../ChatInterface';
import type { ChatMessage } from '@/types';
import { setupTest, typeIntoInput, submitForm } from '@/test';
import { ApiError } from '@/lib/api-client';

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

  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    // Setup test with reactive mocks
    testContext = setupTest({
      initialChatMessages: mockMessages,
      initialConversationId: 'conv-123',
      initialConversations: [
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
      chatLoading: false,
      conversationsLoading: false,
      chatError: null,
      conversationsError: null,
    });

    // Connect mocks to hook implementations
    mockUseChat.mockImplementation(testContext.chatMock.getMock());
    mockUseConversations.mockImplementation(
      testContext.conversationsMock.getMock()
    );
  });

  it('renders chat interface with messages', () => {
    testContext.renderComponent(<ChatInterface />);

    expect(
      screen.getByText('What is the viscosity of ASA 150?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('ASA 150 has a viscosity of 150 cP at 25°C.')
    ).toBeInTheDocument();
  });

  it('renders message input and send button', () => {
    testContext.renderComponent(<ChatInterface />);

    expect(
      screen.getByPlaceholderText(/ask about chemical products/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('sends message when form is submitted', async () => {
    testContext.renderComponent(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await typeIntoInput(input, 'What is DCA 467 used for?');
    await userEvent.setup().click(sendButton);

    const currentState = testContext.chatMock.getCurrentValue();
    expect(currentState.sendMessage).toHaveBeenCalledWith(
      'What is DCA 467 used for?'
    );
  });

  it('sends message when Enter key is pressed', async () => {
    testContext.renderComponent(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    await typeIntoInput(input, 'Test message');
    await userEvent.setup().keyboard('{Enter}');

    const currentState = testContext.chatMock.getCurrentValue();
    expect(currentState.sendMessage).toHaveBeenCalledWith('Test message');
  });

  it('does not send empty messages', async () => {
    testContext.renderComponent(<ChatInterface />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.setup().click(sendButton);

    const currentState = testContext.chatMock.getCurrentValue();
    expect(currentState.sendMessage).not.toHaveBeenCalled();
  });

  it('disables input and button when loading', async () => {
    testContext.renderComponent(<ChatInterface />);

    // Update to loading state
    await testContext.updateChat({ isLoading: true });

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading indicator when sending message', async () => {
    testContext.renderComponent(<ChatInterface />);

    // Update to loading state
    await testContext.updateChat({ isLoading: true });

    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('displays error message when there is an error', async () => {
    testContext.renderComponent(<ChatInterface />);

    const mockError = new ApiError('Failed to send message', 500);
    await testContext.updateChat({ error: mockError });

    expect(screen.getByText('Failed to send message')).toBeInTheDocument();
  });

  it('clears messages when new chat button is clicked', async () => {
    testContext.renderComponent(<ChatInterface />);

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    await userEvent.setup().click(newChatButton);

    const currentState = testContext.conversationsMock.getCurrentValue();
    expect(currentState.createConversation).toHaveBeenCalled();
  });

  it('shows conversation sidebar', () => {
    testContext.renderComponent(<ChatInterface />);

    expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
  });

  it('handles conversation selection', async () => {
    // Update to different conversation ID to test selection logic
    await testContext.updateChat({ conversationId: 'different-conv' });

    testContext.renderComponent(<ChatInterface />);

    const conversationItem = screen.getByText('ASA 150 Questions');
    await userEvent.setup().click(conversationItem);

    const currentState = testContext.chatMock.getCurrentValue();
    expect(currentState.loadConversation).toHaveBeenCalledWith('conv-123');
  });

  it('creates new conversation', async () => {
    testContext.renderComponent(<ChatInterface />);

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    await userEvent.setup().click(newChatButton);

    const currentState = testContext.conversationsMock.getCurrentValue();
    expect(currentState.createConversation).toHaveBeenCalled();
  });

  it('displays source information for assistant messages', () => {
    testContext.renderComponent(<ChatInterface />);

    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', async () => {
    testContext.renderComponent(<ChatInterface />);

    // Test Ctrl+K for new conversation
    await userEvent.setup().keyboard('{Control>}k{/Control}');

    const currentState = testContext.conversationsMock.getCurrentValue();
    expect(currentState.createConversation).toHaveBeenCalled();
  });

  it('auto-scrolls to bottom when new message is added', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    testContext.renderComponent(<ChatInterface />);

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

    await testContext.updateChat({ messages: newMessages });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it('handles message retry on error', async () => {
    testContext.renderComponent(<ChatInterface />);

    // Mock an error state
    const mockError = new ApiError('Failed to send message', 500);
    await testContext.updateChat({
      error: mockError,
      isRetryable: true,
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.setup().click(retryButton);

    const currentState = testContext.chatMock.getCurrentValue();
    expect(currentState.retryLastMessage).toHaveBeenCalled();
  });

  it('formats timestamps correctly', () => {
    testContext.renderComponent(<ChatInterface />);

    // Check that timestamps are displayed in the conversation sidebar
    // The messages themselves are rendered by ChatHistory/ChatMessage components
    expect(screen.getByText('1/1/2024')).toBeInTheDocument();
  });

  it('handles long messages with proper text wrapping', async () => {
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

    testContext.renderComponent(<ChatInterface />);

    await testContext.updateChat({ messages: messagesWithLongText });

    const messageElement = screen.getByText(longMessage);
    expect(messageElement).toBeInTheDocument();
  });

  it('supports message selection and copying', async () => {
    testContext.renderComponent(<ChatInterface />);

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
    await userEvent.setup().hover(messageContainer!);

    // Wait for hover state
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The copy button should now be visible
    const copyButton = screen.queryByRole('button', { name: /copy/i });

    // Just verify the copy button appears on hover - this tests the integration
    expect(copyButton).toBeInTheDocument();
  });
});
