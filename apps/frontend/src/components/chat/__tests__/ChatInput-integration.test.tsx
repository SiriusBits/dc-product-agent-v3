/**
 * ChatInput Integration Tests
 *
 * Tests ChatInput component integration with mocked hooks,
 * verifies disabled state handling, form submission, and loading states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  typeIntoInput,
  submitForm,
  waitForDebounce,
} from '../../../test/input-utilities';
import ChatInterface from '../ChatInterface';

// Mock the hooks
vi.mock('../../../hooks/useChat');
vi.mock('../../../hooks/useConversations');
vi.mock('../../../hooks/useProducts');

// Import the mocked hooks
import { useChat } from '../../../hooks/useChat';
import { useConversations } from '../../../hooks/useConversations';
import { useProducts } from '../../../hooks/useProducts';

const mockUseChat = vi.mocked(useChat);
const mockUseConversations = vi.mocked(useConversations);
const mockUseProducts = vi.mocked(useProducts);

// Helper functions to get elements
const getTextInput = () =>
  screen.getByPlaceholderText(/Ask about chemical products/);
const getSendButton = () => screen.getByRole('button', { name: /send/i });

describe('ChatInput Integration Tests', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockClearMessages: ReturnType<typeof vi.fn>;
  let mockLoadConversation: ReturnType<typeof vi.fn>;
  let mockRetryLastMessage: ReturnType<typeof vi.fn>;
  let mockCreateConversation: ReturnType<typeof vi.fn>;
  let mockDeleteConversation: ReturnType<typeof vi.fn>;
  let mockUpdateConversationTitle: ReturnType<typeof vi.fn>;
  let mockSearchProducts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create fresh mock functions
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockClearMessages = vi.fn();
    mockLoadConversation = vi.fn().mockResolvedValue(undefined);
    mockRetryLastMessage = vi.fn().mockResolvedValue(undefined);
    mockCreateConversation = vi
      .fn()
      .mockResolvedValue({ id: 'new-conv', title: 'New Chat' });
    mockDeleteConversation = vi.fn().mockResolvedValue(undefined);
    mockUpdateConversationTitle = vi.fn().mockResolvedValue(undefined);
    mockSearchProducts = vi.fn().mockResolvedValue(undefined);

    // Set up default mock implementations
    mockUseChat.mockReturnValue({
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

    mockUseConversations.mockReturnValue({
      conversations: [],
      isLoading: false,
      error: null,
      createConversation: mockCreateConversation,
      deleteConversation: mockDeleteConversation,
      updateConversationTitle: mockUpdateConversationTitle,
    });

    mockUseProducts.mockReturnValue({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: null,
      searchProducts: mockSearchProducts,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form submission behavior', () => {
    it('should call sendMessage when user submits form via button click', async () => {
      // Arrange
      render(<ChatInterface />);

      // Act: Type message and submit via button
      const input = getTextInput();
      await typeIntoInput(input, 'Test message via button');
      await submitForm(input, { viaButton: true });

      // Assert
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test message via button');
      });
    });

    it('should call sendMessage when user submits form via Enter key', async () => {
      // Arrange
      render(<ChatInterface />);

      // Act: Type message and submit via Enter key
      const input = getTextInput();
      await typeIntoInput(input, 'Test message via Enter');
      await submitForm(input, { viaEnterKey: true });

      // Assert
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test message via Enter');
      });
    });

    it('should prevent form submission when disabled', async () => {
      // Arrange: Set loading state to disable input
      mockUseChat.mockReturnValue({
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

      // Act: Try to type and submit (should be prevented)
      const input = getTextInput();
      expect(input).toBeDisabled();

      // Try to submit anyway (should not work)
      try {
        await typeIntoInput(input, 'This should not work');
        await submitForm(input, { viaButton: true });
      } catch (error) {
        // Expected to fail because input is disabled
      }

      // Assert: sendMessage should not be called
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state handling', () => {
    it('should disable input and button when isLoading is true', async () => {
      // Arrange: Set loading state
      mockUseChat.mockReturnValue({
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

      // Assert: Both input and button should be disabled
      const input = getTextInput();
      const sendButton = getSendButton();

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('should disable input and button when error exists', async () => {
      // Arrange: Set error state
      mockUseChat.mockReturnValue({
        messages: [],
        isLoading: false,
        error: {
          message: 'Network error',
          status: 500,
          name: 'ApiError',
          isNetworkError: () => true,
          isRetryable: () => true,
        },
        conversationId: null,
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        loadConversation: mockLoadConversation,
        retryLastMessage: mockRetryLastMessage,
        isRetryable: true,
      });

      render(<ChatInterface />);

      // Assert: Both input and button should be disabled
      const input = getTextInput();
      const sendButton = getSendButton();

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('should enable input and button when not loading and no error', async () => {
      // Arrange: Set normal state (default state is already normal)
      render(<ChatInterface />);

      // Assert: Both input and button should be enabled (button disabled only if no text)
      const input = getTextInput();
      const sendButton = getSendButton();

      expect(input).not.toBeDisabled();
      // Button is disabled when no message text, but not due to loading/error
      expect(sendButton).toBeDisabled(); // No text entered yet
    });

    it('should enable send button when text is entered and not disabled', async () => {
      // Arrange: Set normal state
      render(<ChatInterface />);

      // Act: Type some text
      const input = getTextInput();
      await typeIntoInput(input, 'Some message text');

      // Assert: Send button should now be enabled
      const sendButton = getSendButton();
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Loading state display', () => {
    it('should show loading spinner when isLoading is true', async () => {
      // Arrange: Set loading state
      mockUseChat.mockReturnValue({
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

      // Assert: Loading spinner should be visible
      const sendButton = getSendButton();
      const spinner = sendButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show send icon when not loading', async () => {
      // Arrange: Set normal state (default)
      render(<ChatInterface />);

      // Assert: Send icon should be visible (not spinner)
      const sendButton = getSendButton();
      const sendIcon = sendButton.querySelector('svg:not(.animate-spin)');
      expect(sendIcon).toBeInTheDocument();
    });
  });
});
