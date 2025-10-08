/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatMessage } from '../ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/types';
import { 
  render, 
  setupTest, 
  cleanupTest, 
  createMockChatMessage,
  createMockSearchResult 
} from '@/test/test-utils';

describe('ChatMessage', () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    cleanupTest();
  });

  const mockUserMessage: ChatMessageType = createMockChatMessage({
    id: '1',
    content: 'What is the viscosity of ASA 150?',
    role: 'user',
    timestamp: new Date('2024-01-01T10:00:00Z'),
  });

  const mockAssistantMessage: ChatMessageType = createMockChatMessage({
    id: '2',
    content: 'ASA 150 has a viscosity of 150 cP at 25°C.',
    role: 'assistant',
    timestamp: new Date('2024-01-01T10:00:01Z'),
    sources: [
      {
        content: 'ASA 150 viscosity: 150 cP',
        score: 0.95,
        source: 'vector',
        metadata: { doc_id: 'asa-150-spec' },
        provenance: { document: 'ASA 150 Technical Bulletin' },
      },
    ],
  };

  const mockErrorMessage: ChatMessageType = {
    id: '3',
    content: 'Failed to process request',
    role: 'user',
    timestamp: new Date('2024-01-01T10:00:02Z'),
    error: 'Network error occurred',
  };

  it('renders user message correctly', () => {
    render(<ChatMessage message={mockUserMessage} />);

    expect(screen.getByText('What is the viscosity of ASA 150?')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    render(<ChatMessage message={mockAssistantMessage} />);

    expect(screen.getByText('ASA 150 has a viscosity of 150 cP at 25°C.')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  it('displays sources for assistant messages', () => {
    render(<ChatMessage message={mockAssistantMessage} />);

    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();
  });

  it('shows source score and type', () => {
    render(<ChatMessage message={mockAssistantMessage} />);

    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('vector')).toBeInTheDocument();
  });

  it('renders error message with error state', () => {
    const onRetry = vi.fn();
    render(<ChatMessage message={mockErrorMessage} onRetry={onRetry} />);

    expect(screen.getByText('Failed to process request')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ChatMessage message={mockErrorMessage} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledWith(mockErrorMessage);
  });

  it('shows copy button on hover', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockUserMessage} />);

    const messageContainer = screen.getByTestId('message-container');
    await user.hover(messageContainer);

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('copies message content to clipboard', async () => {
    const user = userEvent.setup();
    
    // Clipboard is already mocked in setupTest

    render(<ChatMessage message={mockUserMessage} />);

    const messageContainer = screen.getByTestId('message-container');
    await user.hover(messageContainer);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'What is the viscosity of ASA 150?'
    );
  });

  it('formats timestamp correctly', () => {
    const message = {
      ...mockUserMessage,
      timestamp: new Date('2024-01-01T14:30:00Z'),
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
  });

  it('handles messages without sources', () => {
    const messageWithoutSources = {
      ...mockAssistantMessage,
      sources: undefined,
    };

    render(<ChatMessage message={messageWithoutSources} />);

    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('handles empty sources array', () => {
    const messageWithEmptySources = {
      ...mockAssistantMessage,
      sources: [],
    };

    render(<ChatMessage message={messageWithEmptySources} />);

    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('expands and collapses source details', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockAssistantMessage} />);

    const sourceItem = screen.getByText('ASA 150 Technical Bulletin');
    await user.click(sourceItem);

    expect(screen.getByText('ASA 150 viscosity: 150 cP')).toBeInTheDocument();

    // Click again to collapse
    await user.click(sourceItem);
    expect(screen.queryByText('ASA 150 viscosity: 150 cP')).not.toBeInTheDocument();
  });

  it('applies correct styling for user messages', () => {
    render(<ChatMessage message={mockUserMessage} />);

    const messageContainer = screen.getByTestId('message-container');
    expect(messageContainer).toHaveClass('justify-end');
  });

  it('applies correct styling for assistant messages', () => {
    render(<ChatMessage message={mockAssistantMessage} />);

    const messageContainer = screen.getByTestId('message-container');
    expect(messageContainer).toHaveClass('justify-start');
  });

  it('applies error styling for error messages', () => {
    render(<ChatMessage message={mockErrorMessage} />);

    const messageContainer = screen.getByTestId('message-container');
    expect(messageContainer).toHaveClass('border-red-200');
  });

  it('handles long message content with proper wrapping', () => {
    const longMessage = {
      ...mockUserMessage,
      content: 'A'.repeat(1000),
    };

    render(<ChatMessage message={longMessage} />);

    const messageContent = screen.getByText('A'.repeat(1000));
    expect(messageContent).toBeInTheDocument();
  });

  it('renders markdown content in assistant messages', () => {
    const messageWithMarkdown = {
      ...mockAssistantMessage,
      content: 'ASA 150 has a **viscosity** of *150 cP* at 25°C.',
    };

    render(<ChatMessage message={messageWithMarkdown} />);

    expect(screen.getByText('viscosity')).toHaveStyle('font-weight: bold');
    expect(screen.getByText('150 cP')).toHaveStyle('font-style: italic');
  });

  it('handles multiple sources', () => {
    const messageWithMultipleSources = {
      ...mockAssistantMessage,
      sources: [
        {
          content: 'ASA 150 viscosity: 150 cP',
          score: 0.95,
          source: 'vector',
          metadata: { doc_id: 'asa-150-spec' },
          provenance: { document: 'ASA 150 Technical Bulletin' },
        },
        {
          content: 'ASA 150 applications in coatings',
          score: 0.87,
          source: 'kg',
          metadata: { doc_id: 'asa-150-apps' },
          provenance: { document: 'ASA 150 Application Guide' },
        },
      ],
    };

    render(<ChatMessage message={messageWithMultipleSources} />);

    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();
    expect(screen.getByText('ASA 150 Application Guide')).toBeInTheDocument();
  });

  it('shows loading state for pending messages', () => {
    const pendingMessage = {
      ...mockAssistantMessage,
      content: '',
      isPending: true,
    };

    render(<ChatMessage message={pendingMessage} />);

    expect(screen.getByTestId('message-loading')).toBeInTheDocument();
  });

  it('handles source click events', async () => {
    const user = userEvent.setup();
    const onSourceClick = vi.fn();
    
    render(
      <ChatMessage 
        message={mockAssistantMessage} 
        onSourceClick={onSourceClick}
      />
    );

    const sourceItem = screen.getByText('ASA 150 Technical Bulletin');
    await user.click(sourceItem);

    expect(onSourceClick).toHaveBeenCalledWith(mockAssistantMessage.sources![0]);
  });

  it('displays confidence score with appropriate color coding', () => {
    const highConfidenceMessage = {
      ...mockAssistantMessage,
      sources: [
        {
          ...mockAssistantMessage.sources![0],
          score: 0.95,
        },
      ],
    };

    render(<ChatMessage message={highConfidenceMessage} />);

    const scoreElement = screen.getByText('95%');
    expect(scoreElement).toHaveClass('text-green-600');
  });

  it('handles keyboard navigation for interactive elements', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    
    render(<ChatMessage message={mockErrorMessage} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    retryButton.focus();
    
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalled();
  });
});