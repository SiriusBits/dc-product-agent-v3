/**
 * Enhanced test utilities for direct hook mocking strategy
 * Provides React Testing Library utilities with enhanced hook mocking support
 */

import React from 'react';
import type { ReactElement } from 'react';
import { render as rtlRender } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type {
  ChatMessage,
  Conversation,
  ChatResponse,
  QueryType,
  ProductSummary,
  BaseExtractionDocument,
} from '@repo/shared-types';
import { ApiError } from '@/lib/api-client';

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Test data factories with enhanced options
export const createMockChatMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content: 'What is the viscosity of ASA 150?',
  role: 'user',
  timestamp: new Date(),
  conversation_id: 'conv-123',
  sources: undefined,
  ...overrides,
});

export const createMockAssistantMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content:
    'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
  role: 'assistant',
  timestamp: new Date(),
  conversation_id: 'conv-123',
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
  ...overrides,
});

export const createMockConversation = (
  overrides: Partial<Conversation> = {}
): Conversation => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  messages: [],
  created_at: new Date('2024-01-01T09:00:00Z'),
  updated_at: new Date('2024-01-01T10:00:00Z'),
  title: 'Test Conversation',
  metadata: {},
  ...overrides,
});

export const createMockChatResponse = (
  overrides: Partial<ChatResponse> = {}
): ChatResponse => ({
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
    {
      content: 'ASA 150 is commonly used in coatings applications',
      score: 0.87,
      source: 'kg',
      metadata: {
        entity_type: 'CHEMICAL',
        relationship: 'used_in',
      },
      provenance: {
        document: 'ASA Product Applications',
        confidence: 0.9,
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
  ...overrides,
});

export const createMockProduct = (
  overrides: Partial<ProductSummary> = {}
): ProductSummary => ({
  id: 'asa-150',
  name: 'ASA 150',
  short_name: 'ASA150',
  family: 'ASA',
  cas_number: '12345-67-8',
  applications: ['Coatings', 'Adhesives'],
  key_properties: ['Viscosity: 150 cP', 'High adhesion'],
  document_count: 1,
  ...overrides,
});

export const createMockProductDetail = (
  overrides: Partial<BaseExtractionDocument> = {}
): BaseExtractionDocument => ({
  id: 'asa-150',
  name: 'ASA 150',
  short_name: 'ASA150',
  family: 'ASA',
  cas_number: '12345-67-8',
  applications: ['Coatings', 'Adhesives'],
  key_properties: ['Viscosity: 150 cP', 'High adhesion'],
  document_count: 1,
  product_info: {
    product_name: 'ASA 150',
    product_short_name: 'ASA150',
    product_family: 'ASA',
    cas_number: '12345-67-8',
    chemical_name: 'Alkenyl Succinic Anhydride 150',
    synonyms: ['ASA-150'],
  },
  properties: [
    {
      category: 'Physical',
      name: 'Viscosity',
      value_string: '150 cP',
      value_numeric: 150,
      value_min: null,
      value_max: null,
      unit: 'cP',
      test_method: 'ASTM D445',
      page: 1,
    },
  ],
  related_products: [],
  knowledge_graph_entities: [],
  documents: [
    {
      doc_id: 'asa-150-spec',
      filename: 'ASA 150 Technical Bulletin.pdf',
      document_type: 'Technical Bulletin',
      manufacturer: 'Dixie Chemical',
      extraction_date: '2024-01-01',
      page_count: 4,
      has_images: true,
    },
  ],
  ...overrides,
});

// Enhanced ApiError for testing
export class MockApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
    requestId?: string
  ) {
    super(message, status, details, requestId);
  }

  static networkError(): MockApiError {
    return new MockApiError(
      'Network error: Please check your connection and try again.',
      0,
      { originalError: 'Network failure' }
    );
  }

  static serverError(): MockApiError {
    return new MockApiError(
      'Server error: Internal server error occurred.',
      500,
      { originalError: 'Internal server error' }
    );
  }

  static timeoutError(): MockApiError {
    return new MockApiError(
      'Request timeout: The server is taking too long to respond.',
      408
    );
  }

  static validationError(): MockApiError {
    return new MockApiError('Validation error: Invalid input provided.', 400, {
      field: 'query',
      message: 'Query cannot be empty',
    });
  }
}

// Test wrapper component
interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => {
  return <>{children}</>;
};

// Enhanced render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => rtlRender(ui, { wrapper: TestWrapper, ...options });

export { customRender as render };

// Utility functions for common test operations
export const waitForLoadingToFinish = async (timeout = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Allow React to process updates
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

export const waitForAsyncOperations = async (timeout = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Allow React to process updates
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

export const simulateNetworkDelay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Enhanced waiting utilities with better error messages
export const waitForElement = async (
  getElement: () => HTMLElement | null,
  timeout = 3000,
  errorMessage = 'Element not found within timeout'
): Promise<HTMLElement> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const element = getElement();
    if (element) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`${errorMessage} (waited ${timeout}ms)`);
};

export const waitForElementToDisappear = async (
  getElement: () => HTMLElement | null,
  timeout = 3000,
  errorMessage = 'Element did not disappear within timeout'
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const element = getElement();
    if (!element) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`${errorMessage} (waited ${timeout}ms)`);
};

// Test scenario builders
export const createChatScenario = (
  options: {
    userMessage?: string;
    assistantResponse?: string;
    sources?: ChatResponse['sources'];
    conversationId?: string;
    hasError?: boolean;
    errorType?: 'network' | 'server' | 'timeout' | 'validation';
  } = {}
) => {
  const userMessage = createMockChatMessage({
    content: options.userMessage || 'What is the viscosity of ASA 150?',
    conversation_id: options.conversationId || 'conv-123',
  });

  const assistantMessage = createMockAssistantMessage({
    content:
      options.assistantResponse || 'ASA 150 has a viscosity of 150 cP at 25°C.',
    sources: options.sources,
    conversation_id: options.conversationId || 'conv-123',
  });

  const chatResponse = createMockChatResponse({
    answer: assistantMessage.content,
    sources: options.sources,
    conversation_id: options.conversationId || 'conv-123',
  });

  let error: MockApiError | null = null;
  if (options.hasError) {
    switch (options.errorType) {
      case 'network':
        error = MockApiError.networkError();
        break;
      case 'server':
        error = MockApiError.serverError();
        break;
      case 'timeout':
        error = MockApiError.timeoutError();
        break;
      case 'validation':
        error = MockApiError.validationError();
        break;
      default:
        error = MockApiError.networkError();
    }
  }

  return {
    userMessage,
    assistantMessage,
    chatResponse,
    error,
    messages: error ? [userMessage] : [userMessage, assistantMessage],
  };
};

export const createConversationScenario = (
  options: {
    conversationCount?: number;
    withMessages?: boolean;
    hasError?: boolean;
    errorType?: 'network' | 'server' | 'timeout';
  } = {}
) => {
  const conversations: Conversation[] = [];

  for (let i = 0; i < (options.conversationCount || 1); i++) {
    const messages = options.withMessages
      ? [
          createMockChatMessage({ conversation_id: `conv-${i}` }),
          createMockAssistantMessage({ conversation_id: `conv-${i}` }),
        ]
      : [];

    conversations.push(
      createMockConversation({
        id: `conv-${i}`,
        title: `Conversation ${i + 1}`,
        messages,
      })
    );
  }

  let error: MockApiError | null = null;
  if (options.hasError) {
    switch (options.errorType) {
      case 'network':
        error = MockApiError.networkError();
        break;
      case 'server':
        error = MockApiError.serverError();
        break;
      case 'timeout':
        error = MockApiError.timeoutError();
        break;
      default:
        error = MockApiError.networkError();
    }
  }

  return {
    conversations: error ? [] : conversations,
    error,
  };
};

// Debug utilities for tests
export const debugTestState = (state: any, label = 'Test State') => {
  console.log(`[DEBUG] ${label}:`, JSON.stringify(state, null, 2));
};

export const debugElement = (
  element: HTMLElement | null,
  label = 'Element'
) => {
  if (element) {
    console.log(`[DEBUG] ${label}:`, element.outerHTML);
  } else {
    console.log(`[DEBUG] ${label}: null`);
  }
};

// Performance measurement utilities
export const measureTestPerformance = async <T,>(
  testFn: () => Promise<T>,
  label = 'Test'
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await testFn();
  const duration = performance.now() - start;

  console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);

  return { result, duration };
};
