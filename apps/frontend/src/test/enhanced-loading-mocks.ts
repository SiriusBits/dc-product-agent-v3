/**
 * Enhanced hook mocks with proper loading state management
 * Fixes loading state blocking issues and provides controlled async operations
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';
import {
  LoadingStateManager,
  createLoadingAwareOperation,
  clearAllLoadingStates,
} from './loading-state-manager';

// Enhanced mock state with loading management
interface EnhancedMockState {
  chat: {
    messages: ChatMessage[];
    conversationId: string | null;
    error: ApiError | null;
  };
  conversations: {
    conversations: Conversation[];
    error: ApiError | null;
  };
}

// Global state and loading manager
let mockState: EnhancedMockState;
let loadingManager: LoadingStateManager;

// Initialize state
const initializeState = () => {
  mockState = {
    chat: {
      messages: [],
      conversationId: null,
      error: null,
    },
    conversations: {
      conversations: [],
      error: null,
    },
  };

  loadingManager = new LoadingStateManager({
    sendMessageDelay: 100,
    loadConversationsDelay: 50,
    createConversationDelay: 50,
    autoResolveLoading: true,
    loadingResolutionDelay: 100,
  });
};

// Mock data factories
export const createMockChatMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content: 'Test message',
  role: 'user',
  timestamp: new Date(),
  conversation_id: 'conv-123',
  ...overrides,
});

export const createMockConversation = (
  overrides: Partial<Conversation> = {}
): Conversation => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  messages: [],
  created_at: new Date(),
  updated_at: new Date(),
  title: 'Test Conversation',
  metadata: {},
  ...overrides,
});

export const createMockChatResponse = (
  overrides: Partial<ChatResponse> = {}
): ChatResponse => ({
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
  ...overrides,
});

// Enhanced useChat mock with proper loading state management
export const createEnhancedUseChatMock = () => {
  const sendMessage = vi.fn().mockImplementation(async (query: string) => {
    if (!query.trim()) return;

    return createLoadingAwareOperation(
      'sendMessage',
      async () => {
        // Clear any previous error
        mockState.chat.error = null;

        // Create user message
        const userMessage = createMockChatMessage({
          content: query,
          role: 'user',
          conversation_id: mockState.chat.conversationId || 'conv-123',
        });

        // Add user message immediately
        mockState.chat.messages = [...mockState.chat.messages, userMessage];

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Create mock response
        const response = createMockChatResponse({
          answer: `Response to: ${query}`,
          conversation_id: mockState.chat.conversationId || 'conv-123',
        });

        // Create assistant message
        const assistantMessage = createMockChatMessage({
          content: response.answer,
          role: 'assistant',
          conversation_id: response.conversation_id,
          sources: response.sources,
        });

        // Update state
        mockState.chat.messages = [
          ...mockState.chat.messages,
          assistantMessage,
        ];
        mockState.chat.conversationId = response.conversation_id;

        return response;
      },
      { delay: loadingManager.config.sendMessageDelay }
    );
  });

  const clearMessages = vi.fn().mockImplementation(() => {
    mockState.chat.messages = [];
    mockState.chat.conversationId = null;
    mockState.chat.error = null;
  });

  const loadConversation = vi.fn().mockImplementation(async (id: string) => {
    return createLoadingAwareOperation(
      'loadConversation',
      async () => {
        // Find conversation or create mock
        const conversation =
          mockState.conversations.conversations.find((c) => c.id === id) ||
          createMockConversation({ id, messages: [] });

        mockState.chat.messages = conversation.messages;
        mockState.chat.conversationId = id;
        mockState.chat.error = null;

        return conversation;
      },
      { delay: 50 }
    );
  });

  const retryLastMessage = vi.fn().mockImplementation(async () => {
    return createLoadingAwareOperation(
      'retryLastMessage',
      async () => {
        // Clear error
        mockState.chat.error = null;

        // Find last user message
        const lastUserMessage = mockState.chat.messages
          .slice()
          .reverse()
          .find((msg) => msg.role === 'user');

        if (lastUserMessage) {
          // Remove any assistant messages after the last user message
          const lastUserIndex =
            mockState.chat.messages.lastIndexOf(lastUserMessage);
          mockState.chat.messages = mockState.chat.messages.slice(
            0,
            lastUserIndex + 1
          );

          // Resend the message
          await sendMessage(lastUserMessage.content);
        }
      },
      { delay: 50 }
    );
  });

  return {
    get messages() {
      return mockState.chat.messages;
    },
    get isLoading() {
      return (
        loadingManager.isLoading('sendMessage') ||
        loadingManager.isLoading('loadConversation') ||
        loadingManager.isLoading('retryLastMessage')
      );
    },
    get error() {
      return mockState.chat.error;
    },
    get conversationId() {
      return mockState.chat.conversationId;
    },
    get isRetryable() {
      return mockState.chat.error?.isRetryable() ?? false;
    },
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
  };
};

// Enhanced useConversations mock with proper loading state management
export const createEnhancedUseConversationsMock = () => {
  const loadConversations = vi.fn().mockImplementation(async () => {
    return createLoadingAwareOperation(
      'loadConversations',
      async () => {
        // Simulate loading conversations
        mockState.conversations.error = null;
        // Keep existing conversations or return empty array
        return mockState.conversations.conversations;
      },
      { delay: loadingManager.config.loadConversationsDelay }
    );
  });

  const createConversation = vi.fn().mockImplementation(async () => {
    return createLoadingAwareOperation(
      'createConversation',
      async () => {
        const newConversation = createMockConversation({
          id: `conv-${Date.now()}`,
          title: 'New Conversation',
        });

        mockState.conversations.conversations = [
          newConversation,
          ...mockState.conversations.conversations,
        ];
        mockState.conversations.error = null;

        return newConversation;
      },
      { delay: loadingManager.config.createConversationDelay }
    );
  });

  const deleteConversation = vi.fn().mockImplementation(async (id: string) => {
    return createLoadingAwareOperation(
      'deleteConversation',
      async () => {
        mockState.conversations.conversations =
          mockState.conversations.conversations.filter((c) => c.id !== id);
        mockState.conversations.error = null;
      },
      { delay: 25 }
    );
  });

  const updateConversationTitle = vi
    .fn()
    .mockImplementation(async (id: string, title: string) => {
      return createLoadingAwareOperation(
        'updateConversationTitle',
        async () => {
          mockState.conversations.conversations =
            mockState.conversations.conversations.map((c) =>
              c.id === id ? { ...c, title } : c
            );
          mockState.conversations.error = null;
        },
        { delay: 25 }
      );
    });

  const retry = vi.fn().mockImplementation(async () => {
    return loadConversations();
  });

  return {
    get conversations() {
      return mockState.conversations.conversations;
    },
    get isLoading() {
      return (
        loadingManager.isLoading('loadConversations') ||
        loadingManager.isLoading('createConversation') ||
        loadingManager.isLoading('deleteConversation') ||
        loadingManager.isLoading('updateConversationTitle')
      );
    },
    get error() {
      return mockState.conversations.error;
    },
    get isRetryable() {
      return mockState.conversations.error?.isRetryable() ?? false;
    },
    loadConversations,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    retry,
  };
};

// Mock instances
export const mockUseChat = vi.fn();
export const mockUseConversations = vi.fn();

// Setup function for tests
export const setupEnhancedLoadingMocks = (
  options: {
    initialMessages?: ChatMessage[];
    initialConversations?: Conversation[];
    initialConversationId?: string;
    simulateErrors?: {
      sendMessage?: ApiError;
      loadConversations?: ApiError;
      createConversation?: ApiError;
    };
    loadingConfig?: Partial<LoadingStateManager['config']>;
  } = {}
) => {
  // Initialize state and loading manager
  initializeState();

  // Apply loading configuration
  if (options.loadingConfig) {
    Object.assign(loadingManager.config, options.loadingConfig);
  }

  // Apply initial state
  if (options.initialMessages) {
    mockState.chat.messages = options.initialMessages;
  }

  if (options.initialConversations) {
    mockState.conversations.conversations = options.initialConversations;
  }

  if (options.initialConversationId) {
    mockState.chat.conversationId = options.initialConversationId;
  }

  // Apply error simulations
  if (options.simulateErrors?.sendMessage) {
    mockState.chat.error = options.simulateErrors.sendMessage;
  }

  if (options.simulateErrors?.loadConversations) {
    mockState.conversations.error = options.simulateErrors.loadConversations;
  }

  // Create mock implementations
  const chatMock = createEnhancedUseChatMock();
  const conversationsMock = createEnhancedUseConversationsMock();

  // Configure mocks
  mockUseChat.mockImplementation(() => chatMock);
  mockUseConversations.mockImplementation(() => conversationsMock);

  // Auto-load conversations on setup (simulating useEffect)
  setTimeout(() => {
    conversationsMock.loadConversations();
  }, 0);

  return {
    chatMock,
    conversationsMock,
    loadingManager,
    mockState,
    // Helper functions
    waitForLoadingToComplete: () => loadingManager.waitForAllOperations(),
    isAnyLoading: () => loadingManager.isAnyLoading(),
    getLoadingState: () => loadingManager.getState(),
    // Manual control functions
    resolveOperation: <T>(key: string, value: T) =>
      loadingManager.resolvePromise(key, value),
    rejectOperation: (key: string, error: Error) =>
      loadingManager.rejectPromise(key, error),
    setError: (hook: 'chat' | 'conversations', error: ApiError | null) => {
      if (hook === 'chat') {
        mockState.chat.error = error;
      } else {
        mockState.conversations.error = error;
      }
    },
  };
};

// Cleanup function
export const cleanupEnhancedLoadingMocks = () => {
  vi.clearAllMocks();
  clearAllLoadingStates();
  initializeState();
};

// Mock the actual hooks
vi.mock('@/hooks/useChat', () => ({
  useChat: mockUseChat,
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: mockUseConversations,
}));

// Initialize on module load
initializeState();
