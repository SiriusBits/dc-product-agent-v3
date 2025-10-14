/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/enhanced-test-utils';
import {
  setupFixedLoadingMocks,
  cleanupFixedLoadingMocks,
  createMockChatMessage,
  createMockConversation,
} from '@/test/fixed-loading-mocks';

describe('Conversation Management Features', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;
  let messageIdCounter = 0;

  // Helper to create unique message IDs
  const createUniqueMessageId = () => {
    messageIdCounter++;
    return `msg-${Date.now()}-${messageIdCounter}`;
  };

  beforeEach(() => {
    messageIdCounter = 0;
    testHelpers = setupFixedLoadingMocks();

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
  });

  afterEach(() => {
    cleanupFixedLoadingMocks();
  });

  it('creates new conversation when clicking New button', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Initially should show "No conversations yet"
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();

    // Click the New button in the sidebar
    const newButton = screen.getByRole('button', { name: /new/i });
    await user.click(newButton);

    // Wait for the async operation to complete
    await testHelpers.waitForLoadingToComplete();

    // Wait for React to re-render with the new state
    await waitFor(
      () => {
        // Check if the createConversation function was called
        expect(
          testHelpers.conversationsMock.createConversation
        ).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // The conversation should appear in the sidebar
    await waitFor(
      () => {
        expect(screen.getByText('New Conversation')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // The "No conversations yet" message should be gone
    expect(screen.queryByText(/No conversations yet/)).not.toBeInTheDocument();
  });

  it('switches between conversations correctly', async () => {
    const user = userEvent.setup();

    // Set up with multiple existing conversations
    const existingConversations = [
      createMockConversation({
        id: 'conv-1',
        title: 'ASA 150 Questions',
        messages: [
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'What is ASA 150?',
            role: 'user',
            conversation_id: 'conv-1',
          }),
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'ASA 150 is a chemical product...',
            role: 'assistant',
            conversation_id: 'conv-1',
          }),
        ],
      }),
      createMockConversation({
        id: 'conv-2',
        title: 'Product Comparisons',
        messages: [
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'Compare ASA 150 and ASA 175',
            role: 'user',
            conversation_id: 'conv-2',
          }),
        ],
      }),
    ];

    testHelpers = setupFixedLoadingMocks({
      initialConversations: existingConversations,
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Wait for conversations to load in sidebar
    await waitFor(() => {
      expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
      expect(screen.getByText('Product Comparisons')).toBeInTheDocument();
    });

    // Click on first conversation
    const firstConversation = screen.getByText('ASA 150 Questions');
    await user.click(firstConversation);

    await testHelpers.waitForLoadingToComplete();

    // Should load the conversation messages
    await waitFor(() => {
      expect(screen.getByText('What is ASA 150?')).toBeInTheDocument();
      expect(
        screen.getByText('ASA 150 is a chemical product...')
      ).toBeInTheDocument();
    });

    // Click on second conversation
    const secondConversation = screen.getByText('Product Comparisons');
    await user.click(secondConversation);

    await testHelpers.waitForLoadingToComplete();

    // Should switch to second conversation messages
    await waitFor(() => {
      expect(
        screen.getByText('Compare ASA 150 and ASA 175')
      ).toBeInTheDocument();
    });

    // First conversation messages should no longer be visible
    expect(screen.queryByText('What is ASA 150?')).not.toBeInTheDocument();
    expect(
      screen.queryByText('ASA 150 is a chemical product...')
    ).not.toBeInTheDocument();
  });

  it('deletes conversations correctly', async () => {
    const user = userEvent.setup();

    // Set up with existing conversations
    const existingConversations = [
      createMockConversation({
        id: 'conv-1',
        title: 'ASA 150 Questions',
        messages: [
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'What is ASA 150?',
            role: 'user',
            conversation_id: 'conv-1',
          }),
        ],
      }),
      createMockConversation({
        id: 'conv-2',
        title: 'Product Comparisons',
        messages: [],
      }),
    ];

    testHelpers = setupFixedLoadingMocks({
      initialConversations: existingConversations,
      initialConversationId: 'conv-1',
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('ASA 150 Questions')).toBeInTheDocument();
      expect(screen.getByText('Product Comparisons')).toBeInTheDocument();
    });

    // Find and click the delete button for the first conversation
    const conversationCards = screen.getAllByRole('button', {
      name: /delete/i,
    });
    expect(conversationCards.length).toBeGreaterThan(0);

    // Click delete on first conversation
    await user.click(conversationCards[0]);

    await testHelpers.waitForLoadingToComplete();

    // First conversation should be removed
    await waitFor(() => {
      expect(screen.queryByText('ASA 150 Questions')).not.toBeInTheDocument();
    });

    // Second conversation should still be there
    expect(screen.getByText('Product Comparisons')).toBeInTheDocument();

    // If we deleted the current conversation, messages should be cleared
    expect(screen.queryByText('What is ASA 150?')).not.toBeInTheDocument();
  });

  it('updates conversation titles correctly', async () => {
    const user = userEvent.setup();

    // Set up with existing conversation
    const existingConversations = [
      createMockConversation({
        id: 'conv-1',
        title: 'Untitled Conversation',
        messages: [],
      }),
    ];

    testHelpers = setupFixedLoadingMocks({
      initialConversations: existingConversations,
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Wait for conversation to load
    await waitFor(() => {
      expect(screen.getByText('Untitled Conversation')).toBeInTheDocument();
    });

    // Find and click the edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    // Should show input field for editing
    const titleInput = screen.getByDisplayValue('Untitled Conversation');
    expect(titleInput).toBeInTheDocument();

    // Clear and type new title
    await user.clear(titleInput);
    await user.type(titleInput, 'ASA Product Questions');

    // Press Enter to save
    await user.keyboard('{Enter}');

    await testHelpers.waitForLoadingToComplete();

    // Should show updated title
    await waitFor(() => {
      expect(screen.getByText('ASA Product Questions')).toBeInTheDocument();
    });

    // Old title should be gone
    expect(screen.queryByText('Untitled Conversation')).not.toBeInTheDocument();
  });

  it('persists conversation state across page reloads', async () => {
    const user = userEvent.setup();

    // Set up initial messages in a conversation (simulating page reload)
    const existingMessages = [
      createMockChatMessage({
        id: createUniqueMessageId(),
        content: 'Previous question',
        role: 'user',
        conversation_id: 'conv-123',
      }),
      createMockChatMessage({
        id: createUniqueMessageId(),
        content: 'Previous answer',
        role: 'assistant',
        conversation_id: 'conv-123',
      }),
    ];

    const existingConversations = [
      createMockConversation({
        id: 'conv-123',
        title: 'Persisted Conversation',
        messages: existingMessages,
      }),
    ];

    // Setup with existing messages and conversation ID (simulating persistence)
    testHelpers = setupFixedLoadingMocks({
      initialMessages: existingMessages,
      initialConversationId: 'conv-123',
      initialConversations: existingConversations,
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Verify conversation appears in sidebar
    await waitFor(() => {
      expect(screen.getByText('Persisted Conversation')).toBeInTheDocument();
    });

    // Verify messages are displayed (simulating persistence)
    await waitFor(() => {
      expect(screen.getByText('Previous question')).toBeInTheDocument();
      expect(screen.getByText('Previous answer')).toBeInTheDocument();
    });

    // Send new message to continue conversation
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'New question');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await testHelpers.waitForLoadingToComplete();

    // Verify new message appears
    await waitFor(() => {
      expect(screen.getByText('New question')).toBeInTheDocument();
      expect(screen.getByText('Response to: New question')).toBeInTheDocument();
    });

    // All messages should be visible (conversation continuity)
    expect(screen.getByText('Previous question')).toBeInTheDocument();
    expect(screen.getByText('Previous answer')).toBeInTheDocument();

    // Should have 4 messages total (2 existing + 2 new)
    const messageContainers = screen.getAllByTestId('message-container');
    expect(messageContainers).toHaveLength(4);
  });

  it('maintains conversation state when creating new conversation', async () => {
    const user = userEvent.setup();

    // Start with existing conversation
    const existingConversations = [
      createMockConversation({
        id: 'conv-1',
        title: 'Existing Conversation',
        messages: [
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'Existing message',
            role: 'user',
            conversation_id: 'conv-1',
          }),
        ],
      }),
    ];

    testHelpers = setupFixedLoadingMocks({
      initialConversations: existingConversations,
      initialConversationId: 'conv-1',
      initialMessages: existingConversations[0].messages,
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Verify existing conversation is loaded
    await waitFor(() => {
      expect(screen.getByText('Existing Conversation')).toBeInTheDocument();
      expect(screen.getByText('Existing message')).toBeInTheDocument();
    });

    // Create new conversation
    const newButton = screen.getByRole('button', { name: /new/i });
    await user.click(newButton);

    await testHelpers.waitForLoadingToComplete();

    // Should clear current messages and show new conversation
    await waitFor(() => {
      expect(screen.getByText('New Conversation')).toBeInTheDocument();
    });

    // Previous messages should be cleared
    expect(screen.queryByText('Existing message')).not.toBeInTheDocument();

    // Both conversations should be in sidebar
    expect(screen.getByText('Existing Conversation')).toBeInTheDocument();
    expect(screen.getByText('New Conversation')).toBeInTheDocument();

    // Switch back to existing conversation
    const existingConv = screen.getByText('Existing Conversation');
    await user.click(existingConv);

    await testHelpers.waitForLoadingToComplete();

    // Should restore the existing conversation messages
    await waitFor(() => {
      expect(screen.getByText('Existing message')).toBeInTheDocument();
    });
  });

  it('handles keyboard shortcut for new conversation (Ctrl+K)', async () => {
    const user = userEvent.setup();

    // Start with existing conversation
    const existingConversations = [
      createMockConversation({
        id: 'conv-1',
        title: 'Current Conversation',
        messages: [
          createMockChatMessage({
            id: createUniqueMessageId(),
            content: 'Current message',
            role: 'user',
            conversation_id: 'conv-1',
          }),
        ],
      }),
    ];

    testHelpers = setupFixedLoadingMocks({
      initialConversations: existingConversations,
      initialConversationId: 'conv-1',
      initialMessages: existingConversations[0].messages,
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Verify existing conversation is loaded
    await waitFor(() => {
      expect(screen.getByText('Current Conversation')).toBeInTheDocument();
      expect(screen.getByText('Current message')).toBeInTheDocument();
    });

    // Use Ctrl+K shortcut
    await user.keyboard('{Control>}k{/Control}');

    await testHelpers.waitForLoadingToComplete();

    // Should create new conversation and clear messages
    await waitFor(() => {
      expect(screen.getByText('New Conversation')).toBeInTheDocument();
    });

    // Previous messages should be cleared
    expect(screen.queryByText('Current message')).not.toBeInTheDocument();

    // Both conversations should be in sidebar
    expect(screen.getByText('Current Conversation')).toBeInTheDocument();
    expect(screen.getByText('New Conversation')).toBeInTheDocument();
  });

  it('shows conversation metadata correctly', async () => {
    const user = userEvent.setup();

    // Create conversation with metadata
    const conversationWithMetadata = createMockConversation({
      id: 'conv-1',
      title: 'Conversation with Metadata',
      messages: [
        createMockChatMessage({
          id: createUniqueMessageId(),
          content: 'Message 1',
          role: 'user',
          conversation_id: 'conv-1',
        }),
        createMockChatMessage({
          id: createUniqueMessageId(),
          content: 'Message 2',
          role: 'assistant',
          conversation_id: 'conv-1',
        }),
      ],
      metadata: {
        message_count: 2,
      },
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    });

    testHelpers = setupFixedLoadingMocks({
      initialConversations: [conversationWithMetadata],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Wait for conversation to load
    await waitFor(() => {
      expect(
        screen.getByText('Conversation with Metadata')
      ).toBeInTheDocument();
    });

    // Should show metadata
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
  });
});
