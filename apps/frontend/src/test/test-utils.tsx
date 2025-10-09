/**
 * Test utilities for frontend testing
 */

import React from 'react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type { QueryType } from '@repo/shared-types';

// Mock React Router
export const mockNavigate = vi.fn();
export const mockLocation = { pathname: '/', search: '' };
export const mockSetSearchParams = vi.fn();

// Create a more comprehensive mock for react-router-dom
const mockReactRouterDom = {
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  BrowserRouter: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  NavLink: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
};

vi.mock('react-router-dom', () => mockReactRouterDom);

// Mock API client with default implementations
export const mockApiClient = {
  // Chat endpoints
  sendMessage: vi.fn(),
  chat: vi.fn(), // Alias for sendMessage for test compatibility
  getConversation: vi.fn(),
  listConversations: vi.fn().mockResolvedValue([]),
  getConversations: vi.fn().mockResolvedValue([]), // Alias for listConversations
  createConversation: vi.fn(),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  getConversationMessages: vi.fn().mockResolvedValue([]),

  // Product endpoints
  searchProducts: vi.fn(),
  getProducts: vi.fn(), // Alias for searchProducts for test compatibility
  getProduct: vi.fn(),
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  compareProducts: vi.fn().mockResolvedValue({}),
  getProductFamilies: vi.fn().mockResolvedValue(['ASA', 'DCA', 'ECA']),
  getProductApplications: vi.fn().mockResolvedValue(['Coatings', 'Adhesives']),
  getApplications: vi.fn().mockResolvedValue(['Coatings', 'Adhesives']), // Alias for getProductApplications
  getProductProperties: vi.fn().mockResolvedValue([]),
  getProductStatistics: vi.fn().mockResolvedValue({
    totalProducts: 100,
    totalFamilies: 10,
    totalApplications: 20,
  }),

  // Knowledge Graph endpoints
  queryKnowledgeGraph: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
    query: '',
  }),
  getEntityNeighbors: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
    query: '',
  }),

  // System health endpoints
  getSystemStatus: vi.fn().mockResolvedValue({
    status: 'healthy',
    services: {
      database: 'healthy',
      vectorStore: 'healthy',
      knowledgeGraph: 'healthy',
    },
    timestamp: new Date().toISOString(),
  }),
  checkHealth: vi.fn().mockResolvedValue(true),
};

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
  ApiError: MockApiError,
}));

// Custom render function
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock ApiError class
export class MockApiError extends Error {
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
    const errorObj = errorData as
      | { message?: string; details?: unknown; request_id?: string }
      | undefined;
    return new MockApiError(
      errorObj?.message || `HTTP ${response.status}: ${response.statusText}`,
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
    return this.isNetworkError() || this.isServerError() || this.status === 408;
  }
}

// Test data factories
export const createMockProduct = (overrides = {}) => ({
  id: 'asa-150',
  name: 'ASA 150',
  shortName: 'ASA150',
  family: 'ASA',
  casNumber: '12345-67-8',
  chemicalName: 'Alkenyl Succinic Anhydride 150',
  synonyms: ['ASA-150'],
  properties: [
    {
      category: 'Physical',
      name: 'Viscosity',
      valueString: '150 cP',
      valueNumeric: 150,
      unit: 'cP',
      testMethod: 'ASTM D445',
    },
  ],
  applications: ['Coatings', 'Adhesives'],
  keyBenefits: ['High viscosity', 'Good adhesion'],
  ...overrides,
});

export const createMockProductDetail = (overrides = {}) => ({
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

export const createMockChatMessage = (overrides = {}) => ({
  id: '1',
  content: 'What is the viscosity of ASA 150?',
  role: 'user' as const,
  timestamp: new Date('2024-01-01T10:00:00Z'),
  conversation_id: 'conv-123',
  sources: undefined,
  ...overrides,
});

export const createMockConversation = (overrides = {}) => ({
  id: 'conv-123',
  messages: [createMockChatMessage()],
  created_at: new Date('2024-01-01T09:00:00Z'),
  updated_at: new Date('2024-01-01T10:00:00Z'),
  title: 'Test Conversation',
  metadata: {},
  ...overrides,
});

export const createMockSearchResult = (overrides = {}) => ({
  content: 'ASA 150 has a viscosity of 150 cP',
  score: 0.95,
  source: 'vector' as const,
  metadata: { doc_id: 'asa-150-spec' },
  provenance: { document: 'ASA 150 Technical Bulletin' },
  ...overrides,
});

export const createMockChatResponse = (overrides = {}) => ({
  answer: 'ASA 150 has a viscosity of 150 cP at 25°C.',
  sources: [createMockSearchResult()],
  conversation_id: 'conv-123',
  query_analysis: {
    query_type: 'specification' as QueryType,
    entities: ['ASA 150'],
    intent_confidence: 0.9,
    suggested_strategy: { vector_weight: 0.7, kg_weight: 0.3 },
  },
  response_time_ms: 250,
  kg_enhanced: true,
  ...overrides,
});

// Mock hooks
export const createMockUseChat = (overrides = {}) => ({
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
  currentConversationId: null,
  retryMessage: vi.fn(),
  loadConversation: vi.fn(),
  ...overrides,
});

export const createMockUseProducts = (overrides = {}) => ({
  products: [createMockProduct()],
  isLoading: false,
  error: null,
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  families: ['ASA', 'DCA', 'ECA'],
  applications: ['Coatings', 'Adhesives', 'Epoxy Curing'],
  totalCount: 1,
  ...overrides,
});

export const createMockUseConversations = (overrides = {}) => ({
  conversations: [
    {
      id: 'conv-123',
      title: 'ASA 150 Questions',
      lastMessage: 'ASA 150 has a viscosity of 150 cP at 25°C.',
      timestamp: new Date('2024-01-01T10:00:01Z'),
      messageCount: 2,
    },
  ],
  isLoading: false,
  error: null,
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  loadConversation: vi.fn(),
  ...overrides,
});

// Utility functions
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

// Create clipboard mock functions that can be spied on
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
const clipboardReadText = vi.fn().mockResolvedValue('');

export const mockClipboard = () => {
  // Reset the mocks
  clipboardWriteText.mockClear();
  clipboardReadText.mockClear();

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: clipboardWriteText,
      readText: clipboardReadText,
    },
    writable: true,
    configurable: true,
  });
};

export const mockScrollIntoView = () => {
  Element.prototype.scrollIntoView = vi.fn();
};

// Setup function for common test setup
export const setupTest = () => {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset mock implementations and set default values
  mockApiClient.sendMessage.mockResolvedValue(createMockChatResponse());
  mockApiClient.chat.mockResolvedValue(createMockChatResponse());
  mockApiClient.getConversation.mockResolvedValue(createMockConversation());
  mockApiClient.listConversations.mockResolvedValue([]);
  mockApiClient.getConversations.mockResolvedValue([]);
  mockApiClient.createConversation.mockResolvedValue(
    createMockConversation({ id: 'new-conv', messages: [] })
  );
  mockApiClient.deleteConversation.mockResolvedValue(undefined);
  mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
  mockApiClient.getConversationMessages.mockResolvedValue([
    createMockChatMessage(),
  ]);

  mockApiClient.searchProducts.mockResolvedValue({
    products: [createMockProduct()],
    total_count: 1,
    facets: {
      families: [{ value: 'ASA', count: 1 }],
      applications: [{ value: 'Coatings', count: 1 }],
      manufacturers: [],
      properties: [],
    },
    query_info: {
      processed_query: '',
      filters_applied: [],
      search_time_ms: 100,
    },
  });
  mockApiClient.getProducts.mockResolvedValue([createMockProduct()]);
  mockApiClient.getProduct.mockResolvedValue(createMockProductDetail());
  mockApiClient.getRelatedProducts.mockResolvedValue([createMockProduct()]);
  mockApiClient.compareProducts.mockResolvedValue({
    products: [createMockProductDetail()],
    comparison_matrix: {
      aspects: [],
      data: [],
    },
    recommendations: [],
    analysis_summary: 'Comparison complete',
  });
  mockApiClient.getProductFamilies.mockResolvedValue(['ASA', 'DCA', 'ECA']);
  mockApiClient.getProductApplications.mockResolvedValue([
    'Coatings',
    'Adhesives',
  ]);
  mockApiClient.getApplications.mockResolvedValue(['Coatings', 'Adhesives']);
  mockApiClient.getProductProperties.mockResolvedValue([]);
  mockApiClient.getProductStatistics.mockResolvedValue({
    totalProducts: 100,
    totalFamilies: 10,
    totalApplications: 20,
  });

  mockApiClient.queryKnowledgeGraph.mockResolvedValue({
    central_entity: {
      id: 'entity-1',
      text: 'ASA 150',
      type: 'Product',
      canonical_name: 'ASA 150',
      aliases: ['ASA-150'],
      source_text: null,
      provenance: {
        document_id: 'asa-150-spec',
        page: 1,
      },
      metadata: {},
    },
    related_entities: [],
    relationships: [],
    graph_data: {
      nodes: [],
      edges: [],
    },
  });
  mockApiClient.getEntityNeighbors.mockResolvedValue({
    central_entity: {
      id: 'entity-1',
      text: 'ASA 150',
      type: 'Product',
      canonical_name: 'ASA 150',
      aliases: ['ASA-150'],
      source_text: null,
      provenance: {
        document_id: 'asa-150-spec',
        page: 1,
      },
      metadata: {},
    },
    related_entities: [],
    relationships: [],
    graph_data: {
      nodes: [],
      edges: [],
    },
  });

  mockApiClient.getSystemStatus.mockResolvedValue({
    status: 'healthy',
    services: {
      database: 'healthy',
      vectorStore: 'healthy',
      knowledgeGraph: 'healthy',
    },
    timestamp: new Date().toISOString(),
  });
  mockApiClient.checkHealth.mockResolvedValue(true);

  mockNavigate.mockReset();
  mockSetSearchParams.mockReset();

  // Setup common mocks
  mockClipboard();
  mockScrollIntoView();
};

// Cleanup function
export const cleanupTest = () => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
};
