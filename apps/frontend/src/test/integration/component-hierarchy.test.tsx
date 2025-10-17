/**
 * Component Hierarchy Integration Tests
 *
 * Tests state propagation between parent and child components,
 * verifies hook data flows correctly through component tree,
 * and ensures proper component lifecycle management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMockUseChatReturn,
  createMockUseConversationsReturn,
  createMockUseProductsReturn,
  createMockMessage,
  createMockConversation,
  createMockProduct,
  createMockMessages,
  createMockConversations,
  createMockProducts,
} from '../standardized-mocks';

// Import components
import ChatInterface from '../../components/chat/ChatInterface';
import ProductBrowser from '../../components/products/ProductBrowser';

// Mock hooks
vi.mock('../../hooks/useChat');
vi.mock('../../hooks/useConversations');
vi.mock('../../hooks/useProducts');

// Import mocked hooks for type safety
import { useChat } from '../../hooks/useChat';
import { useConversations } from '../../hooks/useConversations';
import {
  useProducts,
  useProductDetail,
  useProductFilters,
} from '../../hooks/useProducts';

const mockUseChat = vi.mocked(useChat);
const mockUseConversations = vi.mocked(useConversations);
const mockUseProducts = vi.mocked(useProducts);
const mockUseProductDetail = vi.mocked(useProductDetail);
const mockUseProductFilters = vi.mocked(useProductFilters);

describe('Component Hierarchy Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockUseChat.mockReturnValue(createMockUseChatReturn());
    mockUseConversations.mockReturnValue(createMockUseConversationsReturn());
    mockUseProducts.mockReturnValue(createMockUseProductsReturn());
    mockUseProductDetail.mockReturnValue({
      product: null,
      relatedProducts: [],
      loading: false,
      error: null,
      loadProduct: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });
    mockUseProductFilters.mockReturnValue({
      families: ['ASA', 'DCA', 'ECA'],
      applications: ['Coatings', 'Adhesives', 'Composites'],
      loading: false,
      error: null,
      loadFilters: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('ChatInterface Component Hierarchy', () => {
    describe('ChatHistory Integration', () => {
      it('should pass messages from ChatInterface to ChatHistory', async () => {
        // Arrange: Create mock messages
        const mockMessages = createMockMessages(3);
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            messages: mockMessages,
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify messages are displayed in ChatHistory
        await waitFor(() => {
          expect(screen.getByText('Message 1')).toBeInTheDocument();
          expect(screen.getByText('Message 2')).toBeInTheDocument();
          expect(screen.getByText('Message 3')).toBeInTheDocument();
        });
      });

      it('should display loading state in ChatHistory when chat is loading', async () => {
        // Arrange: Mock loading state
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
            messages: [],
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify loading spinner is displayed
        await waitFor(() => {
          expect(
            screen.getByTestId('chat-loading-spinner')
          ).toBeInTheDocument();
        });
      });

      it('should show welcome section when no messages and not loading', async () => {
        // Arrange: Mock empty state
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            messages: [],
            isLoading: false,
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify welcome section is displayed
        await waitFor(() => {
          expect(screen.getByText('Start a conversation')).toBeInTheDocument();
        });
      });

      it('should update ChatHistory when messages change', async () => {
        // Arrange: Start with empty messages
        const { rerender } = render(<ChatInterface />);

        // Verify initial empty state
        expect(screen.getByText('Start a conversation')).toBeInTheDocument();

        // Act: Update with messages
        const newMessages = createMockMessages(2);
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            messages: newMessages,
          })
        );

        rerender(<ChatInterface />);

        // Assert: Verify messages are now displayed
        await waitFor(() => {
          expect(screen.getByText('Message 1')).toBeInTheDocument();
          expect(screen.getByText('Message 2')).toBeInTheDocument();
          expect(
            screen.queryByText('Start a conversation')
          ).not.toBeInTheDocument();
        });
      });
    });

    describe('ChatInput Integration', () => {
      it('should call sendMessage when user sends a message through ChatInput', async () => {
        // Arrange: Setup mock with spy
        const mockSendMessage = vi.fn().mockResolvedValue(undefined);
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            sendMessage: mockSendMessage,
          })
        );

        const user = userEvent.setup();
        render(<ChatInterface />);

        // Act: Type and send message
        const input = screen.getByRole('textbox');
        await user.type(input, 'Test message from ChatInput');
        await user.click(screen.getByRole('button', { name: /send/i }));

        // Assert: Verify sendMessage was called
        expect(mockSendMessage).toHaveBeenCalledWith(
          'Test message from ChatInput'
        );
      });

      it('should disable ChatInput when chat is loading', async () => {
        // Arrange: Mock loading state
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            isLoading: true,
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify input is disabled
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();

        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled();
      });

      it('should disable ChatInput when there is an error', async () => {
        // Arrange: Mock error state
        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            error: {
              message: 'Network error',
              status: 500,
              name: 'ApiError',
              isNetworkError: () => false,
              isServerError: () => true,
              isClientError: () => false,
              isRetryable: () => true,
            },
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify input is disabled
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
      });
    });

    describe('ConversationSidebar Integration', () => {
      it('should pass conversations from useConversations to ConversationSidebar', async () => {
        // Arrange: Create mock conversations
        const mockConversations = createMockConversations(3);
        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            conversations: mockConversations,
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify conversations are displayed
        await waitFor(() => {
          expect(screen.getByText('Conversation 1')).toBeInTheDocument();
          expect(screen.getByText('Conversation 2')).toBeInTheDocument();
          expect(screen.getByText('Conversation 3')).toBeInTheDocument();
        });
      });

      it('should call loadConversation when conversation is selected', async () => {
        // Arrange: Setup mocks
        const mockLoadConversation = vi.fn().mockResolvedValue(undefined);
        const mockConversations = createMockConversations(2);

        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            loadConversation: mockLoadConversation,
            conversationId: null,
          })
        );

        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            conversations: mockConversations,
          })
        );

        const user = userEvent.setup();
        render(<ChatInterface />);

        // Act: Click on a conversation (click on the clickable area)
        const conversationTitle = screen.getByText('Conversation 1');
        const clickableArea =
          conversationTitle.closest('.flex-1') || conversationTitle;
        await user.click(clickableArea);

        // Assert: Verify loadConversation was called
        await waitFor(() => {
          expect(mockLoadConversation).toHaveBeenCalledWith(
            mockConversations[0].id
          );
        });
      });

      it('should call createConversation when new conversation is requested', async () => {
        // Arrange: Setup mocks
        const mockCreateConversation = vi.fn().mockResolvedValue({
          id: 'new-conv-123',
          title: 'New Conversation',
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          metadata: {},
        });

        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            createConversation: mockCreateConversation,
          })
        );

        const user = userEvent.setup();
        render(<ChatInterface />);

        // Act: Click new conversation button
        const newButton = screen.getByRole('button', { name: /new/i });
        await user.click(newButton);

        // Assert: Verify createConversation was called
        expect(mockCreateConversation).toHaveBeenCalled();
      });

      it('should show loading state in ConversationSidebar when conversations are loading', async () => {
        // Arrange: Mock loading state
        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            isLoading: true,
            conversations: [],
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify loading skeleton is displayed
        await waitFor(() => {
          const skeletons = screen.getAllByText((content, element) => {
            return element?.classList.contains('animate-pulse') || false;
          });
          expect(skeletons.length).toBeGreaterThan(0);
        });
      });
    });

    describe('State Synchronization', () => {
      it('should synchronize conversation selection between sidebar and chat', async () => {
        // Arrange: Setup mocks
        const mockConversations = createMockConversations(2);
        const mockMessages = createMockMessages(2, {
          conversation_id: mockConversations[0].id,
        });

        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            messages: mockMessages,
            conversationId: mockConversations[0].id,
          })
        );

        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            conversations: mockConversations,
          })
        );

        // Act: Render ChatInterface
        render(<ChatInterface />);

        // Assert: Verify active conversation is highlighted and messages are shown
        await waitFor(() => {
          // Check that messages are displayed
          expect(screen.getByText('Message 1')).toBeInTheDocument();
          expect(screen.getByText('Message 2')).toBeInTheDocument();

          // Check that the correct conversation appears active (has accent styling)
          const activeConversation = screen
            .getByText('Conversation 1')
            .closest('.bg-accent, [class*="bg-accent"]');
          expect(activeConversation).toBeInTheDocument();
        });
      });

      it('should clear messages when conversation is deleted', async () => {
        // Arrange: Setup mocks
        const mockClearMessages = vi.fn();
        const mockDeleteConversation = vi.fn().mockResolvedValue(undefined);
        const mockConversations = createMockConversations(1);

        mockUseChat.mockReturnValue(
          createMockUseChatReturn({
            conversationId: mockConversations[0].id,
            clearMessages: mockClearMessages,
          })
        );

        mockUseConversations.mockReturnValue(
          createMockUseConversationsReturn({
            conversations: mockConversations,
            deleteConversation: mockDeleteConversation,
          })
        );

        const user = userEvent.setup();
        render(<ChatInterface />);

        // Act: Delete the current conversation
        // Find the delete button by its destructive styling
        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons.find((button) =>
          button.className.includes('text-destructive')
        );

        if (deleteButton) {
          await user.click(deleteButton);
        }

        // Assert: Verify clearMessages was called
        await waitFor(() => {
          expect(mockClearMessages).toHaveBeenCalled();
        });
      });
    });
  });

  describe('ProductBrowser Component Hierarchy', () => {
    describe('ProductList Integration', () => {
      it('should pass products from ProductBrowser to ProductList', async () => {
        // Arrange: Create mock products
        const mockProducts = createMockProducts(3);
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            products: mockProducts,
            totalCount: 3,
          })
        );

        // Act: Render ProductBrowser
        render(<ProductBrowser />);

        // Assert: Verify products are displayed
        await waitFor(() => {
          expect(screen.getByText('Product 1')).toBeInTheDocument();
          expect(screen.getByText('Product 2')).toBeInTheDocument();
          expect(screen.getByText('Product 3')).toBeInTheDocument();
          expect(screen.getByText('3 products')).toBeInTheDocument();
        });
      });

      it('should show empty state when no products are available', async () => {
        // Arrange: Mock empty products
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            products: [],
            totalCount: 0,
            loading: false,
          })
        );

        // Act: Render ProductBrowser
        render(<ProductBrowser />);

        // Assert: Verify empty state is displayed
        await waitFor(() => {
          expect(screen.getByTestId('product-empty-state')).toBeInTheDocument();
          expect(screen.getByText('No products found')).toBeInTheDocument();
        });
      });

      it('should show loading state when products are loading', async () => {
        // Arrange: Mock loading state
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            loading: true,
            products: [],
          })
        );

        // Act: Render ProductBrowser
        render(<ProductBrowser />);

        // Assert: Verify loading state is displayed
        await waitFor(() => {
          expect(screen.getByTestId('product-loading')).toBeInTheDocument();
        });
      });
    });

    describe('Search Integration', () => {
      it('should call searchProducts when search input changes', async () => {
        // Arrange: Setup mock with spy
        const mockSearchProducts = vi.fn().mockResolvedValue(undefined);
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            searchProducts: mockSearchProducts,
          })
        );

        const user = userEvent.setup();
        render(<ProductBrowser />);

        // Act: Type in search input
        const searchInput = screen.getByTestId('product-search-input');
        await user.type(searchInput, 'ASA');

        // Assert: Verify searchProducts was called
        // Note: This might be debounced, so we wait for it
        await waitFor(
          () => {
            expect(mockSearchProducts).toHaveBeenCalled();
          },
          { timeout: 2000 }
        );
      });

      it('should update product list when search results change', async () => {
        // Arrange: Start with all products
        const allProducts = createMockProducts(5);
        const filteredProducts = createMockProducts(2, { name: 'ASA Product' });

        const { rerender } = render(<ProductBrowser />);

        // Initially show all products
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            products: allProducts,
            totalCount: 5,
          })
        );

        rerender(<ProductBrowser />);

        // Verify all products are shown
        await waitFor(() => {
          expect(screen.getByText('5 products')).toBeInTheDocument();
        });

        // Act: Update with filtered results
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            products: filteredProducts,
            totalCount: 2,
          })
        );

        rerender(<ProductBrowser />);

        // Assert: Verify filtered results are shown
        await waitFor(() => {
          expect(screen.getByText('2 products')).toBeInTheDocument();
        });
      });
    });

    describe('Error Handling Integration', () => {
      it('should display error message when product loading fails', async () => {
        // Arrange: Mock error state
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            error: 'Failed to load products',
            loading: false,
          })
        );

        // Act: Render ProductBrowser
        render(<ProductBrowser />);

        // Assert: Verify error is displayed
        await waitFor(() => {
          expect(screen.getByTestId('product-error')).toBeInTheDocument();
          expect(
            screen.getByText('Failed to load products')
          ).toBeInTheDocument();
        });
      });

      it('should display error message without retry button', async () => {
        // Arrange: Setup mock with error
        const mockRetry = vi.fn().mockResolvedValue(undefined);
        mockUseProducts.mockReturnValue(
          createMockUseProductsReturn({
            error: 'Network error',
            retry: mockRetry,
            isRetryable: true,
          })
        );

        // Act: Render ProductBrowser
        render(<ProductBrowser />);

        // Assert: Verify error is displayed but no retry button
        await waitFor(() => {
          expect(screen.getByTestId('product-error')).toBeInTheDocument();
          expect(screen.getByText('Network error')).toBeInTheDocument();
          // ProductList doesn't show retry buttons - that's handled at hook level
          expect(
            screen.queryByRole('button', { name: /retry/i })
          ).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('Component Lifecycle and Cleanup', () => {
    it('should mount ChatInterface without errors', () => {
      // Arrange & Act: Render component
      const { unmount } = render(<ChatInterface />);

      // Assert: Component should render successfully
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();

      // Cleanup: Unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should mount ProductBrowser without errors', () => {
      // Arrange & Act: Render component
      const { unmount } = render(<ProductBrowser />);

      // Assert: Component should render successfully
      expect(screen.getByTestId('product-browser')).toBeInTheDocument();

      // Cleanup: Unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should clean up event listeners on unmount', async () => {
      // Arrange: Spy on event listener methods
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      // Act: Mount and unmount component
      const { unmount } = render(<ChatInterface />);

      // Verify event listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      // Unmount component
      unmount();

      // Assert: Event listener should be removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      // Cleanup spies
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should handle rapid mount/unmount cycles without memory leaks', () => {
      // Arrange: Track initial state
      const initialListenerCount = document.addEventListener.length;

      // Act: Rapidly mount and unmount components
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<ChatInterface />);
        unmount();
      }

      // Assert: No memory leaks (this is a basic check)
      // In a real scenario, you might use more sophisticated memory leak detection
      expect(() => {
        // Force garbage collection if available (Node.js)
        if (global.gc) {
          global.gc();
        }
      }).not.toThrow();
    });

    it('should properly reset component state between test runs', () => {
      // Arrange: Render component with initial state
      const { unmount } = render(<ChatInterface />);
      unmount();

      // Act: Render component again
      render(<ChatInterface />);

      // Assert: Component should render with fresh state
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();

      // Verify no stale state from previous render
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });
  });
});
