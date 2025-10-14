/**
 * Optimized Mock Factory
 * Creates high-performance mocks with controlled timing and better reliability
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';
import { testPerformanceManager } from './performance-manager';
import { testIsolationManager } from './isolation-manager';

// Optimized mock configuration
export interface OptimizedMockConfig {
  // Performance settings
  enableFastMode: boolean;
  defaultDelay: number;
  maxDelay: number;

  // Reliability settings
  enableRetries: boolean;
  maxRetries: number;

  // State management
  enableStateTracking: boolean;
  autoCleanup: boolean;

  // Error simulation
  errorRate: number;
  enableErrorRecovery: boolean;
}

export const DEFAULT_MOCK_CONFIG: OptimizedMockConfig = {
  enableFastMode: true,
  defaultDelay: 25, // Reduced from 50ms for better performance
  maxDelay: 100, // Maximum delay for any operation

  enableRetries: true,
  maxRetries: 2,

  enableStateTracking: true,
  autoCleanup: true,

  errorRate: 0, // No random errors by default
  enableErrorRecovery: true,
};

// Optimized state management
interface OptimizedMockState {
  chat: {
    messages: ChatMessage[];
    isLoading: boolean;
    error: ApiError | null;
    conversationId: string | null;
    lastOperation: string | null;
    operationCount: number;
  };
  conversations: {
    conversations: Conversation[];
    isLoading: boolean;
    error: ApiError | null;
    lastOperation: string | null;
    operationCount: number;
  };
}

let mockState: OptimizedMockState;
let mockConfig: OptimizedMockConfig;
let messageIdCounter = 0;
let conversationIdCounter = 0;

// Initialize optimized state
const initializeOptimizedState = (
  config: Partial<OptimizedMockConfig> = {}
) => {
  mockConfig = { ...DEFAULT_MOCK_CONFIG, ...config };

  mockState = {
    chat: {
      messages: [],
      isLoading: false,
      error: null,
      conversationId: null,
      lastOperation: null,
      operationCount: 0,
    },
    conversations: {
      conversations: [],
      isLoading: false,
      error: null,
      lastOperation: null,
      operationCount: 0,
    },
  };

  messageIdCounter = 0;
  conversationIdCounter = 0;
};

// Optimized delay function
const createOptimizedDelay = (baseDelay?: number): Promise<void> => {
  if (!mockConfig.enableFastMode) {
    return Promise.resolve();
  }

  const delay = Math.min(
    baseDelay || mockConfig.defaultDelay,
    mockConfig.maxDelay
  );

  return testPerformanceManager.createDelay(
    delay <= 25 ? 'fast' : delay <= 50 ? 'normal' : 'slow'
  );
};

// Optimized error simulation
const shouldSimulateError = (): boolean => {
  return mockConfig.errorRate > 0 && Math.random() < mockConfig.errorRate;
};

// Optimized data factories
export const createOptimizedChatMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => {
  messageIdCounter++;
  return {
    id: `msg-${messageIdCounter}`,
    content: 'Test message',
    role: 'user',
    timestamp: new Date(),
    conversation_id: 'conv-123',
    ...overrides,
  };
};

export const createOptimizedConversation = (
  overrides: Partial<Conversation> = {}
): Conversation => {
  conversationIdCounter++;
  return {
    id: `conv-${conversationIdCounter}`,
    messages: [],
    created_at: new Date(),
    updated_at: new Date(),
    title: 'Test Conversation',
    metadata: {},
    ...overrides,
  };
};

export const createOptimizedChatResponse = (
  query: string,
  overrides: Partial<ChatResponse> = {}
): ChatResponse => {
  // Generate contextual response based on query
  let answer = `Response to: ${query}`;
  let sources = undefined;

  // Optimize response generation for common test cases
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('viscosity')) {
    answer =
      'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.';
    sources = [
      {
        content: 'ASA 150 viscosity: 150 cP at 25°C, measured using ASTM D445',
        score: 0.95,
        source: 'vector' as const,
        metadata: { doc_id: 'asa-150-spec', section: 'properties', page: 2 },
        provenance: {
          document: 'ASA 150 Technical Bulletin',
          source_file: 'ASA_150_Technical_Bulletin.pdf',
        },
      },
    ];
  } else if (lowerQuery.includes('markdown') || lowerQuery.includes('bold')) {
    answer = 'This is **bold text** and this is normal text.';
  } else if (lowerQuery.includes('code')) {
    answer = 'Use the `ASTM D445` test method for viscosity.';
  } else if (lowerQuery.includes('list')) {
    answer = `Properties of ASA 150:\n1. Viscosity: 150 cP\n2. Temperature: 25°C\n- Used in coatings\n- Chemical resistant`;
  }

  return {
    answer,
    sources,
    conversation_id: mockState.chat.conversationId || 'conv-123',
    query_analysis: {
      query_type: 'specification' as QueryType,
      entities: [],
      intent_confidence: 0.9,
      suggested_strategy: {},
    },
    response_time_ms: mockConfig.defaultDelay,
    kg_enhanced: false,
    ...overrides,
  };
};

// Optimized useChat mock
const createOptimizedUseChatMock = () => {
  const sendMessage = vi.fn().mockImplementation(async (query: string) => {
    if (!query.trim()) return;

    const operationName = 'sendMessage';
    testPerformanceManager.startTimer(operationName);

    try {
      // Update state immediately for better UX
      mockState.chat.isLoading = true;
      mockState.chat.error = null;
      mockState.chat.lastOperation = operationName;
      mockState.chat.operationCount++;

      // Simulate error if configured
      if (shouldSimulateError()) {
        throw new ApiError('Simulated network error', 0);
      }

      // Add user message immediately
      const userMessage = createOptimizedChatMessage({
        content: query,
        role: 'user',
        conversation_id: mockState.chat.conversationId || 'conv-123',
      });

      mockState.chat.messages = [...mockState.chat.messages, userMessage];

      // Optimized delay
      await createOptimizedDelay();

      // Generate response
      const response = createOptimizedChatResponse(query);
      const assistantMessage = createOptimizedChatMessage({
        content: response.answer,
        role: 'assistant',
        conversation_id: response.conversation_id,
        sources: response.sources,
      });

      // Update state
      mockState.chat.messages = [...mockState.chat.messages, assistantMessage];
      mockState.chat.conversationId = response.conversation_id;
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      mockState.chat.error = apiError;

      // Remove user message on error (simulate failed send)
      if (mockState.chat.messages.length > 0) {
        const lastMessage =
          mockState.chat.messages[mockState.chat.messages.length - 1];
        if (lastMessage.role === 'user' && lastMessage.content === query) {
          mockState.chat.messages = mockState.chat.messages.slice(0, -1);
        }
      }
    } finally {
      mockState.chat.isLoading = false;
      testPerformanceManager.endTimer(operationName, false);
    }
  });

  const clearMessages = vi.fn().mockImplementation(() => {
    mockState.chat.messages = [];
    mockState.chat.conversationId = null;
    mockState.chat.error = null;
    mockState.chat.lastOperation = 'clearMessages';
  });

  const loadConversation = vi.fn().mockImplementation(async (id: string) => {
    const operationName = 'loadConversation';
    testPerformanceManager.startTimer(operationName);

    try {
      mockState.chat.isLoading = true;
      mockState.chat.error = null;
      mockState.chat.lastOperation = operationName;

      await createOptimizedDelay();

      // Find conversation
      const conversation = mockState.conversations.conversations.find(
        (c) => c.id === id
      );

      if (conversation) {
        mockState.chat.messages = [...conversation.messages];
        mockState.chat.conversationId = id;
      } else {
        mockState.chat.messages = [];
        mockState.chat.conversationId = id;
      }
    } catch (error) {
      mockState.chat.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
    } finally {
      mockState.chat.isLoading = false;
      testPerformanceManager.endTimer(operationName, false);
    }
  });

  const retryLastMessage = vi.fn().mockImplementation(async () => {
    mockState.chat.error = null;
    const lastUserMessage = mockState.chat.messages
      .slice()
      .reverse()
      .find((msg) => msg.role === 'user');

    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  });

  return {
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
      return mockState.chat.error?.isRetryable() ?? false;
    },
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
  };
};

// Optimized useConversations mock
const createOptimizedUseConversationsMock = () => {
  const loadConversations = vi.fn().mockImplementation(async () => {
    if (
      mockState.conversations.conversations.length > 0 &&
      !mockState.conversations.isLoading
    ) {
      return; // Already loaded
    }

    const operationName = 'loadConversations';
    testPerformanceManager.startTimer(operationName);

    try {
      mockState.conversations.isLoading = true;
      mockState.conversations.error = null;
      mockState.conversations.lastOperation = operationName;

      await createOptimizedDelay();
      // Keep existing conversations
    } catch (error) {
      mockState.conversations.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
    } finally {
      mockState.conversations.isLoading = false;
      testPerformanceManager.endTimer(operationName, false);
    }
  });

  const createConversation = vi.fn().mockImplementation(async () => {
    const operationName = 'createConversation';
    testPerformanceManager.startTimer(operationName);

    try {
      mockState.conversations.isLoading = true;
      mockState.conversations.error = null;
      mockState.conversations.lastOperation = operationName;

      await createOptimizedDelay();

      const newConversation = createOptimizedConversation({
        title: 'New Conversation',
        messages: [],
      });

      mockState.conversations.conversations = [
        newConversation,
        ...mockState.conversations.conversations,
      ];

      // Clear current chat
      mockState.chat.messages = [];
      mockState.chat.conversationId = newConversation.id;

      return newConversation;
    } catch (error) {
      mockState.conversations.error =
        error instanceof ApiError ? error : new ApiError('Unknown error', 0);
      throw error;
    } finally {
      mockState.conversations.isLoading = false;
      testPerformanceManager.endTimer(operationName, false);
    }
  });

  const deleteConversation = vi.fn().mockImplementation(async (id: string) => {
    await createOptimizedDelay(10); // Very fast operation
    mockState.conversations.conversations =
      mockState.conversations.conversations.filter((c) => c.id !== id);
  });

  const updateConversationTitle = vi
    .fn()
    .mockImplementation(async (id: string, title: string) => {
      await createOptimizedDelay(10); // Very fast operation
      mockState.conversations.conversations =
        mockState.conversations.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
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
};

// Mock instances
export const optimizedMockUseChat = vi.fn();
export const optimizedMockUseConversations = vi.fn();

// Main setup function
export const setupOptimizedMocks = (
  options: {
    config?: Partial<OptimizedMockConfig>;
    initialMessages?: ChatMessage[];
    initialConversations?: Conversation[];
    initialConversationId?: string;
    simulateErrors?: {
      sendMessage?: ApiError;
      loadConversations?: ApiError;
    };
  } = {}
) => {
  // Initialize with config
  initializeOptimizedState(options.config);

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

  // Handle error simulation
  if (options.simulateErrors?.sendMessage) {
    mockState.chat.error = options.simulateErrors.sendMessage;
  }

  if (options.simulateErrors?.loadConversations) {
    mockState.conversations.error = options.simulateErrors.loadConversations;
  }

  // Create optimized mock implementations
  const chatMock = createOptimizedUseChatMock();
  const conversationsMock = createOptimizedUseConversationsMock();

  // Register mocks for cleanup
  if (mockConfig.autoCleanup) {
    testIsolationManager.registerMock(optimizedMockUseChat);
    testIsolationManager.registerMock(optimizedMockUseConversations);
  }

  // Configure mock returns
  optimizedMockUseChat.mockReturnValue(chatMock);
  optimizedMockUseConversations.mockReturnValue(conversationsMock);

  // Auto-load conversations
  Promise.resolve().then(() => {
    conversationsMock.loadConversations();
  });

  return {
    chatMock,
    conversationsMock,
    mockState,

    // Optimized helper functions
    waitForLoadingToComplete: async (timeout = 3000) => {
      return testPerformanceManager.waitFor(
        () => !mockState.chat.isLoading && !mockState.conversations.isLoading,
        { timeout, operationName: 'waitForLoadingToComplete' }
      );
    },

    isAnyLoading: () =>
      mockState.chat.isLoading || mockState.conversations.isLoading,

    setError: (hook: 'chat' | 'conversations', error: ApiError | null) => {
      if (hook === 'chat') {
        mockState.chat.error = error;
      } else {
        mockState.conversations.error = error;
      }
    },

    getPerformanceStats: () => ({
      chatOperations: mockState.chat.operationCount,
      conversationsOperations: mockState.conversations.operationCount,
      lastChatOperation: mockState.chat.lastOperation,
      lastConversationsOperation: mockState.conversations.lastOperation,
      performanceStats: testPerformanceManager.getStats(),
    }),

    resetPerformanceStats: () => {
      mockState.chat.operationCount = 0;
      mockState.conversations.operationCount = 0;
      testPerformanceManager.reset();
    },
  };
};

// Cleanup function
export const cleanupOptimizedMocks = () => {
  vi.clearAllMocks();
  testPerformanceManager.reset();
  initializeOptimizedState();
};

// Mock the actual hooks
vi.mock('@/hooks/useChat', () => ({
  useChat: optimizedMockUseChat,
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: optimizedMockUseConversations,
}));

// Initialize on module load
initializeOptimizedState();
