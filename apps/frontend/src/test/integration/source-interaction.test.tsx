/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatMessage from '@/components/chat/ChatMessage';
import type {
  ChatMessage as ChatMessageType,
  RetrievalResult,
} from '@repo/shared-types';
import { render } from '@/test/enhanced-test-utils';

describe('Source Interaction and Expansion', () => {
  const mockSources: RetrievalResult[] = [
    {
      content: 'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
      score: 0.95,
      source: 'vector' as const,
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
      source: 'kg' as const,
      metadata: {
        entity_type: 'CHEMICAL',
        relationship: 'used_in',
      },
      provenance: {
        document: 'ASA Product Applications',
        confidence: 0.9,
      },
    },
  ];

  const mockMessage: ChatMessageType = {
    id: 'assistant-msg-1',
    content:
      'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
    role: 'assistant',
    conversation_id: 'conv-123',
    timestamp: new Date(),
    sources: mockSources,
  };

  beforeEach(() => {
    // Mock DOM APIs
    Element.prototype.scrollIntoView = vi.fn();

    // Mock clipboard API with proper spy
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays sources with correct metadata', async () => {
    render(<ChatMessage message={mockMessage} />);

    // Verify the assistant message content appears
    expect(
      screen.getByText(
        'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
      )
    ).toBeInTheDocument();

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Verify source metadata is displayed
    expect(screen.getByText('95%')).toBeInTheDocument(); // First source score
    expect(screen.getByText('87%')).toBeInTheDocument(); // Second source score
    expect(screen.getByText('VECTOR')).toBeInTheDocument(); // First source type
    expect(screen.getByText('KG')).toBeInTheDocument(); // Second source type

    // Verify document names are displayed
    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();
    expect(screen.getByText('ASA Product Applications')).toBeInTheDocument();

    // Verify page information is displayed
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('handles source card expansion and collapse', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Find the first source card by document name
    const firstSourceCard = screen.getByText('ASA 150 Technical Bulletin');
    expect(firstSourceCard).toBeInTheDocument();

    // Initially, the source content should not be visible (collapsed)
    expect(
      screen.queryByText(
        'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
      )
    ).not.toBeInTheDocument();

    // Click to expand the source
    await user.click(firstSourceCard);

    // Verify source content is now visible (expanded)
    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).toBeInTheDocument();
    });

    // Verify the chevron icon indicates expansion
    const chevronDown = document.querySelector('.lucide-chevron-down');
    expect(chevronDown).toBeInTheDocument();

    // Click again to collapse
    await user.click(firstSourceCard);

    // Verify source content is hidden again (collapsed)
    await waitFor(() => {
      expect(
        screen.queryByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).not.toBeInTheDocument();
    });

    // Verify the chevron icon indicates collapse
    await waitFor(() => {
      const chevronRight = document.querySelector('.lucide-chevron-right');
      expect(chevronRight).toBeInTheDocument();
    });
  });

  it('handles multiple source expansions independently', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    const firstSourceCard = screen.getByText('ASA 150 Technical Bulletin');
    const secondSourceCard = screen.getByText('ASA Product Applications');

    // Expand first source
    await user.click(firstSourceCard);

    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).toBeInTheDocument();
    });

    // Second source content should still be hidden
    expect(
      screen.queryByText('ASA 150 is commonly used in coatings applications')
    ).not.toBeInTheDocument();

    // Expand second source
    await user.click(secondSourceCard);

    await waitFor(() => {
      expect(
        screen.getByText('ASA 150 is commonly used in coatings applications')
      ).toBeInTheDocument();
    });

    // Both source contents should now be visible
    expect(
      screen.getByText(
        'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('ASA 150 is commonly used in coatings applications')
    ).toBeInTheDocument();

    // Collapse first source
    await user.click(firstSourceCard);

    await waitFor(() => {
      expect(
        screen.queryByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).not.toBeInTheDocument();
    });

    // Second source should still be expanded
    expect(
      screen.getByText('ASA 150 is commonly used in coatings applications')
    ).toBeInTheDocument();
  });

  it('displays source types with correct styling', async () => {
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Check that source type badges are displayed with correct text
    const vectorBadge = screen.getByText('VECTOR');
    const kgBadge = screen.getByText('KG');

    expect(vectorBadge).toBeInTheDocument();
    expect(kgBadge).toBeInTheDocument();

    // Verify the badges have the correct CSS classes for styling
    expect(vectorBadge.closest('.bg-blue-50')).toBeInTheDocument();
    expect(kgBadge.closest('.bg-green-50')).toBeInTheDocument();
  });

  it('displays confidence scores with correct color coding', async () => {
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Check confidence scores
    const highScore = screen.getByText('95%');
    const mediumScore = screen.getByText('87%');

    expect(highScore).toBeInTheDocument();
    expect(mediumScore).toBeInTheDocument();

    // Verify color coding (high score should be green, medium should be yellow)
    expect(highScore).toHaveClass('text-green-600');
    expect(mediumScore).toHaveClass('text-yellow-600');
  });

  it('handles source cards with missing metadata gracefully', async () => {
    // Create a source with minimal metadata
    const minimalSource: RetrievalResult = {
      content: 'Minimal source content',
      score: 0.75,
      source: 'vector' as const,
      metadata: {},
      provenance: {},
    };

    const messageWithMinimalSource: ChatMessageType = {
      id: 'assistant-msg-1',
      content: 'Test response',
      role: 'assistant',
      conversation_id: 'conv-123',
      timestamp: new Date(),
      sources: [minimalSource],
    };

    render(<ChatMessage message={messageWithMinimalSource} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (1)')).toBeInTheDocument();

    // Should display "Unknown Document" when document name is missing
    expect(screen.getByText('Unknown Document')).toBeInTheDocument();

    // Should still display the score
    expect(screen.getByText('75%')).toBeInTheDocument();

    // Should still display the source type
    expect(screen.getByText('VECTOR')).toBeInTheDocument();
  });

  it('handles source interaction without interfering with message functionality', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Expand a source
    const firstSourceCard = screen.getByText('ASA 150 Technical Bulletin');
    await user.click(firstSourceCard);

    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).toBeInTheDocument();
    });

    // Verify that the original message content is still visible
    expect(
      screen.getByText(
        'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
      )
    ).toBeInTheDocument();

    // Verify that the message container is still present
    const messageContainer = screen.getByTestId('message-container');
    expect(messageContainer).toBeInTheDocument();

    // Test copy functionality still works
    await user.hover(messageContainer);

    // Wait for copy button to appear
    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    // Verify copy button is functional (appears on hover)
    const copyButton = screen.getByRole('button', { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).not.toBeDisabled();
  });

  it('displays source numbers correctly', async () => {
    render(<ChatMessage message={mockMessage} />);

    // Verify sources section appears
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();

    // Check that source numbers are displayed
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('handles clicking on source cards correctly', async () => {
    const user = userEvent.setup();
    render(<ChatMessage message={mockMessage} />);

    // Find source cards
    const firstSourceCard = screen
      .getByText('ASA 150 Technical Bulletin')
      .closest('.cursor-pointer');
    const secondSourceCard = screen
      .getByText('ASA Product Applications')
      .closest('.cursor-pointer');

    expect(firstSourceCard).toBeInTheDocument();
    expect(secondSourceCard).toBeInTheDocument();

    // Verify cards are clickable (have cursor-pointer class)
    expect(firstSourceCard).toHaveClass('cursor-pointer');
    expect(secondSourceCard).toHaveClass('cursor-pointer');

    // Click on first card should expand it
    await user.click(firstSourceCard!);

    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
        )
      ).toBeInTheDocument();
    });

    // Click on second card should expand it independently
    await user.click(secondSourceCard!);

    await waitFor(() => {
      expect(
        screen.getByText('ASA 150 is commonly used in coatings applications')
      ).toBeInTheDocument();
    });

    // Both should be expanded
    expect(
      screen.getByText(
        'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('ASA 150 is commonly used in coatings applications')
    ).toBeInTheDocument();
  });
});
