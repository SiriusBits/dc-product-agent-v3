/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import type { ChatResponse, QueryType } from '@/types';
import {
  render,
  setupTest,
  cleanupTest,
  mockApiClient,
  createMockChatResponse,
  MockApiError,
} from '@/test/test-utils';

describe('Chat Flow Integration', () => {
  const mockChatResponse: ChatResponse = {
    answer:
      'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
    sources: [
      {
        content: 'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
        score: 0.95,
        source: 'vector',
        metadata: {
          doc_id: 'asa-150-spec',
          section: 'properties',
          page: 2,
        },
        provenance: {
          document: 'ASA 150 Technical Bulletin',
          source_file: 'ASA_150_Technical_Bulletin.pdf',
        },
      },
      {
        content: 'ASA 150 is commonly used in coatings applications',
        score: 0.87,
        source: 'kg',
        metadata: {
          entity_type: 'CHEMICAL',
          relationship: 'used_in',
        },
        provenance: {
          document: 'ASA Product Applications',
          confidence: 0.9,
        },
      },
    ],
    conversation_id: 'conv-123',
    query_analysis: {
      query_type: 'specification' as QueryType,
      entities: ['ASA 150'],
      intent_confidence: 0.9,
      suggested_strategy: {},
    },
    response_time_ms: 250,
    kg_enhanced: true,
  };

  beforeEach(() => {
    setupTest();

    // Mock successful API responses by default
    mockApiClient.sendMessage.mockResolvedValue(mockChatResponse);
    mockApiClient.listConversations.mockResolvedValue([]);
    mockApiClient.createConversation.mockResolvedValue({
      id: 'new-conv',
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      title: 'New Conversation',
      metadata: {},
    });
  });

  afterEach(() => {
    cleanupTest();
  });

  it('renders chat interface correctly', async () => {
    render(<ChatInterface />);

    // Check that basic elements are present
    expect(
      screen.getByPlaceholderText(/ask about chemical products/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('completes full chat interaction flow', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // Wait for conversations to load (this might be blocking the interface)
    await waitFor(() => {
      expect(mockApiClient.listConversations).toHaveBeenCalled();
    });

    // Wait for component to be ready
    expect(
      screen.getByPlaceholderText(/ask about chemical products/i)
    ).toBeInTheDocument();

    // 1. User types a question
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'What is the viscosity of ASA 150?');

    // Debug: Check if input value was set
    expect(input).toHaveValue('What is the viscosity of ASA 150?');

    // 2. Check if send button is enabled
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();

    // Mock the API response to resolve immediately
    mockApiClient.sendMessage.mockResolvedValueOnce(mockChatResponse);

    await user.click(sendButton);

    // 3. Verify API was called correctly
    await waitFor(
      () => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
          query: 'What is the viscosity of ASA 150?',
          conversation_id: undefined,
          max_results: 10,
          include_sources: true,
        });
      },
      { timeout: 1000 }
    );

    // 4. Wait for response to appear
    await waitFor(
      () => {
        expect(
          screen.getByText(
            'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
          )
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 5. Verify user message is displayed
    expect(
      screen.getByText('What is the viscosity of ASA 150?')
    ).toBeInTheDocument();

    // 6. Verify sources are displayed
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();

    // 7. Input should be cleared after sending
    expect(input).toHaveValue('');
  });

  it('handles conversation creation and continuation', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // First message
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'What is ASA 150?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(mockChatResponse.answer)).toBeInTheDocument();
    });

    // Second message in same conversation
    const secondResponse = {
      ...mockChatResponse,
      answer: 'ASA 150 is used in coatings and adhesives applications.',
      conversation_id: 'conv-123', // Same conversation
    };
    mockApiClient.sendMessage.mockResolvedValueOnce(secondResponse);

    await user.type(input, 'What is it used for?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 is used in coatings and adhesives applications.'
        )
      ).toBeInTheDocument();
    });

    // Verify second call includes conversation ID
    expect(mockApiClient.sendMessage).toHaveBeenLastCalledWith({
      query: 'What is it used for?',
      conversation_id: 'conv-123',
      max_results: 10,
      include_sources: true,
    });
  });

  it('handles error states and retry functionality', async () => {
    const user = userEvent.setup();

    // Mock API error with proper ApiError
    const apiError = new MockApiError('Network error', 0);
    mockApiClient.sendMessage.mockRejectedValueOnce(apiError);

    render(<ChatInterface />);

    // Send message that will fail
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Test message');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Verify retry button appears
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Mock successful retry
    mockApiClient.sendMessage.mockResolvedValueOnce(mockChatResponse);

    // Click retry
    await user.click(retryButton);

    // Wait for successful response
    await waitFor(() => {
      expect(screen.getByText(mockChatResponse.answer)).toBeInTheDocument();
    });

    // Error should be cleared
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  it('handles source interaction and expansion', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // Send message to get response with sources
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'What is the viscosity of ASA 150?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Sources')).toBeInTheDocument();
    });

    // Click on first source to expand
    const sourceItem = screen.getByText('ASA 150 Technical Bulletin');
    await user.click(sourceItem);

    // Verify source content is expanded
    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).toBeInTheDocument();
    });

    // Verify source metadata
    expect(screen.getByText('95%')).toBeInTheDocument(); // Score
    expect(screen.getByText('vector')).toBeInTheDocument(); // Source type

    // Click again to collapse
    await user.click(sourceItem);
    await waitFor(() => {
      expect(
        screen.queryByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).not.toBeInTheDocument();
    });
  });

  it('handles message copying functionality', async () => {
    const user = userEvent.setup();

    // Clipboard is already mocked in setupTest

    render(<ChatInterface />);

    // Send message
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Test question');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(mockChatResponse.answer)).toBeInTheDocument();
    });

    // Hover over assistant message to show copy button
    const assistantMessage = screen.getByText(mockChatResponse.answer);
    await user.hover(assistantMessage);

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);

    // Verify clipboard was called
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      mockChatResponse.answer
    );
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    // Type message and press Enter to send
    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(mockApiClient.sendMessage).toHaveBeenCalled();

    // Test Ctrl+K for new conversation
    mockApiClient.createConversation.mockResolvedValueOnce({
      id: 'new-conv',
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      title: 'New Conversation',
      metadata: {},
    });
    await user.keyboard('{Control>}k{/Control}');

    expect(mockApiClient.createConversation).toHaveBeenCalled();
  });

  it('handles conversation management', async () => {
    const user = userEvent.setup();

    // Mock existing conversations
    const existingConversations = [
      {
        id: 'conv-1',
        messages: [],
        created_at: new Date('2024-01-01T09:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        title: 'ASA 150 Questions',
        metadata: { message_count: 3 },
      },
    ];
    mockApiClient.listConversations.mockResolvedValue(existingConversations);
    mockApiClient.getConversation.mockResolvedValue(existingConversations[0]);

    render(<ChatInterface />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
    });

    // Click on existing conversation
    const conversationItem = screen.getByText('ASA 150 Questions');
    await user.click(conversationItem);

    // Should load the conversation
    await waitFor(() => {
      expect(mockApiClient.getConversation).toHaveBeenCalledWith('conv-1');
    });

    // Test new conversation creation
    const newChatButton = screen.getByRole('button', { name: /new/i });
    await user.click(newChatButton);

    expect(mockApiClient.createConversation).toHaveBeenCalled();
  });

  it('handles long conversations with scrolling', async () => {
    const user = userEvent.setup();

    // Mock scrollIntoView
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(<ChatInterface />);

    // Send multiple messages to create a long conversation
    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    for (let i = 1; i <= 3; i++) {
      const response = {
        ...mockChatResponse,
        answer: `Response ${i}`,
        conversation_id: 'conv-123',
      };
      mockApiClient.sendMessage.mockResolvedValueOnce(response);

      await user.type(input, `Question ${i}`);
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(`Response ${i}`)).toBeInTheDocument();
      });
    }

    // Verify auto-scroll was called
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('handles concurrent message sending prevention', async () => {
    const user = userEvent.setup();

    // Mock slow API response
    let resolvePromise: (value: ChatResponse) => void;
    const promise = new Promise<ChatResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.sendMessage.mockReturnValue(promise);

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message
    await user.type(input, 'First message');
    await user.click(sendButton);

    // Verify input and button are disabled during loading
    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    // Try to send another message (should be prevented)
    expect(input).toHaveValue(''); // Input should be cleared

    // Resolve the first message
    resolvePromise!(mockChatResponse);
    await promise;

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('persists conversation state across page reloads', async () => {
    const user = userEvent.setup();

    // Set up localStorage with existing messages
    const existingMessages = [
      {
        id: '1',
        content: 'Previous question',
        role: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        conversation_id: 'conv-123',
      },
      {
        id: '2',
        content: 'Previous answer',
        role: 'assistant',
        timestamp: new Date('2024-01-01T10:00:01Z').toISOString(),
        conversation_id: 'conv-123',
      },
    ];
    localStorage.setItem('chat-messages', JSON.stringify(existingMessages));
    localStorage.setItem('current-conversation-id', 'conv-123');

    render(<ChatInterface />);

    // Verify messages are loaded from localStorage
    await waitFor(() => {
      expect(screen.getByText('Previous question')).toBeInTheDocument();
      expect(screen.getByText('Previous answer')).toBeInTheDocument();
    });

    // Send new message to continue conversation
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'New question');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Verify conversation ID is maintained
    await waitFor(() => {
      expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
        query: 'New question',
        conversation_id: 'conv-123',
        max_results: 10,
        include_sources: true,
      });
    });
  });

  it('handles message formatting and markdown rendering', async () => {
    const user = userEvent.setup();

    const responseWithMarkdown = {
      ...mockChatResponse,
      answer:
        'ASA 150 has a **viscosity** of *150 cP* and is used in:\n\n1. Coatings\n2. Adhesives\n\n`ASTM D445` test method.',
    };
    mockApiClient.sendMessage.mockResolvedValue(responseWithMarkdown);

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Tell me about ASA 150');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      // Verify the full response is rendered
      expect(screen.getByText(/ASA 150 has a/)).toBeInTheDocument();
    });

    // Check for specific parts of the markdown content
    await waitFor(() => {
      // Look for text content that should be rendered
      expect(screen.getByText(/viscosity/)).toBeInTheDocument();
      expect(screen.getByText(/150 cP/)).toBeInTheDocument();
      expect(screen.getByText(/Coatings/)).toBeInTheDocument();
      expect(screen.getByText(/ASTM D445/)).toBeInTheDocument();
    });
  });
});
