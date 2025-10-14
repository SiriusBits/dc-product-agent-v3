/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import type { ChatResponse, QueryType } from '@/types';
import { render } from '@testing-library/react';
import {
  setupEnhancedTest,
  cleanupEnhancedTest,
  mockApiClient,
} from '@/test/enhanced-test-setup';
import { MockApiError } from '@/test/test-utils';

describe('Enhanced Input Handling Tests', () => {
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
    const testSetup = setupEnhancedTest({
      mockResponses: {
        chatResponse: mockChatResponse,
        conversations: [],
        newConversation: {
          id: 'new-conv',
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          title: 'New Conversation',
          metadata: {},
        },
      },
    });

    // Store the setup for use in tests
    (global as any).testSetup = testSetup;
  });

  afterEach(() => {
    cleanupEnhancedTest();
  });

  describe('Input Value Setting and Retrieval', () => {
    it('should properly set and retrieve input values using user-event', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/ask about chemical products/i)
        ).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Test typing with user-event
      await user.type(input, 'What is the viscosity of ASA 150?');

      // Verify input value is set correctly
      expect(input).toHaveValue('What is the viscosity of ASA 150?');

      // Test clearing input
      await user.clear(input);
      expect(input).toHaveValue('');

      // Test typing again
      await user.type(input, 'Another test message');
      expect(input).toHaveValue('Another test message');
    });

    it('should handle special characters and unicode in input', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Test special characters (escape problematic ones)
      const specialText = 'Test with special chars: @#$%^&*()_+-=';
      await user.type(input, specialText);
      expect(input).toHaveValue(specialText);

      await user.clear(input);

      // Test unicode characters
      const unicodeText = 'Test with unicode: αβγδε 中文 🧪⚗️';
      await user.type(input, unicodeText);
      expect(input).toHaveValue(unicodeText);
    });

    it('should respect maxLength constraint', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Create a string longer than 1000 characters
      const longText = 'a'.repeat(1100);
      await user.type(input, longText);

      // Should be truncated to 1000 characters
      expect(input.value.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should send message on Enter key press', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Verify API was called
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
          query: 'Test message',
          conversation_id: undefined,
          max_results: 10,
          include_sources: true,
        });
      });

      // Verify input is cleared after sending
      expect(input).toHaveValue('');
    });

    it('should not send message on Shift+Enter (should add new line)', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      await user.type(input, 'Test message');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      // Should not send message
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();

      // Input should still contain the text
      expect(input).toHaveValue('Test message');
    });

    it('should create new conversation on Ctrl+K', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/ask about chemical products/i)
        ).toBeInTheDocument();
      });

      // Press Ctrl+K
      await user.keyboard('{Control>}k{/Control}');

      // Should call createConversation
      await waitFor(() => {
        expect(mockApiClient.createConversation).toHaveBeenCalled();
      });
    });

    it('should handle rapid key presses without issues', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Rapid typing
      await user.type(input, 'Quick typing test', { delay: 1 });
      expect(input).toHaveValue('Quick typing test');

      // Rapid Enter presses (should only send once)
      await user.keyboard('{Enter}{Enter}{Enter}');

      // Should only be called once due to loading state prevention
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Send Button Click Events', () => {
    it('should send message when send button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message via button');
      await user.click(sendButton);

      // Verify API was called
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
          query: 'Test message via button',
          conversation_id: undefined,
          max_results: 10,
          include_sources: true,
        });
      });

      // Verify input is cleared
      expect(input).toHaveValue('');
    });

    it('should disable send button when input is empty', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Button should be disabled when input is empty
      expect(sendButton).toBeDisabled();

      // Type something
      await user.type(input, 'Test');
      expect(sendButton).not.toBeDisabled();

      // Clear input
      await user.clear(input);
      expect(sendButton).toBeDisabled();
    });

    it('should disable send button when input contains only whitespace', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Type only spaces
      await user.type(input, '   ');
      expect(sendButton).toBeDisabled();

      // Type tabs and newlines
      await user.clear(input);
      await user.type(input, '\t\n  \t');
      expect(sendButton).toBeDisabled();
    });

    it('should handle rapid button clicks gracefully', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');

      // Rapid clicks
      await user.click(sendButton);
      await user.click(sendButton);
      await user.click(sendButton);

      // Should only send once due to loading state
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading State Management', () => {
    it('should disable input and button during loading', async () => {
      const user = userEvent.setup();

      // Create controlled promise for manual resolution
      const { createControlledPromise } = (global as any).testSetup;
      const controlledOperation = createControlledPromise<ChatResponse>();
      mockApiClient.sendMessage.mockReturnValue(controlledOperation.promise);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send message
      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Should be disabled during loading
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });

      // Resolve the promise
      act(() => {
        controlledOperation.resolve(mockChatResponse);
      });

      // Should be enabled after loading
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('should show loading spinner in send button during loading', async () => {
      const user = userEvent.setup();

      // Create controlled promise
      const { createControlledPromise } = (global as any).testSetup;
      const controlledOperation = createControlledPromise<ChatResponse>();
      mockApiClient.sendMessage.mockReturnValue(controlledOperation.promise);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Should show loading spinner
      await waitFor(() => {
        expect(sendButton.querySelector('.animate-spin')).toBeInTheDocument();
      });

      // Resolve the promise
      act(() => {
        controlledOperation.resolve(mockChatResponse);
      });

      // Should show send icon again
      await waitFor(() => {
        expect(
          sendButton.querySelector('.animate-spin')
        ).not.toBeInTheDocument();
      });
    });

    it('should prevent concurrent message sending', async () => {
      const user = userEvent.setup();

      // Create controlled promise that doesn't resolve immediately
      const { createControlledPromise } = (global as unknown).testSetup;
      const controlledOperation = createControlledPromise<ChatResponse>();
      mockApiClient.sendMessage.mockReturnValue(controlledOperation.promise);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send first message
      await user.type(input, 'First message');
      await user.click(sendButton);

      // Try to send another message while first is loading
      await user.type(input, 'Second message');
      await user.click(sendButton);

      // Should only be called once
      expect(mockApiClient.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
        query: 'First message',
        conversation_id: undefined,
        max_results: 10,
        include_sources: true,
      });

      // Resolve the first request
      act(() => {
        controlledOperation.resolve(mockChatResponse);
      });

      // Now should be able to send the second message
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Error State Handling', () => {
    it('should enable input and button after error', async () => {
      const user = userEvent.setup();

      // Mock API error
      const apiError = new MockApiError('Network error', 0);
      mockApiClient.sendMessage.mockRejectedValue(apiError);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Input and button should be enabled again
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    it('should clear error when new message is sent', async () => {
      const user = userEvent.setup();

      // First call fails, second succeeds
      const apiError = new MockApiError('Network error', 0);
      mockApiClient.sendMessage
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(mockChatResponse);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send message that fails
      await user.type(input, 'First message');
      await user.click(sendButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Send another message
      await user.type(input, 'Second message');
      await user.click(sendButton);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus on input after sending message', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);

      // Focus input and send message
      await user.click(input);
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Wait for message to be sent
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalled();
      });

      // Input should still be focused
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('should focus input when clicking send button', async () => {
      const user = userEvent.setup();
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      // Wait for message to be sent
      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalled();
      });

      // Input should be focused after sending
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });
  });
});
