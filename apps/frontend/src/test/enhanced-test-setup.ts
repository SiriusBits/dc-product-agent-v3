/**
 * Enhanced test setup with direct hook mocking for input handling tests
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
} from '@repo/shared-types';
import { MockApiError } from './test-utils';

// Enhanced hook mock implementations
export interface EnhancedUseChatMock {
  messages: ChatMessage[];
  isLoading: boolean;
  error: MockApiError | null;
  conversationId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
  clearMessages: ReturnType<typeof vi.fn>;
  loadConversation: ReturnType<typeof vi.fn>;
  retryLastMessage: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

export interface EnhancedUseConversationsMock {
  conversations: Conversation[];
  isLoading: boolean;
  error: MockApiError | null;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
}

// Global mock state for controlled testing
let mockChatState: EnhancedUseChatMock;
let mockConversationsState: EnhancedUseConversationsMock;

// Mock API client for integration
export const mockApiClient = {
  sendMessage: vi.fn(),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  deleteConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
};

// Initialize mock states
const initializeMockStates = () => {
  mockChatState = {
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    retryLastMessage: vi.fn(),
    isRetryable: false,
  };

  mockConversationsState = {
    conversations: [],
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
  };
};

// Enhanced sendMessage implementation with proper state management
const createEnhancedSendMessage = () => {
  return vi.fn().mockImplementation(async (query: string) => {
    if (!query.trim()) return;

    // Set loading state
    mockChatState.isLoading = true;
    mockChatState.error = null;

    try {
      // Call the mock API client
      const response = await mockApiClient.sendMessage({
        query,
        conversation_id: mockChatState.conversationId || undefined,
        max_results: 10,
        include_sources: true,
      });

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        content: query,
        role: 'user',
        timestamp: new Date(),
        conversation_id: response.conversation_id || 'conv-123',
      };

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: response.answer,
        role: 'assistant',
        timestamp: new Date(),
        conversation_id: response.conversation_id || 'conv-123',
        sources: response.sources,
      };

      // Update state
      mockChatState.messages = [
        ...mockChatState.messages,
        userMessage,
        assistantMessage,
      ];
      mockChatState.conversationId = response.conversation_id || 'conv-123';
    } catch (error) {
      // Handle error
      mockChatState.error =
        error instanceof MockApiError
          ? error
          : new MockApiError('Unknown error', 0);
    } finally {
      // Clear loading state
      mockChatState.isLoading = false;
    }
  });
};

// Enhanced createConversation implementation
const createEnhancedCreateConversation = () => {
  return vi.fn().mockImplementation(async () => {
    mockConversationsState.isLoading = true;
    mockConversationsState.error = null;

    try {
      const newConversation = await mockApiClient.createConversation();
      mockConversationsState.conversations = [
        newConversation,
        ...mockConversationsState.conversations,
      ];
      return newConversation;
    } catch (error) {
      mockConversationsState.error =
        error instanceof MockApiError
          ? error
          : new MockApiError('Unknown error', 0);
      throw error;
    } finally {
      mockConversationsState.isLoading = false;
    }
  });
};

// Mock the hooks
export const mockUseChat = vi.fn();
export const mockUseConversations = vi.fn();

// Setup enhanced test environment
export const setupEnhancedTest = (
  options: {
    mockResponses?: {
      chatResponse?: ChatResponse;
      conversations?: Conversation[];
      newConversation?: Conversation;
    };
    initialState?: {
      messages?: ChatMessage[];
      conversationId?: string;
      conversations?: Conversation[];
    };
    simulateErrors?: {
      sendMessage?: MockApiError;
      createConversation?: MockApiError;
    };
  } = {}
) => {
  // Initialize mock states
  initializeMockStates();

  // Apply initial state
  if (options.initialState?.messages) {
    mockChatState.messages = options.initialState.messages;
  }
  if (options.initialState?.conversationId) {
    mockChatState.conversationId = options.initialState.conversationId;
  }
  if (options.initialState?.conversations) {
    mockConversationsState.conversations = options.initialState.conversations;
  }

  // Setup API client mocks
  const defaultChatResponse: ChatResponse = {
    answer: 'Test response',
    sources: [],
    conversation_id: 'conv-123',
    query_analysis: {
      query_type: 'specification' as QueryType,
      entities: [],
      intent_confidence: 0.9,
      suggested_strategy: {},
    },
    response_time_ms: 100,
    kg_enhanced: false,
    ...options.mockResponses?.chatResponse,
  };

  const defaultNewConversation: Conversation = {
    id: 'new-conv',
    messages: [],
    created_at: new Date(),
    updated_at: new Date(),
    title: 'New Conversation',
    metadata: {},
    ...options.mockResponses?.newConversation,
  };

  // Configure API client mocks
  if (options.simulateErrors?.sendMessage) {
    mockApiClient.sendMessage.mockRejectedValue(
      options.simulateErrors.sendMessage
    );
  } else {
    mockApiClient.sendMessage.mockResolvedValue(defaultChatResponse);
  }

  if (options.simulateErrors?.createConversation) {
    mockApiClient.createConversation.mockRejectedValue(
      options.simulateErrors.createConversation
    );
  } else {
    mockApiClient.createConversation.mockResolvedValue(defaultNewConversation);
  }

  mockApiClient.listConversations.mockResolvedValue(
    options.mockResponses?.conversations || []
  );

  // Setup enhanced hook implementations
  mockChatState.sendMessage = createEnhancedSendMessage();
  mockChatState.clearMessages = vi.fn().mockImplementation(() => {
    mockChatState.messages = [];
    mockChatState.conversationId = null;
    mockChatState.error = null;
  });
  mockChatState.loadConversation = vi
    .fn()
    .mockImplementation(async (id: string) => {
      mockChatState.isLoading = true;
      try {
        const conversation = await mockApiClient.getConversation(id);
        mockChatState.messages = conversation.messages;
        mockChatState.conversationId = id;
      } finally {
        mockChatState.isLoading = false;
      }
    });
  mockChatState.retryLastMessage = vi.fn().mockImplementation(async () => {
    // Simulate retry by clearing error and calling sendMessage again
    mockChatState.error = null;
    const lastUserMessage = mockChatState.messages
      .slice()
      .reverse()
      .find((msg) => msg.role === 'user');
    if (lastUserMessage) {
      await mockChatState.sendMessage(lastUserMessage.content);
    }
  });

  mockConversationsState.createConversation =
    createEnhancedCreateConversation();
  mockConversationsState.deleteConversation = vi
    .fn()
    .mockImplementation(async (id: string) => {
      await mockApiClient.deleteConversation(id);
      mockConversationsState.conversations =
        mockConversationsState.conversations.filter((c) => c.id !== id);
    });
  mockConversationsState.updateConversationTitle = vi
    .fn()
    .mockImplementation(async (id: string, title: string) => {
      await mockApiClient.updateConversationTitle(id, title);
      mockConversationsState.conversations =
        mockConversationsState.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        );
    });

  // Configure hook mocks to return current state
  mockUseChat.mockImplementation(() => ({
    ...mockChatState,
    isRetryable: mockChatState.error?.isRetryable() ?? false,
  }));

  mockUseConversations.mockImplementation(() => mockConversationsState);

  return {
    mockChatState,
    mockConversationsState,
    mockApiClient,
    // Helper to create controlled promises for manual resolution
    createControlledPromise: <T>() => {
      let resolvePromise: (value: T) => void;
      let rejectPromise: (error: Error) => void;
      const promise = new Promise<T>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      return {
        promise,
        resolve: resolvePromise!,
        reject: rejectPromise!,
      };
    },
  };
};

// Cleanup function
export const cleanupEnhancedTest = () => {
  vi.clearAllMocks();
  initializeMockStates();
};

// Mock the actual hooks
vi.mock('@/hooks/useChat', () => ({
  useChat: mockUseChat,
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: mockUseConversations,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
  ApiError: MockApiError,
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
  configurable: true,
});
