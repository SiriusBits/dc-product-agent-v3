/**
 * Enhanced test setup with direct hook mocking strategy
 * This replaces API client mocking with direct hook mocking for better test control
 */

import React from 'react';
import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  mockUseChat,
  mockUseConversations,
  setupHookMocks,
  cleanupHookMocks,
  mockHookControls,
  getMockHookState,
  type MockHookControls,
} from './enhanced-hook-mocks';

// Mock the actual hooks directly
vi.mock('@/hooks/useChat', () => ({
  useChat: mockUseChat,
}));

vi.mock('@/hooks/useConversations', () => ({
  useConversations: mockUseConversations,
}));

// Mock other dependencies that might interfere with tests
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
  Routes: ({ children }: { children: React.ReactNode }) => children,
  Route: ({ children }: { children: React.ReactNode }) => children,
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: any;
  }) => React.createElement('a', { href: to, ...props }, children),
  NavLink: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => React.createElement('a', { href: to, ...props }, children),
}));

// Mock clipboard API
const mockClipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const readText = vi.fn().mockResolvedValue('');

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    writable: true,
    configurable: true,
  });

  return { writeText, readText };
};

// Mock scrollIntoView
const mockScrollIntoView = () => {
  Element.prototype.scrollIntoView = vi.fn();
};

// Mock localStorage
const mockLocalStorage = () => {
  const storage = new Map<string, string>();

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  return window.localStorage;
};

// Mock sessionStorage
const mockSessionStorage = () => {
  const storage = new Map<string, string>();

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  return window.sessionStorage;
};

// Enhanced test setup options
export interface EnhancedTestSetupOptions {
  // Hook-specific options
  initialMessages?: Parameters<typeof setupHookMocks>[0]['initialMessages'];
  initialConversations?: Parameters<
    typeof setupHookMocks
  >[0]['initialConversations'];
  initialConversationId?: Parameters<
    typeof setupHookMocks
  >[0]['initialConversationId'];

  // Timing control options
  loadingDelays?: Record<string, number>;
  asyncDelays?: Record<string, number>;

  // Mock behavior options
  enableControlledPromises?: boolean;
  simulateSlowNetwork?: boolean;
  networkDelayMs?: number;

  // Storage options
  initialLocalStorage?: Record<string, string>;
  initialSessionStorage?: Record<string, string>;
}

// Global test setup state
let testSetupState: {
  clipboard: ReturnType<typeof mockClipboard>;
  localStorage: Storage;
  sessionStorage: Storage;
  hookControls: MockHookControls;
} | null = null;

// Enhanced setup function
export const setupEnhancedTest = (options: EnhancedTestSetupOptions = {}) => {
  // Setup mocks
  const clipboard = mockClipboard();
  mockScrollIntoView();
  const localStorage = mockLocalStorage();
  const sessionStorage = mockSessionStorage();

  // Setup initial storage data
  if (options.initialLocalStorage) {
    Object.entries(options.initialLocalStorage).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }

  if (options.initialSessionStorage) {
    Object.entries(options.initialSessionStorage).forEach(([key, value]) => {
      sessionStorage.setItem(key, value);
    });
  }

  // Setup hook mocks with options
  const { mockHookControls: hookControls } = setupHookMocks({
    initialMessages: options.initialMessages,
    initialConversations: options.initialConversations,
    initialConversationId: options.initialConversationId,
    loadingDelays: options.loadingDelays,
    asyncDelays: options.asyncDelays,
  });

  // Apply network simulation if requested
  if (options.simulateSlowNetwork && options.networkDelayMs) {
    hookControls.setAsyncDelay(
      'useChat',
      'sendMessage',
      options.networkDelayMs
    );
    hookControls.setAsyncDelay(
      'useConversations',
      'loadConversations',
      options.networkDelayMs
    );
    hookControls.setAsyncDelay(
      'useConversations',
      'createConversation',
      options.networkDelayMs
    );
  }

  // Store setup state for cleanup
  testSetupState = {
    clipboard,
    localStorage,
    sessionStorage,
    hookControls,
  };

  return {
    // Mock controls
    hookControls,
    clipboard,
    localStorage,
    sessionStorage,

    // State accessors
    getMockState: getMockHookState,

    // Utility functions
    simulateNetworkDelay: hookControls.simulateNetworkDelay,
    createControlledPromise: hookControls.createControlledPromise,

    // Quick setup helpers
    setMessages: hookControls.setMessages,
    setConversations: hookControls.setConversations,
    setLoading: hookControls.setLoading,
    setError: hookControls.setError,
    simulateSuccess: hookControls.simulateSuccess,
    simulateError: hookControls.simulateError,
  };
};

// Enhanced cleanup function
export const cleanupEnhancedTest = () => {
  // Cleanup React Testing Library
  cleanup();

  // Cleanup hook mocks
  cleanupHookMocks();

  // Clear storage
  if (testSetupState) {
    testSetupState.localStorage.clear();
    testSetupState.sessionStorage.clear();
  }

  // Clear all mocks
  vi.clearAllMocks();

  // Reset setup state
  testSetupState = null;
};

// Auto-setup for tests (can be imported to automatically setup/cleanup)
export const useEnhancedTestSetup = (
  options: EnhancedTestSetupOptions = {}
) => {
  let setupResult: ReturnType<typeof setupEnhancedTest>;

  beforeEach(() => {
    setupResult = setupEnhancedTest(options);
  });

  afterEach(() => {
    cleanupEnhancedTest();
  });

  return () => setupResult;
};

// Utility functions for common test scenarios
export const createChatFlowTestSetup = () => {
  return setupEnhancedTest({
    initialConversations: [],
    loadingDelays: {
      useConversations: 100, // Small delay to simulate loading
    },
    asyncDelays: {
      'useChat.sendMessage': 200,
      'useConversations.createConversation': 150,
    },
  });
};

export const createErrorTestSetup = () => {
  return setupEnhancedTest({
    initialConversations: [],
    // No delays for error tests to make them faster
  });
};

export const createSlowNetworkTestSetup = () => {
  return setupEnhancedTest({
    simulateSlowNetwork: true,
    networkDelayMs: 1000,
    initialConversations: [],
  });
};

export const createPerformanceTestSetup = () => {
  return setupEnhancedTest({
    // Minimal delays for performance testing
    loadingDelays: {
      useConversations: 10,
    },
    asyncDelays: {
      'useChat.sendMessage': 50,
      'useConversations.createConversation': 30,
    },
  });
};
