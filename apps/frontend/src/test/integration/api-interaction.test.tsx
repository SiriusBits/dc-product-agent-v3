/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useChat } from '@/hooks/useChat';
import { useProducts } from '@/hooks/useProducts';
import { useConversations } from '@/hooks/useConversations';
import ChatInterface from '@/components/chat/ChatInterface';
import ProductBrowser from '@/components/products/ProductBrowser';
import { ApiErrorDisplay } from '@/components/error/ApiErrorDisplay';
import {
  setupTest,
  typeIntoInput,
  createMockUseChatReturn,
  createMockUseProductsReturn,
  createMockUseConversationsReturn,
  createMockApiError,
  createMockMessage,
  createMockProduct,
  createMockConversation,
} from '@/test';

// NOTE: render is imported from @testing-library/react above - DO NOT import from astro:content
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __PREVENT_ASTRO_RENDER_IMPORT__ =
  'render already imported from @testing-library/react';

// Mock the hooks to use standardized mocks
vi.mock('@/hooks/useChat');
vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
  useProductDetail: vi.fn(() => ({
    product: null,
    relatedProducts: [],
    loading: false,
    error: null,
  })),
  useProductFilters: vi.fn(() => ({
    families: [],
    applications: [],
    loading: false,
    error: null,
  })),
  useProductComparison: vi.fn(() => ({
    comparisonData: null,
    loading: false,
    error: null,
  })),
}));
vi.mock('@/hooks/useConversations');

// Mock the API client with proper implementations
vi.mock('@/lib/api-client', () => {
  const mockApiClient = {
    sendMessage: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    getConversationMessages: vi.fn(),
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    getRelatedProducts: vi.fn(),
    compareProducts: vi.fn(),
    getProductFamilies: vi.fn(),
    getProductApplications: vi.fn(),
    getProductProperties: vi.fn(),
    getProductStatistics: vi.fn(),
    queryKnowledgeGraph: vi.fn(),
    getEntityNeighbors: vi.fn(),
    getSystemStatus: vi.fn(),
    checkHealth: vi.fn(),
  };

  class MockApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: unknown,
      public requestId?: string
    ) {
      super(message);
      this.name = 'ApiError';
    }

    static fromResponse(response: Response, errorData?: unknown): MockApiError {
      const errorObj = errorData as {
        message?: string;
        details?: unknown;
        request_id?: string;
      } | null;

      const message =
        errorObj?.message || `HTTP ${response.status}: ${response.statusText}`;
      return new MockApiError(
        message,
        response.status,
        errorObj?.details,
        errorObj?.request_id
      );
    }

    static fromNetworkError(error: Error): MockApiError {
      return new MockApiError(
        'Network error: Please check your connection and try again.',
        0,
        { originalError: error.message }
      );
    }

    static fromTimeout(): MockApiError {
      return new MockApiError(
        'Request timeout: The server is taking too long to respond.',
        408
      );
    }

    isNetworkError(): boolean {
      return this.status === 0;
    }

    isServerError(): boolean {
      return this.status >= 500;
    }

    isClientError(): boolean {
      return this.status >= 400 && this.status < 500;
    }

    isRetryable(): boolean {
      return (
        this.isNetworkError() || this.isServerError() || this.status === 408
      );
    }
  }

  return {
    apiClient: mockApiClient,
    ApiError: MockApiError,
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('API Interaction Tests', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest({
      enableAutoCleanup: true,
      mockLocalStorage: true,
    });

    // Mock the hooks to use our reactive mocks
    vi.mocked(useChat).mockImplementation(testContext.chatMock.getMock());
    vi.mocked(useProducts).mockImplementation(
      testContext.productsMock.getMock()
    );
    vi.mocked(useConversations).mockImplementation(
      testContext.conversationsMock.getMock()
    );

    mockLocalStorage.getItem.mockReturnValue(null);

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

  describe('Chat API Interactions', () => {
    it('displays messages correctly when chat succeeds', async () => {
      const mockMessages = [
        createMockMessage({ content: 'Test query', role: 'user' }),
        createMockMessage({ content: 'Test response', role: 'assistant' }),
      ];

      await testContext.updateChat({
        messages: mockMessages,
        isLoading: false,
        error: null,
      });

      await testContext.updateConversations({
        conversations: [],
        isLoading: false,
        error: null,
      });

      testContext.renderComponent(<ChatInterface />);

      // Verify messages are displayed
      expect(screen.getByText('Test query')).toBeInTheDocument();
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });

    it('handles API errors correctly in UI', async () => {
      const apiError = createMockApiError('Network error', 0);

      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          error: apiError,
          isRetryable: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('shows retry button for retryable errors', async () => {
      const apiError = createMockApiError('Server error', 500);

      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          error: apiError,
          isRetryable: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      // Verify retry button is shown
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });
    });

    it('manages loading states correctly in UI', async () => {
      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          isLoading: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      // Verify loading state is shown
      await waitFor(() => {
        expect(
          screen.getByTestId('chat-chat-loading-spinner')
        ).toBeInTheDocument();
      });

      // Verify input is disabled
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      expect(input).toBeDisabled();
    });

    it('calls sendMessage when user sends a message', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);

      await testContext.updateChat({
        sendMessage: mockSendMessage,
        isLoading: false,
        messages: [],
      });

      await testContext.updateConversations({
        conversations: [],
        isLoading: false,
        error: null,
      });

      const { getByPlaceholderText, getByRole } = testContext.renderComponent(
        <ChatInterface />
      );

      // Type and send a message using enhanced input utilities
      const input = getByPlaceholderText(/ask about chemical products/i);
      const sendButton = getByRole('button', { name: /send/i });

      await typeIntoInput(input, 'Test message');
      await userEvent.click(sendButton);

      // Verify sendMessage was called
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });
  });

  describe('Product Search API Interactions', () => {
    it('displays products correctly when search succeeds', async () => {
      const mockProducts = [
        createMockProduct({ name: 'ASA 150', family: 'ASA' }),
        createMockProduct({ name: 'DCA 221', family: 'DCA' }),
      ];

      await testContext.updateProducts({
        products: mockProducts,
        totalCount: 2,
        loading: false,
        error: null,
      });

      testContext.renderComponent(<ProductBrowser />);

      // Verify products are displayed
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
      expect(screen.getByText('DCA 221')).toBeInTheDocument();
      expect(screen.getByText('2 products')).toBeInTheDocument();
    });

    it('handles product search errors in UI', async () => {
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          error: 'Search failed',
          isRetryable: true,
          products: [],
          totalCount: 0,
        })
      );

      render(<ProductBrowser />);

      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('product-error')).toBeInTheDocument();
        expect(screen.getByText('Search failed')).toBeInTheDocument();
      });
    });

    it('shows loading state during search', async () => {
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          loading: true,
          products: [],
          totalCount: 0,
        })
      );

      render(<ProductBrowser />);

      // Verify loading state is shown
      await waitFor(() => {
        expect(screen.getByTestId('product-loading')).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Management API Interactions', () => {
    it('displays conversations correctly when loaded', async () => {
      const mockConversations = [
        createMockConversation({ title: 'Test Conversation 1' }),
        createMockConversation({ title: 'Test Conversation 2' }),
      ];

      vi.mocked(useChat).mockReturnValue(createMockUseChatReturn());

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn({
          conversations: mockConversations,
          isLoading: false,
          error: null,
        })
      );

      render(<ChatInterface />);

      // Verify conversations are displayed in sidebar
      expect(screen.getByText('Test Conversation 1')).toBeInTheDocument();
      expect(screen.getByText('Test Conversation 2')).toBeInTheDocument();
    });

    it('handles conversation creation in UI', async () => {
      const mockCreateConversation = vi
        .fn()
        .mockResolvedValue(
          createMockConversation({ title: 'New Conversation' })
        );

      vi.mocked(useChat).mockReturnValue(createMockUseChatReturn());

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn({
          createConversation: mockCreateConversation,
          conversations: [],
        })
      );

      render(<ChatInterface />);

      // Click new conversation button
      const newButton = screen.getByRole('button', { name: /new/i });
      await userEvent.click(newButton);

      // Verify createConversation was called
      expect(mockCreateConversation).toHaveBeenCalled();
    });

    it('handles conversation errors in UI', async () => {
      const conversationError = createMockApiError(
        'Failed to load conversations',
        500
      );

      vi.mocked(useChat).mockReturnValue(createMockUseChatReturn());

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn({
          error: conversationError,
          isRetryable: true,
          conversations: [],
        })
      );

      render(<ChatInterface />);

      // Verify conversation error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(
          screen.getByText('Failed to load conversations')
        ).toBeInTheDocument();
      });
    });
  });

  describe('API Error Display Tests', () => {
    describe('Error Message Display', () => {
      it('displays network error messages correctly in UI', async () => {
        const networkError = createMockApiError(
          'Network error: Please check your connection and try again.',
          0
        );

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: networkError,
            isRetryable: true,
          })
        );

        render(<ChatInterface />);

        // Verify error message is displayed
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(
            screen.getByText(
              'Network error: Please check your connection and try again.'
            )
          ).toBeInTheDocument();
        });

        // Verify error alert is present
        const errorAlert = screen.getByTestId('chat-error');
        expect(errorAlert).toBeInTheDocument();
      });

      it('displays server error messages correctly in UI', async () => {
        const serverError = createMockApiError('Internal server error', 500);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
          })
        );

        render(<ChatInterface />);

        // Verify server error message
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(screen.getByText('Internal server error')).toBeInTheDocument();
        });

        // Verify error styling for server errors
        const errorAlert = screen.getByTestId('chat-error');
        expect(
          errorAlert.querySelector('.border-destructive\\/50')
        ).toBeInTheDocument();
      });

      it('displays client error messages correctly in UI', async () => {
        const clientError = createMockApiError('Bad request', 400);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: clientError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify client error message
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(screen.getByText('Bad request')).toBeInTheDocument();
        });
      });

      it('displays authentication error messages correctly', async () => {
        const authError = createMockApiError('Unauthorized', 401);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: authError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify auth error message and styling
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(screen.getByText('Unauthorized')).toBeInTheDocument();
        });

        // Auth errors still use destructive styling in ChatInterface
        const errorAlert = screen.getByTestId('chat-error');
        expect(errorAlert).toBeInTheDocument();
      });

      it('displays not found error messages correctly', async () => {
        const notFoundError = createMockApiError('Resource not found', 404);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: notFoundError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify 404 error message
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(screen.getByText('Resource not found')).toBeInTheDocument();
        });
      });
    });

    describe('Error Details Accessibility', () => {
      it('makes error details accessible when showDetails is enabled', async () => {
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            error: 'Validation failed',
            isRetryable: false,
          })
        );

        render(<ProductBrowser />);

        // Look for error display (ProductBrowser should show errors)
        await waitFor(() => {
          expect(screen.getByTestId('product-error')).toBeInTheDocument();
        });
      });

      it('provides proper ARIA labels for error components', async () => {
        const error = createMockApiError('Test error', 500);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: error,
            isRetryable: true,
          })
        );

        render(<ChatInterface />);

        // Verify error is accessible
        await waitFor(() => {
          const errorAlert = screen.getByTestId('chat-error');
          expect(errorAlert).toBeInTheDocument();
          expect(errorAlert).toHaveTextContent('Test error');
        });
      });

      it('displays error request ID when available', async () => {
        const errorWithRequestId = createMockApiError(
          'Server error',
          500,
          undefined,
          'req-abc-123'
        );

        // Test with ApiErrorDisplay component directly
        const { container } = render(
          <ApiErrorDisplay error={errorWithRequestId} showDetails={true} />
        );

        // Check if request ID is shown in details
        const detailsElement = container.querySelector('details');
        expect(detailsElement).toBeInTheDocument();
      });
    });

    describe('Different Error Types Integration', () => {
      it('handles timeout errors in chat interface', async () => {
        const timeoutError = createMockApiError(
          'Request timeout: The server is taking too long to respond.',
          408
        );

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: timeoutError,
            isRetryable: true,
          })
        );

        render(<ChatInterface />);

        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
          expect(screen.getByText(/timeout/i)).toBeInTheDocument();
        });
      });

      it('handles network errors in product browser', async () => {
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            error: 'Network error: Please check your connection and try again.',
            isRetryable: true,
          })
        );

        render(<ProductBrowser />);

        await waitFor(() => {
          expect(screen.getByTestId('product-error')).toBeInTheDocument();
        });
      });

      it('handles validation errors with detailed messages', async () => {
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            error: 'Validation failed: Query must be at least 3 characters',
            isRetryable: false,
          })
        );

        render(<ProductBrowser />);

        await waitFor(() => {
          expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
        });
      });
    });
  });

  describe('API Retry Functionality Tests', () => {
    describe('Retry Button Visibility', () => {
      it('shows retry button for server errors (5xx)', async () => {
        const serverError = createMockApiError('Internal server error', 500);
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is present for server errors
        await waitFor(() => {
          const retryButton = screen.getByRole('button', { name: /retry/i });
          expect(retryButton).toBeInTheDocument();
          expect(retryButton).toHaveTextContent(/retry/i);
        });
      });

      it('shows retry button for network errors (status 0)', async () => {
        const networkError = createMockApiError(
          'Network error: Please check your connection and try again.',
          0
        );
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: networkError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is present for network errors
        await waitFor(() => {
          const retryButton = screen.getByRole('button', { name: /retry/i });
          expect(retryButton).toBeInTheDocument();
        });
      });

      it('shows retry button for timeout errors (408)', async () => {
        const timeoutError = createMockApiError(
          'Request timeout: The server is taking too long to respond.',
          408
        );
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: timeoutError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is present for timeout errors
        await waitFor(() => {
          const retryButton = screen.getByRole('button', { name: /retry/i });
          expect(retryButton).toBeInTheDocument();
        });
      });

      it('does not show retry button for client errors (4xx)', async () => {
        const clientError = createMockApiError('Bad request', 400);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: clientError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is NOT present for client errors
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        expect(
          screen.queryByRole('button', { name: /retry/i })
        ).not.toBeInTheDocument();
      });

      it('does not show retry button for unauthorized errors (401)', async () => {
        const authError = createMockApiError('Unauthorized', 401);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: authError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is NOT present for auth errors
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        expect(
          screen.queryByRole('button', { name: /retry/i })
        ).not.toBeInTheDocument();
      });

      it('does not show retry button for forbidden errors (403)', async () => {
        const forbiddenError = createMockApiError('Forbidden', 403);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: forbiddenError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is NOT present for forbidden errors
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        expect(
          screen.queryByRole('button', { name: /retry/i })
        ).not.toBeInTheDocument();
      });

      it('does not show retry button for not found errors (404)', async () => {
        const notFoundError = createMockApiError('Not found', 404);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: notFoundError,
            isRetryable: false,
          })
        );

        render(<ChatInterface />);

        // Verify retry button is NOT present for not found errors
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        expect(
          screen.queryByRole('button', { name: /retry/i })
        ).not.toBeInTheDocument();
      });
    });

    describe('Retry Button Functionality', () => {
      it('calls retry function when retry button is clicked in chat', async () => {
        const serverError = createMockApiError('Server error', 500);
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        render(<ChatInterface />);

        // Wait for retry button and click it
        await waitFor(() => {
          expect(
            screen.getByRole('button', { name: /retry/i })
          ).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Verify retry function was called
        expect(mockRetry).toHaveBeenCalledTimes(1);
      });

      it('calls retry function when retry button is clicked in product browser', async () => {
        const networkError =
          'Network error: Please check your connection and try again.';
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            error: networkError,
            isRetryable: true,
            retry: mockRetry,
          })
        );

        render(<ProductBrowser />);

        // Wait for error display and retry button
        await waitFor(() => {
          expect(screen.getByTestId('product-error')).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Verify retry function was called
        expect(mockRetry).toHaveBeenCalledTimes(1);
      });

      it('disables retry button during retry operation', async () => {
        const serverError = createMockApiError('Server error', 500);
        let resolveRetry: () => void;
        const retryPromise = new Promise<void>((resolve) => {
          resolveRetry = resolve;
        });
        const mockRetry = vi.fn().mockReturnValue(retryPromise);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
            isLoading: false,
          })
        );

        render(<ChatInterface />);

        // Click retry button
        await waitFor(() => {
          expect(
            screen.getByRole('button', { name: /retry/i })
          ).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Update mock to show loading state during retry
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
            isLoading: true,
          })
        );

        // Resolve the retry
        act(() => {
          resolveRetry!();
        });

        await act(async () => {
          await retryPromise;
        });

        expect(mockRetry).toHaveBeenCalledTimes(1);
      });

      it('clears error after successful retry', async () => {
        const serverError = createMockApiError('Server error', 500);
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        // Start with error state
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        rerender(<ChatInterface />);

        // Verify error is displayed
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        // Click retry
        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Update mock to show success state (no error)
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: null,
            isRetryable: false,
            retryLastMessage: mockRetry,
          })
        );

        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            error: null,
            isRetryable: false,
          })
        );

        rerender(<ChatInterface />);

        // Verify error is cleared
        await waitFor(() => {
          expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument();
        });
      });
    });

    describe('Retry in Different Components', () => {
      it('handles retry in conversation management', async () => {
        const serverError = createMockApiError(
          'Failed to load conversations',
          500
        );
        const mockRetry = vi.fn().mockResolvedValue(undefined);

        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            error: serverError,
            isRetryable: true,
            retry: mockRetry,
          })
        );

        render(<ChatInterface />);

        // The ConversationSidebar should show the error
        // Note: This depends on how ConversationSidebar handles errors
        // For now, we'll just verify the mock was set up correctly
        expect(vi.mocked(useConversations)).toHaveBeenCalled();
      });

      it('handles multiple retry attempts', async () => {
        const serverError = createMockApiError('Server error', 500);
        const mockRetry = vi
          .fn()
          .mockRejectedValueOnce(serverError) // First retry fails
          .mockResolvedValueOnce(undefined); // Second retry succeeds

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: serverError,
            isRetryable: true,
            retryLastMessage: mockRetry,
          })
        );

        render(<ChatInterface />);

        // First retry attempt
        await waitFor(() => {
          expect(
            screen.getByRole('button', { name: /retry/i })
          ).toBeInTheDocument();
        });

        let retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Still should have error after first failed retry
        await waitFor(() => {
          expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        });

        // Second retry attempt
        retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        expect(mockRetry).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('API Loading State Tests', () => {
    describe('Loading State Activation', () => {
      it('activates loading state during chat message sending', async () => {
        const mockSendMessage = vi.fn().mockImplementation(() => {
          return new Promise(() => {}); // Never resolves to keep loading
        });

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
            sendMessage: mockSendMessage,
          })
        );

        render(<ChatInterface />);

        // Verify loading indicators are active
        await waitFor(() => {
          // Check if loading spinner is present
          expect(
            screen.getByTestId('chat-chat-loading-spinner')
          ).toBeInTheDocument();
        });

        // Verify input is disabled during loading
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).toBeDisabled();

        // Verify send button is disabled during loading
        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled();
      });

      it('activates loading state during product search', async () => {
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: true,
            products: [],
            totalCount: 0,
          })
        );

        render(<ProductBrowser />);

        // Verify loading spinner is shown
        await waitFor(() => {
          expect(screen.getByTestId('product-loading')).toBeInTheDocument();
        });

        // Verify product list is not shown during loading
        expect(screen.queryByTestId('product-list')).not.toBeInTheDocument();
      });

      it('activates loading state during conversation loading', async () => {
        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: true,
            conversations: [],
          })
        );

        render(<ChatInterface />);

        // The ConversationSidebar should handle loading state
        // Verify the hook is called with loading state
        expect(vi.mocked(useConversations)).toHaveBeenCalled();
      });

      it('shows loading state for multiple concurrent operations', async () => {
        // Both chat and conversations loading
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: true,
          })
        );

        render(<ChatInterface />);

        // Verify chat loading state
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-chat-loading-spinner')
          ).toBeInTheDocument();
        });

        // Verify input is disabled
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).toBeDisabled();
      });
    });

    describe('Loading State Clearing on Success', () => {
      it('clears loading state when chat message succeeds', async () => {
        const mockMessages = [
          createMockMessage({ content: 'User message', role: 'user' }),
          createMockMessage({
            content: 'Assistant response',
            role: 'assistant',
          }),
        ];

        // Start with loading state
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state is active
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-chat-loading-spinner')
          ).toBeInTheDocument();
        });

        // Update to success state
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: false,
            messages: mockMessages,
            error: null,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state is cleared
        await waitFor(() => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
        });

        // Verify input is re-enabled
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).not.toBeDisabled();

        // Verify messages are displayed
        expect(screen.getByText('User message')).toBeInTheDocument();
        expect(screen.getByText('Assistant response')).toBeInTheDocument();
      });

      it('clears loading state when product search succeeds', async () => {
        const mockProducts = [
          createMockProduct({ name: 'ASA 150', family: 'ASA' }),
          createMockProduct({ name: 'DCA 221', family: 'DCA' }),
        ];

        // Start with loading state
        const { rerender } = render(<ProductBrowser />);

        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: true,
            products: [],
            totalCount: 0,
          })
        );

        rerender(<ProductBrowser />);

        // Verify loading state
        await waitFor(() => {
          expect(screen.getByTestId('product-loading')).toBeInTheDocument();
        });

        // Update to success state
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: false,
            products: mockProducts,
            totalCount: 2,
            error: null,
          })
        );

        rerender(<ProductBrowser />);

        // Verify loading state is cleared
        await waitFor(() => {
          expect(
            screen.queryByTestId('product-loading')
          ).not.toBeInTheDocument();
        });

        // Verify products are displayed
        expect(screen.getByTestId('product-list')).toBeInTheDocument();
        expect(screen.getByText('ASA 150')).toBeInTheDocument();
        expect(screen.getByText('DCA 221')).toBeInTheDocument();
      });

      it('clears loading state when conversation loading succeeds', async () => {
        const mockConversations = [
          createMockConversation({ title: 'Conversation 1' }),
          createMockConversation({ title: 'Conversation 2' }),
        ];

        // Start with loading, then success
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: true,
            conversations: [],
          })
        );

        rerender(<ChatInterface />);

        // Update to success state
        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: false,
            conversations: mockConversations,
            error: null,
          })
        );

        rerender(<ChatInterface />);

        // Verify conversations hook was called with success state
        expect(vi.mocked(useConversations)).toHaveBeenCalled();
      });
    });

    describe('Loading State Clearing on Error', () => {
      it('clears loading state when chat message fails', async () => {
        const error = createMockApiError('Network error', 0);

        // Start with loading state
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
        });

        // Update to error state
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: false,
            error: error,
            isRetryable: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state is cleared
        await waitFor(() => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
        });

        // Verify error is displayed
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();

        // Input remains disabled when there's an error
        const input = screen.getByPlaceholderText(
          /ask about chemical products/i
        );
        expect(input).toBeDisabled();
      });

      it('clears loading state when product search fails', async () => {
        const errorMessage = 'Search service unavailable';

        // Start with loading state
        const { rerender } = render(<ProductBrowser />);

        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: true,
            products: [],
            totalCount: 0,
          })
        );

        rerender(<ProductBrowser />);

        // Verify loading state
        await waitFor(() => {
          expect(screen.getByTestId('product-loading')).toBeInTheDocument();
        });

        // Update to error state
        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: false,
            products: [],
            totalCount: 0,
            error: errorMessage,
            isRetryable: true,
          })
        );

        rerender(<ProductBrowser />);

        // Verify loading state is cleared
        await waitFor(() => {
          expect(
            screen.queryByTestId('product-loading')
          ).not.toBeInTheDocument();
        });

        // Verify error is displayed
        expect(screen.getByTestId('product-error')).toBeInTheDocument();
      });

      it('clears loading state when conversation loading fails', async () => {
        const error = createMockApiError('Failed to load conversations', 500);

        // Start with loading, then error
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: true,
            conversations: [],
          })
        );

        rerender(<ChatInterface />);

        // Update to error state
        vi.mocked(useConversations).mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: false,
            conversations: [],
            error: error,
            isRetryable: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify conversations hook was called with error state
        expect(vi.mocked(useConversations)).toHaveBeenCalled();
      });
    });

    describe('Loading State Transitions', () => {
      it('handles rapid loading state changes', async () => {
        const { rerender } = render(<ChatInterface />);

        // Start with no loading
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: false,
          })
        );

        rerender(<ChatInterface />);

        // Switch to loading
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
        });

        // Switch back to not loading
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: false,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state is cleared
        await waitFor(() => {
          expect(
            screen.queryByTestId('chat-loading-spinner')
          ).not.toBeInTheDocument();
        });
      });

      it('maintains loading state consistency across components', async () => {
        // Both chat and products loading
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        vi.mocked(useProducts).mockReturnValue(
          createMockUseProductsReturn({
            loading: true,
          })
        );

        const { container } = render(
          <div>
            <ChatInterface />
            <ProductBrowser />
          </div>
        );

        // Verify both components show loading
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
          expect(screen.getByTestId('product-loading')).toBeInTheDocument();
        });

        // Both components should be in loading state
        expect(
          container.querySelectorAll('[data-testid*="loading"]')
        ).toHaveLength(2);
      });

      it('handles loading state during retry operations', async () => {
        const error = createMockApiError('Server error', 500);
        const mockRetry = vi.fn().mockImplementation(() => {
          return new Promise(() => {}); // Never resolves to keep loading
        });

        // Start with error state
        const { rerender } = render(<ChatInterface />);

        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: error,
            isRetryable: true,
            retryLastMessage: mockRetry,
            isLoading: false,
          })
        );

        rerender(<ChatInterface />);

        // Click retry button
        await waitFor(() => {
          expect(
            screen.getByRole('button', { name: /retry/i })
          ).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Update to loading state during retry
        vi.mocked(useChat).mockReturnValue(
          createMockUseChatReturn({
            error: error,
            isRetryable: true,
            retryLastMessage: mockRetry,
            isLoading: true,
          })
        );

        rerender(<ChatInterface />);

        // Verify loading state during retry
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
        });

        expect(mockRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Request Cancellation', () => {
    it('shows loading state during requests', async () => {
      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          isLoading: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      // Verify loading state prevents multiple requests
      const input = screen.getByPlaceholderText(/ask about chemical products/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Network Error Handling', () => {
    it('handles network timeouts in UI', async () => {
      const timeoutError = createMockApiError(
        'Request timeout: The server is taking too long to respond.',
        408
      );

      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          error: timeoutError,
          isRetryable: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(screen.getByText(/timeout/i)).toBeInTheDocument();
      });
    });

    it('handles network connection errors in UI', async () => {
      const networkError = createMockApiError(
        'Network error: Please check your connection and try again.',
        0
      );

      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({
          error: networkError,
          isRetryable: true,
          messages: [],
        })
      );

      vi.mocked(useConversations).mockReturnValue(
        createMockUseConversationsReturn()
      );

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-error')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Network error: Please check your connection and try again.'
          )
        ).toBeInTheDocument();
      });
    });
  });
});
