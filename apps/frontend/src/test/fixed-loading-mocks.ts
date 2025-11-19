/**
 * Fixed loading state mocks that properly handle loading transitions
 * Addresses the core issues: loading states blocking interface indefinitely
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';

// Mock state with proper loading management
interface MockState {
  chat: {
    messages: ChatMessage[];
    isLoading: boolean;
    error: ApiError | null;
    conversationId: string | null;
  };
  conversations: {
    conversations: Conversation[];
    isLoading: boolean;
    error: ApiError | null;
  };
}

let mockState: MockState;

// Initialize state
const initializeState = () => {
  mockState = {
    chat: {
      messages: [],
      isLoading: false,
      error: null,
      conversationId: null,
    },
    conversations: {
      conversations: [],
      isLoading: false,
      error: null,
    },
  };
};

// Counter for unique message IDs
let messageIdCounter = 0;

// Helper to create mock data with unique IDs
export const createMockChatMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => {
  messageIdCounter++;
  return {
    id: `msg-${Date.now()}-${messageIdCounter}`,
    content: 'Test message',
    role: 'user',
    timestamp: new Date(),
    conversation_id: 'conv-123',
    ...overrides,
  };
};

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

// Store simulated errors separately from state errors
let simulatedErrors: {
  sendMessage?: ApiError;
  loadConversations?: ApiError;
} = {};

// Fixed useChat mock with proper loading state transitions
const createFixedUseChatMock = () => {
  const sendMessage = vi.fn().mockImplementation(async (query: string) => {
    if (!query.trim()) return;

    // Set loading state immediately
    mockState.chat.isLoading = true;

    // Only clear error if there's no simulated error
    if (!simulatedErrors.sendMessage) {
      mockState.chat.error = null;
    }

    try {
      // Check if there's a simulated error for sendMessage
      if (simulatedErrors.sendMessage) {
        throw simulatedErrors.sendMessage;
      }

      // Add user message immediately with proper ID generation
      const userMessage = createMockChatMessage({
        content: query,
        role: 'user',
        conversation_id: mockState.chat.conversationId || 'conv-123',
      });

      mockState.chat.messages = [...mockState.chat.messages, userMessage];

      // Simulate API delay - shorter for better test performance
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create assistant response with sources if it's a question about viscosity
      let assistantContent = `Response to: ${query}`;
      let sources = undefined;

      if (query.toLowerCase().includes('viscosity')) {
        assistantContent =
          'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.';
        sources = [
          {
            content:
              'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
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
        ];
      }

      // Handle markdown test cases
      if (
        query.toLowerCase().includes('markdown') ||
        query.toLowerCase().includes('bold')
      ) {
        assistantContent = 'This is **bold text** and this is normal text.';
      }

      if (query.toLowerCase().includes('code')) {
        assistantContent = 'Use the `ASTM D445` test method for viscosity.';
      }

      if (query.toLowerCase().includes('list')) {
        assistantContent = `Properties of ASA 150:
1. Viscosity: 150 cP
2. Temperature: 25°C
- Used in coatings
- Chemical resistant`;
      }

      if (query.toLowerCase().includes('complex')) {
        assistantContent = `**ASA 150** specifications:
- Viscosity: \`150 cP\` at **25°C**
- Test method: *ASTM D445*
- Applications:
  1. **Coatings** industry
  2. *Chemical* processing`;
      }

      const assistantMessage = createMockChatMessage({
        content: assistantContent,
        role: 'assistant',
        conversation_id: mockState.chat.conversationId || 'conv-123',
        sources,
      });

      // Update state with both messages
      mockState.chat.messages = [...mockState.chat.messages, assistantMessage];
      mockState.chat.conversationId =
        mockState.chat.conversationId || 'conv-123';

      // Update the conversation in the conversations list with new messages
      const conversationId = mockState.chat.conversationId;
      if (conversationId) {
        const conversationIndex =
          mockState.conversations.conversations.findIndex(
            (c) => c.id === conversationId
          );
        if (conversationIndex >= 0) {
          mockState.conversations.conversations[conversationIndex] = {
            ...mockState.conversations.conversations[conversationIndex],
            messages: [...mockState.chat.messages],
            updated_at: new Date(),
            metadata: {
              ...mockState.conversations.conversations[conversationIndex]
                .metadata,
              message_count: mockState.chat.messages.length,
            },
          };
        }
      }

      // Force a small delay to ensure React can process the state update
      await new Promise((resolve) => setTimeout(resolve, 5));
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      mockState.chat.error = apiError;

      // Remove the user message on error (simulate failed send)
      if (mockState.chat.messages.length > 0) {
        const lastMessage =
          mockState.chat.messages[mockState.chat.messages.length - 1];
        if (lastMessage.role === 'user' && lastMessage.content === query) {
          mockState.chat.messages = mockState.chat.messages.slice(0, -1);
        }
      }
    } finally {
      // Always clear loading state
      mockState.chat.isLoading = false;
    }
  });

  const clearMessages = vi.fn().mockImplementation(() => {
    mockState.chat.messages = [];
    mockState.chat.conversationId = null;
    mockState.chat.error = null;
    mockState.chat.isLoading = false;
  });

  const loadConversation = vi.fn().mockImplementation(async (id: string) => {
    mockState.chat.isLoading = true;
    mockState.chat.error = null;

    try {
      await new Promise((resolve) => setTimeout(resolve, 25));

      // Find conversation in the conversations list
      const conversation = mockState.conversations.conversations.find(
        (c) => c.id === id
      );

      if (conversation) {
        // Load messages from the conversation
        mockState.chat.messages = [...conversation.messages];
        mockState.chat.conversationId = id;
      } else {
        // If conversation not found, create empty state
        mockState.chat.messages = [];
        mockState.chat.conversationId = id;
      }
    } catch (error) {
      mockState.chat.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
    } finally {
      mockState.chat.isLoading = false;
    }
  });

  const retryLastMessage = vi.fn().mockImplementation(async () => {
    // Clear error state before retry
    const previousError = mockState.chat.error;
    mockState.chat.error = null;

    // Find last user message or use a default retry message
    const lastUserMessage = mockState.chat.messages
      .slice()
      .reverse()
      .find((msg) => msg.role === 'user');

    if (lastUserMessage) {
      // If there's still an error set (for testing retry failures), restore it temporarily
      if (previousError && mockState.chat.error === null) {
        // This allows tests to control whether retry succeeds or fails
        const shouldRetryFail = mockState.chat.error !== null;
        if (shouldRetryFail) {
          mockState.chat.error = previousError;
        }
      }

      await sendMessage(lastUserMessage.content);
    }
  });

  const chatMockImpl = {
    get messages() {
      return mockState.chat.messages;
    },
    get isLoading() {
      return mockState.chat.isLoading;
    },
    get error() {
      return mockState.chat.error;
    },
    get conversationId() {
      return mockState.chat.conversationId;
    },
    get isRetryable() {
      return mockState.chat.error?.isRetryable?.() ?? false;
    },
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
  };

  return chatMockImpl;
};

// Fixed useConversations mock with proper loading state transitions
const createFixedUseConversationsMock = () => {
  const loadConversations = vi.fn().mockImplementation(async () => {
    // If conversations are already loaded and not loading, don't reload
    if (
      mockState.conversations.conversations.length > 0 &&
      !mockState.conversations.isLoading
    ) {
      return;
    }

    mockState.conversations.isLoading = true;

    // Only clear error if there's no simulated error
    if (!simulatedErrors.loadConversations) {
      mockState.conversations.error = null;
    }

    try {
      // Check if there's a simulated error for loadConversations
      if (simulatedErrors.loadConversations) {
        throw simulatedErrors.loadConversations;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
      // Keep existing conversations - they're already set in initial state
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      mockState.conversations.error = apiError;
    } finally {
      mockState.conversations.isLoading = false;
    }
  });

  const createConversation = vi.fn().mockImplementation(async () => {
    console.log('createConversation called');
    mockState.conversations.isLoading = true;
    mockState.conversations.error = null;

    try {
      await new Promise((resolve) => setTimeout(resolve, 25));

      const newConversation = createMockConversation({
        id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: 'New Conversation',
        messages: [], // Start with empty messages
      });

      console.log('Created new conversation:', newConversation);

      mockState.conversations.conversations = [
        newConversation,
        ...mockState.conversations.conversations,
      ];

      // Clear current chat when creating new conversation
      mockState.chat.messages = [];
      mockState.chat.conversationId = newConversation.id;

      console.log('Updated state:', {
        conversations: mockState.conversations.conversations,
        conversationId: mockState.chat.conversationId,
      });

      // Force a small delay to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 10));

      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      mockState.conversations.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      throw error;
    } finally {
      mockState.conversations.isLoading = false;
    }
  });

  const deleteConversation = vi.fn().mockImplementation(async (id: string) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockState.conversations.conversations =
        mockState.conversations.conversations.filter((c) => c.id !== id);
    } catch (error) {
      mockState.conversations.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      throw error;
    }
  });

  const updateConversationTitle = vi
    .fn()
    .mockImplementation(async (id: string, title: string) => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockState.conversations.conversations =
          mockState.conversations.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          );
      } catch (error) {
        mockState.conversations.error =
          error instanceof ApiError ? error : new ApiError('Unknown error', 0);
        throw error;
      }
    });

  const retry = vi.fn().mockImplementation(async () => {
    return loadConversations();
  });

  const conversationsMockImpl = {
    get conversations() {
      return mockState.conversations.conversations;
    },
    get isLoading() {
      return mockState.conversations.isLoading;
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

  return conversationsMockImpl;
};

// Mock instances - these need to be properly typed
export const mockUseChat = vi.fn();
export const mockUseConversations = vi.fn();

// Setup function
export const setupFixedLoadingMocks = (
  options: {
    initialMessages?: ChatMessage[];
    initialConversations?: Conversation[];
    initialConversationId?: string;
    simulateErrors?: {
      sendMessage?: ApiError;
      loadConversations?: ApiError;
    };
  } = {}
) => {
  // Initialize state
  initializeState();

  // Apply initial state
  if (options.initialMessages) {
    mockState.chat.messages = options.initialMessages;
  }

  if (options.initialConversations) {
    mockState.conversations.conversations = options.initialConversations;
    // Mark conversations as loaded (not loading)
    mockState.conversations.isLoading = false;
  }

  if (options.initialConversationId) {
    mockState.chat.conversationId = options.initialConversationId;
  }

  // Store simulated errors and set them in state
  if (options.simulateErrors?.sendMessage) {
    simulatedErrors.sendMessage = options.simulateErrors.sendMessage;
    mockState.chat.error = options.simulateErrors.sendMessage;
  }

  if (options.simulateErrors?.loadConversations) {
    simulatedErrors.loadConversations =
      options.simulateErrors.loadConversations;
    mockState.conversations.error = options.simulateErrors.loadConversations;
  }

  // Create mock implementations
  const chatMock = createFixedUseChatMock();
  const conversationsMock = createFixedUseConversationsMock();

  // Set the global mock state so the mocked hooks return the right values
  mockChatState = chatMock;
  mockConversationsState = conversationsMock;

  // Auto-load conversations (simulating useEffect)
  // Use a more reliable way to trigger the initial load
  Promise.resolve().then(() => {
    conversationsMock.loadConversations();
  });

  return {
    chatMock,
    conversationsMock,
    mockState,
    // Helper functions
    waitForLoadingToComplete: async (timeout = 3000) => {
      const start = Date.now();
      while (
        (mockState.chat.isLoading || mockState.conversations.isLoading) &&
        Date.now() - start < timeout
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        // Allow React to process updates
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Additional wait to ensure React has processed all updates
      await new Promise((resolve) => setTimeout(resolve, 20));

      if (mockState.chat.isLoading || mockState.conversations.isLoading) {
        throw new Error(`Loading did not complete within ${timeout}ms`);
      }
    },
    isAnyLoading: () =>
      mockState.chat.isLoading || mockState.conversations.isLoading,
    setError: (hook: 'chat' | 'conversations', error: ApiError | null) => {
      if (hook === 'chat') {
        mockState.chat.error = error;
        // Clear simulated error when manually setting error to null
        if (error === null) {
          simulatedErrors.sendMessage = undefined;
        } else {
          simulatedErrors.sendMessage = error;
        }
      } else {
        mockState.conversations.error = error;
        // Clear simulated error when manually setting error to null
        if (error === null) {
          simulatedErrors.loadConversations = undefined;
        } else {
          simulatedErrors.loadConversations = error;
        }
      }
    },
  };
};

// Cleanup function with proper loading state cleanup
export const cleanupFixedLoadingMocks = () => {
  // Force clear any active loading states before cleanup
  if (mockState) {
    mockState.chat.isLoading = false;
    mockState.conversations.isLoading = false;
  }

  // Clear all mocks and timers
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Reset error simulations
  simulatedErrors = {};

  // Reinitialize state
  initializeState();

  // Clear mock state references
  mockChatState = null;
  mockConversationsState = null;
};

// Create reactive mock implementations using React state
let mockChatState: any = null;
let mockConversationsState: any = null;

// Mock the actual hooks with reactive state
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn((options: unknown = {}) => {
    // Return the current mock state
    return (
      mockChatState || {
        messages: [],
        isLoading: false,
        error: null,
        conversationId: null,
        isRetryable: false,
        sendMessage: vi.fn(),
        clearMessages: vi.fn(),
        loadConversation: vi.fn(),
        retryLastMessage: vi.fn(),
      }
    );
  }),
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(() => {
    // Return the current mock state
    return (
      mockConversationsState || {
        conversations: [],
        isLoading: false,
        error: null,
        isRetryable: false,
        loadConversations: vi.fn(),
        createConversation: vi.fn(),
        deleteConversation: vi.fn(),
        updateConversationTitle: vi.fn(),
        retry: vi.fn(),
      }
    );
  }),
}));

// Initialize on module load
initializeState();
