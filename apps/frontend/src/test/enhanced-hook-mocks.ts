/**
 * Enhanced hook mocks for direct hook mocking strategy
 * This replaces API client mocking with direct hook mocking for better test control
 */

import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';

// Mock hook return types
export interface MockUseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ApiError | null;
  conversationId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
  clearMessages: ReturnType<typeof vi.fn>;
  loadConversation: ReturnType<typeof vi.fn>;
  retryLastMessage: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

export interface MockUseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  deleteConversation: ReturnType<typeof vi.fn>;
  updateConversationTitle: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  isRetryable: boolean;
}

// Controllable mock state
export interface MockHookState {
  useChat: MockUseChatReturn;
  useConversations: MockUseConversationsReturn;
}

// Mock control interface for timing and behavior
export interface MockHookControls {
  // Timing controls
  setLoadingDelay: (
    hook: 'useChat' | 'useConversations',
    delay: number
  ) => void;
  setAsyncDelay: (
    hook: 'useChat' | 'useConversations',
    method: string,
    delay: number
  ) => void;

  // State controls
  setMessages: (messages: ChatMessage[]) => void;
  setConversations: (conversations: Conversation[]) => void;
  setLoading: (hook: 'useChat' | 'useConversations', loading: boolean) => void;
  setError: (
    hook: 'useChat' | 'useConversations',
    error: ApiError | null
  ) => void;

  // Behavior controls
  simulateSuccess: (
    hook: 'useChat' | 'useConversations',
    method: string,
    result?: any
  ) => void;
  simulateError: (
    hook: 'useChat' | 'useConversations',
    method: string,
    error: ApiError
  ) => void;
  simulateNetworkDelay: (ms: number) => Promise<void>;

  // Promise controls for manual resolution
  createControlledPromise: <T>(
    hook: 'useChat' | 'useConversations',
    method: string
  ) => {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  };

  // Reset controls
  resetMocks: () => void;
  resetState: () => void;
}

// Default mock data
export const createMockChatMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `msg-${Date.now()}`,
  content: 'Test message',
  role: 'user',
  timestamp: new Date(),
  conversation_id: 'conv-123',
  ...overrides,
});

export const createMockConversation = (
  overrides: Partial<Conversation> = {}
): Conversation => ({
  id: 'conv-123',
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

// Global mock state
let mockState: MockHookState;
let mockControls: MockHookControls;

// Timing control maps
const loadingDelays = new Map<string, number>();
const asyncDelays = new Map<string, number>();

// Promise control storage
const controlledPromises = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }
>();

// Initialize mock state
const initializeMockState = (): MockHookState => ({
  useChat: {
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    loadConversation: vi.fn(),
    retryLastMessage: vi.fn(),
    isRetryable: false,
  },
  useConversations: {
    conversations: [],
    isLoading: false,
    error: null,
    loadConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    retry: vi.fn(),
    isRetryable: false,
  },
});

// Create mock controls
const createMockControls = (): MockHookControls => ({
  setLoadingDelay: (hook, delay) => {
    loadingDelays.set(hook, delay);
  },

  setAsyncDelay: (hook, method, delay) => {
    asyncDelays.set(`${hook}.${method}`, delay);
  },

  setMessages: (messages) => {
    mockState.useChat.messages = messages;
  },

  setConversations: (conversations) => {
    mockState.useConversations.conversations = conversations;
  },

  setLoading: (hook, loading) => {
    mockState[hook].isLoading = loading;
  },

  setError: (hook, error) => {
    mockState[hook].error = error;
    mockState[hook].isRetryable = error?.isRetryable() ?? false;
  },

  simulateSuccess: (hook, method, result) => {
    const mockFn = (mockState[hook] as any)[method];
    if (mockFn && typeof mockFn.mockResolvedValue === 'function') {
      mockFn.mockResolvedValue(result);
    }
  },

  simulateError: (hook, method, error) => {
    const mockFn = (mockState[hook] as any)[method];
    if (mockFn && typeof mockFn.mockRejectedValue === 'function') {
      mockFn.mockRejectedValue(error);
    }
  },

  simulateNetworkDelay: async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  },

  createControlledPromise: <T>(
    hook: 'useChat' | 'useConversations',
    method: string
  ) => {
    let resolvePromise: (value: T) => void;
    let rejectPromise: (error: Error) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const key = `${hook}.${method}`;
    controlledPromises.set(key, {
      resolve: resolvePromise!,
      reject: rejectPromise!,
    });

    // Set the mock to return this controlled promise
    const mockFn = (mockState[hook] as any)[method];
    if (mockFn && typeof mockFn.mockReturnValue === 'function') {
      mockFn.mockReturnValue(promise);
    }

    return {
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
    };
  },

  resetMocks: () => {
    // Reset all mock functions
    Object.values(mockState.useChat).forEach((value) => {
      if (typeof value === 'function' && 'mockReset' in value) {
        value.mockReset();
      }
    });

    Object.values(mockState.useConversations).forEach((value) => {
      if (typeof value === 'function' && 'mockReset' in value) {
        value.mockReset();
      }
    });

    // Clear timing controls
    loadingDelays.clear();
    asyncDelays.clear();
    controlledPromises.clear();
  },

  resetState: () => {
    mockState = initializeMockState();
  },
});

// Initialize
mockState = initializeMockState();
mockControls = createMockControls();

// Enhanced mock implementations with timing control
const createTimingAwareMock = (
  hook: string,
  method: string,
  defaultImpl: () => any
) => {
  return vi.fn().mockImplementation(async (...args: any[]) => {
    // Apply loading delay if configured
    const loadingDelay = loadingDelays.get(hook);
    if (loadingDelay && loadingDelay > 0) {
      mockState[hook as keyof MockHookState].isLoading = true;
      await new Promise((resolve) => setTimeout(resolve, loadingDelay));
      mockState[hook as keyof MockHookState].isLoading = false;
    }

    // Apply method-specific delay if configured
    const asyncDelay = asyncDelays.get(`${hook}.${method}`);
    if (asyncDelay && asyncDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, asyncDelay));
    }

    // Check if there's a controlled promise for this method
    const controlledPromise = controlledPromises.get(`${hook}.${method}`);
    if (controlledPromise) {
      // Return a promise that will be resolved/rejected manually
      return new Promise((resolve, reject) => {
        controlledPromises.set(`${hook}.${method}`, {
          resolve,
          reject,
        });
      });
    }

    return defaultImpl();
  });
};

// Enhanced useChat mock with timing control
const createUseChatMock = (): MockUseChatReturn => ({
  ...mockState.useChat,
  sendMessage: createTimingAwareMock('useChat', 'sendMessage', () => {
    // Default implementation: add user message and mock response
    const userMessage = createMockChatMessage({
      content: 'Test query',
      role: 'user',
    });
    const assistantMessage = createMockChatMessage({
      content: 'Test response',
      role: 'assistant',
    });

    mockState.useChat.messages = [
      ...mockState.useChat.messages,
      userMessage,
      assistantMessage,
    ];
    mockState.useChat.conversationId = 'conv-123';

    return Promise.resolve();
  }),

  clearMessages: createTimingAwareMock('useChat', 'clearMessages', () => {
    mockState.useChat.messages = [];
    mockState.useChat.conversationId = null;
    mockState.useChat.error = null;
    return Promise.resolve();
  }),

  loadConversation: createTimingAwareMock(
    'useChat',
    'loadConversation',
    (id: string) => {
      const conversation = createMockConversation({ id });
      mockState.useChat.messages = conversation.messages;
      mockState.useChat.conversationId = id;
      return Promise.resolve();
    }
  ),

  retryLastMessage: createTimingAwareMock('useChat', 'retryLastMessage', () => {
    // Simulate retry by clearing error and sending last message again
    mockState.useChat.error = null;
    return Promise.resolve();
  }),
});

// Enhanced useConversations mock with timing control
const createUseConversationsMock = (): MockUseConversationsReturn => ({
  ...mockState.useConversations,
  loadConversations: createTimingAwareMock(
    'useConversations',
    'loadConversations',
    () => {
      // Default implementation: return mock conversations
      mockState.useConversations.conversations = [createMockConversation()];
      return Promise.resolve();
    }
  ),

  createConversation: createTimingAwareMock(
    'useConversations',
    'createConversation',
    () => {
      const newConversation = createMockConversation({
        id: `conv-${Date.now()}`,
        title: 'New Conversation',
      });
      mockState.useConversations.conversations = [
        newConversation,
        ...mockState.useConversations.conversations,
      ];
      return Promise.resolve(newConversation);
    }
  ),

  deleteConversation: createTimingAwareMock(
    'useConversations',
    'deleteConversation',
    (id: string) => {
      mockState.useConversations.conversations =
        mockState.useConversations.conversations.filter(
          (conv) => conv.id !== id
        );
      return Promise.resolve();
    }
  ),

  updateConversationTitle: createTimingAwareMock(
    'useConversations',
    'updateConversationTitle',
    (id: string, title: string) => {
      mockState.useConversations.conversations =
        mockState.useConversations.conversations.map((conv) =>
          conv.id === id ? { ...conv, title } : conv
        );
      return Promise.resolve();
    }
  ),

  retry: createTimingAwareMock('useConversations', 'retry', () => {
    // Simulate retry by clearing error and reloading
    mockState.useConversations.error = null;
    return Promise.resolve();
  }),
});

// Export the mock implementations
export const mockUseChat = vi.fn(() => createUseChatMock());
export const mockUseConversations = vi.fn(() => createUseConversationsMock());

// Export controls for test manipulation
export const mockHookControls = mockControls;

// Export state for test assertions
export const getMockHookState = () => mockState;

// Setup function for tests
export const setupHookMocks = (
  options: {
    initialMessages?: ChatMessage[];
    initialConversations?: Conversation[];
    initialConversationId?: string;
    loadingDelays?: Record<string, number>;
    asyncDelays?: Record<string, number>;
  } = {}
) => {
  // Reset state
  mockControls.resetState();
  mockControls.resetMocks();

  // Apply initial state
  if (options.initialMessages) {
    mockControls.setMessages(options.initialMessages);
  }

  if (options.initialConversations) {
    mockControls.setConversations(options.initialConversations);
  }

  if (options.initialConversationId) {
    mockState.useChat.conversationId = options.initialConversationId;
  }

  // Apply timing configurations
  if (options.loadingDelays) {
    Object.entries(options.loadingDelays).forEach(([hook, delay]) => {
      mockControls.setLoadingDelay(
        hook as 'useChat' | 'useConversations',
        delay
      );
    });
  }

  if (options.asyncDelays) {
    Object.entries(options.asyncDelays).forEach(([key, delay]) => {
      const [hook, method] = key.split('.');
      mockControls.setAsyncDelay(
        hook as 'useChat' | 'useConversations',
        method,
        delay
      );
    });
  }

  return {
    mockHookControls: mockControls,
    getMockHookState: () => mockState,
  };
};

// Cleanup function for tests
export const cleanupHookMocks = () => {
  mockControls.resetMocks();
  mockControls.resetState();
};
