/**
 * Enhanced Chat Flow Integration Tests with Direct Hook Mocking
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import {
  render,
  createChatScenario,
  createConversationScenario,
  MockApiError,
  waitForLoadingToFinish,
  waitForAsyncOperations,
} from '@/test/enhanced-test-utils';
import {
  setupEnhancedTest,
  cleanupEnhancedTest,
  createChatFlowTestSetup,
  createErrorTestSetup,
} from '@/test/enhanced-setup';

describe('Enhanced Chat Flow Integration', () => {
  let testSetup: ReturnType<typeof setupEnhancedTest>;

  beforeEach(() => {
    testSetup = createChatFlowTestSetup();
  });

  afterEach(() => {
    cleanupEnhancedTest();
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

  it('completes full chat interaction flow with controlled timing', async () => {
    const user = userEvent.setup();
    const scenario = createChatScenario({
      userMessage: 'What is the viscosity of ASA 150?',
      assistantResponse:
        'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
    });

    // Setup mock behavior
    testSetup.simulateSuccess('useChat', 'sendMessage', undefined);
    testSetup.setMessages([]);
    testSetup.setConversations([]);

    render(<ChatInterface />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(testSetup.getMockState().useConversations.isLoading).toBe(false);
    });

    // 1. User types a question
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, scenario.userMessage.content);

    // Verify input value was set
    expect(input).toHaveValue(scenario.userMessage.content);

    // 2. Check if send button is enabled
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();

    // 3. Setup controlled promise for sendMessage
    const { resolve: resolveSendMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    // Click send button
    await user.click(sendButton);

    // 4. Verify loading state is active
    await waitFor(() => {
      expect(testSetup.getMockState().useChat.isLoading).toBe(true);
    });

    // 5. Verify input is disabled during loading
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    // 6. Simulate successful response by updating mock state
    testSetup.setMessages(scenario.messages);
    testSetup.setLoading('useChat', false);

    // Resolve the controlled promise
    resolveSendMessage(undefined);

    // 7. Wait for response to appear
    await waitFor(
      () => {
        expect(
          screen.getByText(scenario.assistantMessage.content)
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 8. Verify user message is displayed
    expect(screen.getByText(scenario.userMessage.content)).toBeInTheDocument();

    // 9. Verify sources are displayed
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('ASA 150 Technical Bulletin')).toBeInTheDocument();

    // 10. Input should be cleared and re-enabled after sending
    expect(input).toHaveValue('');
    expect(input).not.toBeDisabled();
    expect(sendButton).not.toBeDisabled();
  });

  it('handles conversation creation and continuation', async () => {
    const user = userEvent.setup();
    const firstScenario = createChatScenario({
      userMessage: 'What is ASA 150?',
      conversationId: 'conv-123',
    });
    const secondScenario = createChatScenario({
      userMessage: 'What is it used for?',
      assistantResponse:
        'ASA 150 is used in coatings and adhesives applications.',
      conversationId: 'conv-123',
    });

    render(<ChatInterface />);

    // Wait for initial loading
    await waitForLoadingToFinish();

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    // First message
    await user.type(input, firstScenario.userMessage.content);

    // Setup controlled promise for first message
    const { resolve: resolveFirstMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    // Update state and resolve
    testSetup.setMessages(firstScenario.messages);
    testSetup.setLoading('useChat', false);
    resolveFirstMessage(undefined);

    await waitFor(() => {
      expect(
        screen.getByText(firstScenario.assistantMessage.content)
      ).toBeInTheDocument();
    });

    // Second message in same conversation
    await user.type(input, secondScenario.userMessage.content);

    // Setup controlled promise for second message
    const { resolve: resolveSecondMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    // Update state with both messages
    testSetup.setMessages([
      ...firstScenario.messages,
      ...secondScenario.messages,
    ]);
    testSetup.setLoading('useChat', false);
    resolveSecondMessage(undefined);

    await waitFor(() => {
      expect(
        screen.getByText(secondScenario.assistantMessage.content)
      ).toBeInTheDocument();
    });

    // Verify both messages are present
    expect(
      screen.getByText(firstScenario.userMessage.content)
    ).toBeInTheDocument();
    expect(
      screen.getByText(secondScenario.userMessage.content)
    ).toBeInTheDocument();
  });

  it('handles error states and retry functionality', async () => {
    const user = userEvent.setup();
    const errorSetup = createErrorTestSetup();
    const scenario = createChatScenario({
      hasError: true,
      errorType: 'network',
    });

    // Override the test setup with error setup
    testSetup = errorSetup;

    render(<ChatInterface />);

    // Send message that will fail
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Test message');

    // Setup controlled promise that will reject
    const { reject: rejectSendMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    // Simulate error
    testSetup.setError('useChat', scenario.error);
    testSetup.setLoading('useChat', false);
    rejectSendMessage(scenario.error!);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(scenario.error!.message)).toBeInTheDocument();
    });

    // Verify retry button appears
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Setup successful retry
    const { resolve: resolveRetry } = testSetup.createControlledPromise(
      'useChat',
      'retryLastMessage'
    );

    // Click retry
    await user.click(retryButton);

    // Simulate successful retry
    testSetup.setError('useChat', null);
    testSetup.setMessages(scenario.messages);
    testSetup.setLoading('useChat', false);
    resolveRetry(undefined);

    // Wait for successful response
    await waitFor(() => {
      expect(
        screen.getByText(scenario.assistantMessage.content)
      ).toBeInTheDocument();
    });

    // Error should be cleared
    expect(screen.queryByText(scenario.error!.message)).not.toBeInTheDocument();
  });

  it('handles source interaction and expansion', async () => {
    const user = userEvent.setup();
    const scenario = createChatScenario({
      sources: [
        {
          content:
            'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
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
      ],
    });

    // Setup initial state with message and sources
    testSetup.setMessages(scenario.messages);

    render(<ChatInterface />);

    // Wait for sources to be displayed
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
    const scenario = createChatScenario();

    // Setup initial state with messages
    testSetup.setMessages(scenario.messages);

    render(<ChatInterface />);

    await waitFor(() => {
      expect(
        screen.getByText(scenario.assistantMessage.content)
      ).toBeInTheDocument();
    });

    // Hover over assistant message to show copy button
    const assistantMessage = screen.getByText(
      scenario.assistantMessage.content
    );
    await user.hover(assistantMessage);

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);

    // Verify clipboard was called
    expect(testSetup.clipboard.writeText).toHaveBeenCalledWith(
      scenario.assistantMessage.content
    );
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);

    // Type message and press Enter to send
    await user.type(input, 'Test message');

    // Setup controlled promise for sendMessage
    const { resolve: resolveSendMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.keyboard('{Enter}');

    // Verify sendMessage was called
    expect(testSetup.getMockState().useChat.sendMessage).toHaveBeenCalled();

    // Resolve the promise
    resolveSendMessage(undefined);

    // Test Ctrl+K for new conversation
    const { resolve: resolveCreateConversation } =
      testSetup.createControlledPromise(
        'useConversations',
        'createConversation'
      );

    await user.keyboard('{Control>}k{/Control}');

    // Verify createConversation was called
    expect(
      testSetup.getMockState().useConversations.createConversation
    ).toHaveBeenCalled();

    // Resolve the promise
    resolveCreateConversation(createConversationScenario().conversations[0]);
  });

  it('handles conversation management', async () => {
    const user = userEvent.setup();
    const conversationScenario = createConversationScenario({
      conversationCount: 2,
      withMessages: true,
    });

    // Setup initial conversations
    testSetup.setConversations(conversationScenario.conversations);

    render(<ChatInterface />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Conversation 1')).toBeInTheDocument();
      expect(screen.getByText('Conversation 2')).toBeInTheDocument();
    });

    // Click on existing conversation
    const conversationItem = screen.getByText('Conversation 1');

    // Setup controlled promise for loadConversation
    const { resolve: resolveLoadConversation } =
      testSetup.createControlledPromise('useChat', 'loadConversation');

    await user.click(conversationItem);

    // Simulate loading the conversation
    testSetup.setMessages(conversationScenario.conversations[0].messages);
    resolveLoadConversation(undefined);

    // Test new conversation creation
    const newChatButton = screen.getByRole('button', { name: /new/i });

    // Setup controlled promise for createConversation
    const { resolve: resolveCreateConversation } =
      testSetup.createControlledPromise(
        'useConversations',
        'createConversation'
      );

    await user.click(newChatButton);

    // Verify createConversation was called
    expect(
      testSetup.getMockState().useConversations.createConversation
    ).toHaveBeenCalled();

    // Resolve the promise
    resolveCreateConversation(conversationScenario.conversations[0]);
  });

  it('handles concurrent message sending prevention', async () => {
    const user = userEvent.setup();

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message with controlled promise (don't resolve immediately)
    await user.type(input, 'First message');

    const { resolve: resolveFirstMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(sendButton);

    // Verify input and button are disabled during loading
    testSetup.setLoading('useChat', true);

    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    // Try to send another message (should be prevented by disabled state)
    expect(input).toHaveValue(''); // Input should be cleared

    // Resolve the first message
    testSetup.setLoading('useChat', false);
    resolveFirstMessage(undefined);

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('persists conversation state across page reloads', async () => {
    const user = userEvent.setup();
    const scenario = createChatScenario();

    // Setup localStorage with existing messages
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

    // Setup test with initial localStorage data
    const persistenceSetup = setupEnhancedTest({
      initialLocalStorage: {
        'chat-messages': JSON.stringify(existingMessages),
        'current-conversation-id': 'conv-123',
      },
    });

    // Override testSetup
    testSetup = persistenceSetup;

    render(<ChatInterface />);

    // Verify messages are loaded from localStorage
    await waitFor(() => {
      expect(screen.getByText('Previous question')).toBeInTheDocument();
      expect(screen.getByText('Previous answer')).toBeInTheDocument();
    });

    // Send new message to continue conversation
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'New question');

    const { resolve: resolveSendMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    // Verify conversation ID is maintained in the mock
    expect(testSetup.getMockState().useChat.conversationId).toBe('conv-123');

    // Resolve the promise
    resolveSendMessage(undefined);
  });

  it('handles markdown rendering and content display', async () => {
    const user = userEvent.setup();
    const scenario = createChatScenario({
      assistantResponse:
        'ASA 150 has a **viscosity** of *150 cP* and is used in:\n\n1. Coatings\n2. Adhesives\n\n`ASTM D445` test method.',
    });

    // Setup initial state with markdown message
    testSetup.setMessages(scenario.messages);

    render(<ChatInterface />);

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

  it('handles loading states without blocking interface indefinitely', async () => {
    const user = userEvent.setup();

    render(<ChatInterface />);

    // Verify initial loading doesn't block interface
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });

    // Send message and verify loading state resolves
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    await user.type(input, 'Test message');

    const { resolve: resolveSendMessage } = testSetup.createControlledPromise(
      'useChat',
      'sendMessage'
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    // Verify loading state is active
    testSetup.setLoading('useChat', true);

    await waitFor(() => {
      expect(input).toBeDisabled();
    });

    // Resolve loading state
    testSetup.setLoading('useChat', false);
    resolveSendMessage(undefined);

    // Verify interface is unblocked
    await waitFor(
      () => {
        expect(input).not.toBeDisabled();
      },
      { timeout: 1000 }
    );
  });
});
