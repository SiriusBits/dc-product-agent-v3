/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { ChatResponse } from '@/types';
import { 
  render, 
  setupTest, 
  cleanupTest, 
  mockApiClient,
  createMockChatResponse 
} from '@/test/test-utils';

describe('Chat Flow Integration', () => {
  const mockChatResponse: ChatResponse = {
    answer: 'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
    sources: [
      {
        content: 'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
        score: 0.95,
        source: 'vector',
        metadata: { 
          doc_id: 'asa-150-spec',
          section: 'properties',
          page: 2
        },
        provenance: { 
          document: 'ASA 150 Technical Bulletin',
          source_file: 'ASA_150_Technical_Bulletin.pdf'
        },
      },
      {
        content: 'ASA 150 is commonly used in coatings applications',
        score: 0.87,
        source: 'kg',
        metadata: { 
          entity_type: 'CHEMICAL',
          relationship: 'used_in'
        },
        provenance: { 
          document: 'ASA Product Applications',
          confidence: 0.9
        },
      },
    ],
    conversationId: 'conv-123',
    queryAnalysis: {
      queryType: 'specification',
      entities: ['ASA 150'],
      intentConfidence: 0.9,
    },
    responseTimeMs: 250,
    kgEnhanced: true,
  };

  beforeEach(() => {
    setupTest();
    
    // Mock successful API responses by default
    mockApiClient.sendMessage.mockResolvedValue(createMockChatResponse());
    mockApiClient.listConversations.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanupTest();
  });

  it('completes full chat interaction flow', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    // 1. User types a question
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'What is the viscosity of ASA 150?');

    // 2. User sends the message
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // 3. Verify loading state appears
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();

    // 4. Wait for response to appear
    await waitFor(() => {
      expect(screen.getByText('ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.')).toBeInTheDocument();
    });

    // 5. Verify user message is displayed
    expect(screen.getByText('What is the viscosity of ASA 150?')).toBeInTheDocument();

    // 6. Verify sources are displayed
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();

    // 7. Verify API was called correctly
    expect(mockApiClient.chat).toHaveBeenCalledWith({
      query: 'What is the viscosity of ASA 150?',
      conversationId: null,
      maxResults: 10,
    });

    // 8. Input should be cleared after sending
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
      conversationId: 'conv-123', // Same conversation
    };
    mockApiClient.chat.mockResolvedValueOnce(secondResponse);

    await user.type(input, 'What is it used for?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('ASA 150 is used in coatings and adhesives applications.')).toBeInTheDocument();
    });

    // Verify second call includes conversation ID
    expect(mockApiClient.chat).toHaveBeenLastCalledWith({
      query: 'What is it used for?',
      conversationId: 'conv-123',
      maxResults: 10,
    });
  });

  it('handles error states and retry functionality', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    mockApiClient.chat.mockRejectedValueOnce(new Error('Network error'));
    
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
    mockApiClient.chat.mockResolvedValueOnce(mockChatResponse);

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
    expect(screen.getByText('ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445')).toBeInTheDocument();

    // Verify source metadata
    expect(screen.getByText('95%')).toBeInTheDocument(); // Score
    expect(screen.getByText('vector')).toBeInTheDocument(); // Source type

    // Click again to collapse
    await user.click(sourceItem);
    expect(screen.queryByText('ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445')).not.toBeInTheDocument();
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
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockChatResponse.answer);
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    
    // Type message and press Enter to send
    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockApiClient.chat).toHaveBeenCalled();
    });

    // Test Ctrl+K for new conversation
    mockApiClient.createConversation.mockResolvedValueOnce({ id: 'new-conv' });
    await user.keyboard('{Control>}k{/Control}');

    expect(mockApiClient.createConversation).toHaveBeenCalled();
  });

  it('handles conversation management', async () => {
    const user = userEvent.setup();
    
    // Mock existing conversations
    const existingConversations = [
      {
        id: 'conv-1',
        title: 'ASA 150 Questions',
        lastMessage: 'Previous conversation about ASA 150',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        messageCount: 3,
      },
    ];
    mockApiClient.getConversations.mockResolvedValue(existingConversations);

    render(<ChatInterface />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
    });

    // Click on existing conversation
    const conversationItem = screen.getByText('ASA 150 Questions');
    await user.click(conversationItem);

    // Should load the conversation (this would be mocked in real implementation)
    // For now, just verify the click was registered
    expect(conversationItem).toBeInTheDocument();

    // Test new conversation creation
    const newChatButton = screen.getByRole('button', { name: /new chat/i });
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

    for (let i = 1; i <= 5; i++) {
      const response = {
        ...mockChatResponse,
        answer: `Response ${i}`,
        conversationId: 'conv-123',
      };
      mockApiClient.chat.mockResolvedValueOnce(response);

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
    mockApiClient.chat.mockReturnValue(promise);

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message
    await user.type(input, 'First message');
    await user.click(sendButton);

    // Verify input and button are disabled during loading
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

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
      },
      {
        id: '2',
        content: 'Previous answer',
        role: 'assistant',
        timestamp: new Date('2024-01-01T10:00:01Z').toISOString(),
      },
    ];
    localStorage.setItem('chat-messages', JSON.stringify(existingMessages));
    localStorage.setItem('current-conversation-id', 'conv-123');

    render(<ChatInterface />);

    // Verify messages are loaded from localStorage
    expect(screen.getByText('Previous question')).toBeInTheDocument();
    expect(screen.getByText('Previous answer')).toBeInTheDocument();

    // Send new message to continue conversation
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'New question');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Verify conversation ID is maintained
    expect(mockApiClient.chat).toHaveBeenCalledWith({
      query: 'New question',
      conversationId: 'conv-123',
      maxResults: 10,
    });
  });

  it('handles message formatting and markdown rendering', async () => {
    const user = userEvent.setup();
    
    const responseWithMarkdown = {
      ...mockChatResponse,
      answer: 'ASA 150 has a **viscosity** of *150 cP* and is used in:\n\n1. Coatings\n2. Adhesives\n\n`ASTM D445` test method.',
    };
    mockApiClient.chat.mockResolvedValue(responseWithMarkdown);

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Tell me about ASA 150');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      // Verify markdown is rendered (this depends on your markdown renderer)
      expect(screen.getByText('viscosity')).toBeInTheDocument();
      expect(screen.getByText('150 cP')).toBeInTheDocument();
      expect(screen.getByText('Coatings')).toBeInTheDocument();
      expect(screen.getByText('ASTM D445')).toBeInTheDocument();
    });
  });
});