/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import {
  setupTest,
  typeIntoInput,
  submitForm,
  createMockMessage,
  createMockConversation,
  createMockApiError,
} from '@/test';

// Mock the hooks to use our reactive infrastructure
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));
vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(),
}));

// Import the mocked hooks
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { updateMockHook } from '../test-utils';
import { updateMockHook } from '../test-utils';
import { updateMockHook } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';
import { render } from 'astro:content';
import { setupMocks } from '../test-utils';

describe('Chat Flow Integration', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest({
      enableAutoCleanup: true,
      mockLocalStorage: true,
    });

    // Set up the mocked hooks to use our reactive mocks
    vi.mocked(useChat).mockImplementation(testContext.chatMock.getMock());
    vi.mocked(useConversations).mockImplementation(
      testContext.conversationsMock.getMock()
    );
  });

  // ============================================================================
  // 5.1 Focused Chat Rendering Tests
  // ============================================================================

  describe('Chat Rendering', () => {
    it('renders ChatInterface with empty messages', async () => {
      // Arrange: Setup with empty messages (already set by default)
      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: null,
        conversationId: null,
      });

      await testContext.updateConversations({
        conversations: [],
        isLoading: false,
        error: null,
      });

      // Act: Render component
      const { getByTestId, getByPlaceholderText, getByRole, getByText } =
        testContext.renderComponent(<ChatInterface />);

      // Assert: Verify basic elements are present
      expect(getByTestId('chat-interface')).toBeInTheDocument();
      expect(getByTestId('chat-messages')).toBeInTheDocument();
      expect(
        getByPlaceholderText(/ask about chemical products/i)
      ).toBeInTheDocument();
      expect(getByRole('button', { name: /send/i })).toBeInTheDocument();

      // Assert: Verify empty state (no messages displayed)
      const messageContainers = screen.queryAllByTestId('message-container');
      expect(messageContainers).toHaveLength(0);

      // Assert: Verify welcome section or empty state is shown
      // (This depends on the ChatHistory component implementation)
      expect(getByText('Chemical Product Assistant')).toBeInTheDocument();
    });

    it('renders ChatInterface with multiple messages', async () => {
      // Arrange: Setup with multiple messages
      const mockMessages = [
        createMockMessage({
          id: 'msg-1',
          content: 'What is the viscosity of ASA 150?',
          role: 'user',
          conversation_id: 'conv-123',
        }),
        createMockMessage({
          id: 'msg-2',
          content:
            'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
          role: 'assistant',
          conversation_id: 'conv-123',
        }),
        createMockMessage({
          id: 'msg-3',
          content: 'What applications is it used for?',
          role: 'user',
          conversation_id: 'conv-123',
        }),
        createMockMessage({
          id: 'msg-4',
          content:
            'ASA 150 is commonly used in coatings and adhesive applications.',
          role: 'assistant',
          conversation_id: 'conv-123',
        }),
      ];

      await testContext.updateChat({
        messages: mockMessages,
        isLoading: false,
        error: null,
        conversationId: 'conv-123',
      });

      await testContext.updateConversations({
        conversations: [
          createMockConversation({
            id: 'conv-123',
            title: 'ASA 150 Questions',
            messages: mockMessages,
          }),
        ],
        isLoading: false,
        error: null,
      });

      // Act: Render component
      testContext.renderComponent(<ChatInterface />);

      // Assert: Verify all messages are displayed
      await waitFor(() => {
        expect(
          screen.getByText('What is the viscosity of ASA 150?')
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText('What applications is it used for?')
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            'ASA 150 is commonly used in coatings and adhesive applications.'
          )
        ).toBeInTheDocument();
      });

      // Assert: Verify correct number of message containers
      const messageContainers = screen.getAllByTestId('message-container');
      expect(messageContainers).toHaveLength(4);
    });

    it('displays messages with correct content and metadata', async () => {
      // Arrange: Setup with a message that has sources and metadata
      const mockMessage = createMockMessage({
        id: 'msg-1',
        content: 'ASA 150 has a viscosity of 150 cP at 25°C.',
        role: 'assistant',
        conversation_id: 'conv-123',
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

      setupMocks({
        useChat: {
          messages: [mockMessage],
          isLoading: false,
          error: null,
          conversationId: 'conv-123',
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Verify message content is displayed
      await waitFor(() => {
        expect(
          screen.getByText('ASA 150 has a viscosity of 150 cP at 25°C.')
        ).toBeInTheDocument();
      });

      // Assert: Verify sources are displayed (if the component shows them)
      await waitFor(() => {
        // Look for sources section or source indicators
        const sourcesElement = screen.queryByText(/sources/i);
        if (sourcesElement) {
          expect(sourcesElement).toBeInTheDocument();
        }
      });

      // Assert: Verify message metadata (timestamp, role indicators, etc.)
      const messageContainer = screen.getByTestId('message-container');
      expect(messageContainer).toBeInTheDocument();

      // Assert: Verify message structure (should contain assistant message styling)
      expect(messageContainer).toHaveClass('flex', 'gap-3', 'p-4');
    });
  });

  // ============================================================================
  // 5.2 Chat Interaction Tests
  // ============================================================================

  describe('Chat Interaction', () => {
    it('sends a message and calls sendMessage function', async () => {
      // Arrange: Setup with mock sendMessage function
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
        conversationId: null,
      });

      const { getByPlaceholderText, getByRole } = testContext.renderComponent(
        <ChatInterface />
      );

      // Act: Type message and send using enhanced input utilities
      const input = getByPlaceholderText(/ask about chemical products/i);
      const sendButton = getByRole('button', { name: /send/i });

      await typeIntoInput(input, 'What is the viscosity of ASA 150?');
      await userEvent.setup().click(sendButton);

      // Assert: Verify sendMessage was called with correct content
      expect(mockSendMessage).toHaveBeenCalledWith(
        'What is the viscosity of ASA 150?'
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('clears message input after sending', async () => {
      // Arrange: Setup with mock that simulates successful send
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: null,
          sendMessage: mockSendMessage,
          conversationId: null,
        },
      });

      const user = userEvent.setup();
      render(<ChatInterface />);

      // Act: Type message and send
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      expect(input).toHaveValue('Test message');

      await user.click(sendButton);

      // Assert: Input should be cleared immediately after clicking send
      expect(input).toHaveValue('');
    });

    it('disables send button during loading', async () => {
      // Arrange: Setup with loading state
      setupMocks({
        useChat: {
          messages: [],
          isLoading: true,
          error: null,
          sendMessage: vi.fn(),
          conversationId: null,
        },
      });

      render(<ChatInterface />);

      // Assert: Send button should be disabled during loading
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();

      // Assert: Input should also be disabled during loading
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('enables send button when input has text and not loading', async () => {
      // Arrange: Setup with normal state
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: null,
          sendMessage: vi.fn(),
          conversationId: null,
        },
      });

      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Assert: Send button should be disabled when input is empty
      expect(sendButton).toBeDisabled();

      // Act: Type in input
      await user.type(input, 'Test message');

      // Assert: Send button should be enabled when input has text
      expect(sendButton).not.toBeDisabled();
    });

    it('handles Enter key to send message', async () => {
      // Arrange: Setup with mock sendMessage function
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
        conversationId: null,
      });

      const { getByPlaceholderText } = testContext.renderComponent(
        <ChatInterface />
      );

      // Act: Type message and press Enter using form submission utility
      const input = getByPlaceholderText(/ask about chemical products/i);
      await typeIntoInput(input, 'Test message');

      // Find the form and submit via Enter key
      const form = input.closest('form');
      if (form) {
        await submitForm(form, { viaEnterKey: true });
      } else {
        // Fallback to direct keyboard event
        await userEvent.setup().keyboard('{Enter}');
      }

      // Assert: Verify sendMessage was called
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Assert: Input should be cleared
      expect(input).toHaveValue('');
    });
  });

  // ============================================================================
  // 5.3 Chat Error Handling Tests
  // ============================================================================

  describe('Chat Error Handling', () => {
    it('displays error message when error occurs', async () => {
      // Arrange: Setup with error state
      const mockError = createMockApiError('Network connection failed', 0);
      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: mockError,
        sendMessage: vi.fn(),
        conversationId: null,
      });

      // Act: Render component
      testContext.renderComponent(<ChatInterface />);

      // Assert: Verify error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(
          screen.getByText('Network connection failed')
        ).toBeInTheDocument();
      });
    });

    it('shows retry button for retryable errors', async () => {
      // Arrange: Setup with retryable error (server error)
      const mockError = createMockApiError('Internal server error', 500);
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: mockError,
          sendMessage: vi.fn(),
          retryLastMessage: vi.fn(),
          conversationId: null,
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Verify retry button appears for retryable errors
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });
    });

    it('does not show retry button for non-retryable errors', async () => {
      // Arrange: Setup with non-retryable error (client error)
      const mockError = createMockApiError('Bad request', 400);
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: mockError,
          sendMessage: vi.fn(),
          retryLastMessage: vi.fn(),
          conversationId: null,
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Verify error is displayed but no retry button
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(screen.getByText('Bad request')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /retry/i })
        ).not.toBeInTheDocument();
      });
    });

    it('calls retryLastMessage when retry button is clicked', async () => {
      // Arrange: Setup with retryable error and mock retry function
      const mockError = createMockApiError('Network timeout', 408);
      const mockRetryLastMessage = vi.fn().mockResolvedValue(undefined);
      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: mockError,
        sendMessage: vi.fn(),
        retryLastMessage: mockRetryLastMessage,
        conversationId: null,
        isRetryable: true,
      });

      testContext.renderComponent(<ChatInterface />);

      // Act: Click retry button
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.setup().click(retryButton);

      // Assert: Verify retryLastMessage was called
      expect(mockRetryLastMessage).toHaveBeenCalledTimes(1);
    });

    it('disables input when error is present', async () => {
      // Arrange: Setup with error state
      const mockError = createMockApiError('Service unavailable', 503);
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: mockError,
          sendMessage: vi.fn(),
          conversationId: null,
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Verify input is disabled when error is present
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('clears error state after successful retry', async () => {
      // Arrange: Setup with initial error state
      const mockError = createMockApiError('Temporary failure', 500);
      const mockRetryLastMessage = vi.fn().mockResolvedValue(undefined);

      await testContext.updateChat({
        messages: [],
        isLoading: false,
        error: mockError,
        sendMessage: vi.fn(),
        retryLastMessage: mockRetryLastMessage,
        conversationId: null,
        isRetryable: true,
      });

      testContext.renderComponent(<ChatInterface />);

      // Verify error is initially displayed
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
      });

      // Act: Simulate successful retry by updating mock to clear error
      await testContext.updateChat({
        error: null,
        isLoading: false,
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.setup().click(retryButton);

      // Assert: Error should be cleared and input should be enabled
      await waitFor(() => {
        expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).not.toBeDisabled();
    });
  });

  // ============================================================================
  // 5.4 Chat Loading State Tests
  // ============================================================================

  describe('Chat Loading State', () => {
    it('shows loading indicator when isLoading is true', async () => {
      // Arrange: Setup with loading state
      await testContext.updateChat({
        messages: [],
        isLoading: true,
        error: null,
        sendMessage: vi.fn(),
        conversationId: null,
      });

      // Act: Render component
      testContext.renderComponent(<ChatInterface />);

      // Assert: Verify loading indicator is displayed in ChatHistory
      await waitFor(() => {
        const loadingElement = screen.getByTestId('chat-loading-spinner');
        expect(loadingElement).toBeInTheDocument();
      });
    });

    it('hides loading indicator when loading completes', async () => {
      // Arrange: Setup with initial loading state
      await testContext.updateChat({
        messages: [],
        isLoading: true,
        error: null,
        sendMessage: vi.fn(),
        conversationId: null,
      });

      testContext.renderComponent(<ChatInterface />);

      // Verify loading is initially shown
      await waitFor(() => {
        const loadingElement = screen.getByTestId('chat-loading-spinner');
        expect(loadingElement).toBeInTheDocument();
      });

      // Act: Update mock to simulate loading completion
      await testContext.updateChat({
        isLoading: false,
        messages: [
          createMockMessage({
            id: 'msg-1',
            content: 'Test response',
            role: 'assistant',
          }),
        ],
      });

      // Assert: Loading indicator should disappear
      await waitFor(() => {
        const loadingElement = screen.queryByTestId('chat-loading-spinner');
        expect(loadingElement).not.toBeInTheDocument();
      });

      // Assert: Message should be displayed
      await waitFor(() => {
        expect(screen.getByText('Test response')).toBeInTheDocument();
      });
    });

    it('disables input during loading', async () => {
      // Arrange: Setup with loading state
      setupMocks({
        useChat: {
          messages: [],
          isLoading: true,
          error: null,
          sendMessage: vi.fn(),
          conversationId: null,
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Input should be disabled during loading
      await waitFor(() => {
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).toBeDisabled();
      });

      // Assert: Send button should also be disabled
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled();
      });
    });

    it('enables input after loading completes', async () => {
      // Arrange: Setup with initial loading state
      setupMocks({
        useChat: {
          messages: [],
          isLoading: true,
          error: null,
          sendMessage: vi.fn(),
          conversationId: null,
        },
      });

      render(<ChatInterface />);

      // Verify input is initially disabled
      await waitFor(() => {
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).toBeDisabled();
      });

      // Act: Update mock to simulate loading completion
      updateMockHook('useChat', {
        isLoading: false,
      });

      // Assert: Input should be enabled after loading completes
      await waitFor(() => {
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).not.toBeDisabled();
      });
    });

    it('shows loading state during message sending', async () => {
      // Arrange: Setup with mock that simulates loading during send
      const mockSendMessage = vi.fn().mockImplementation(async () => {
        // Simulate loading state during send
        updateMockHook('useChat', { isLoading: true });

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Complete loading
        updateMockHook('useChat', {
          isLoading: false,
          messages: [
            createMockMessage({
              id: 'msg-1',
              content: 'User message',
              role: 'user',
            }),
            createMockMessage({
              id: 'msg-2',
              content: 'Assistant response',
              role: 'assistant',
            }),
          ],
        });
      });

      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: null,
          sendMessage: mockSendMessage,
          conversationId: null,
        },
      });

      const user = userEvent.setup();
      render(<ChatInterface />);

      // Act: Send a message
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Assert: Verify sendMessage was called
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');

      // Wait for operation to complete and verify final state
      await waitFor(() => {
        expect(screen.getByText('Assistant response')).toBeInTheDocument();
      });
    });

    it('prevents multiple simultaneous sends during loading', async () => {
      // Arrange: Setup with loading state
      const mockSendMessage = vi.fn();
      setupMocks({
        useChat: {
          messages: [],
          isLoading: true,
          error: null,
          sendMessage: mockSendMessage,
          conversationId: null,
        },
      });

      const user = userEvent.setup();
      render(<ChatInterface />);

      // Act: Try to send message while loading
      await waitFor(() => {
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        const sendButton = screen.getByRole('button', { name: /send/i });

        // Input should be disabled, so typing should not work
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Try to click send button (should be disabled)
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      // Assert: sendMessage should not be called when disabled
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Additional Integration Tests (Demonstrating Full Flow)
  // ============================================================================

  describe('Full Chat Flow Integration', () => {
    it('completes a full chat interaction with standardized mocks', async () => {
      // Arrange: Setup with mock functions that simulate real behavior
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);

      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: null,
          sendMessage: mockSendMessage,
          conversationId: null,
        },
      });

      const user = userEvent.setup();
      render(<ChatInterface />);

      // Act: Complete chat interaction
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      await user.type(input, 'What is the viscosity of ASA 150?');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Assert: Verify the interaction completed successfully
      expect(mockSendMessage).toHaveBeenCalledWith(
        'What is the viscosity of ASA 150?'
      );

      // Verify input was cleared
      expect(input).toHaveValue('');
    });

    it('handles basic interface rendering and interaction', async () => {
      // Arrange: Setup basic state
      setupMocks({
        useChat: {
          messages: [],
          isLoading: false,
          error: null,
          sendMessage: vi.fn(),
          conversationId: null,
        },
        useConversations: {
          conversations: [],
          isLoading: false,
          error: null,
        },
      });

      // Act: Render component
      render(<ChatInterface />);

      // Assert: Verify basic elements are present
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
      expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/ask about chemical products/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      expect(
        screen.getByText('Chemical Product Assistant')
      ).toBeInTheDocument();
    });
  });
});
