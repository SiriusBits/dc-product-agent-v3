/**
 * Test utilities for frontend testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock React Router
export const mockNavigate = vi.fn();
export const mockLocation = { pathname: '/', search: '' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

// Mock API client
export const mockApiClient = {
  chat: vi.fn(),
  getProducts: vi.fn(),
  getProduct: vi.fn(),
  searchProducts: vi.fn(),
  getProductFamilies: vi.fn(),
  getApplications: vi.fn(),
  compareProducts: vi.fn(),
  getConversations: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getKnowledgeGraphNeighbors: vi.fn(),
  queryKnowledgeGraphRelationships: vi.fn(),
};

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
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

export const createMockChatMessage = (overrides = {}) => ({
  id: '1',
  content: 'What is the viscosity of ASA 150?',
  role: 'user' as const,
  timestamp: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

export const createMockSearchResult = (overrides = {}) => ({
  content: 'ASA 150 has a viscosity of 150 cP',
  score: 0.95,
  source: 'vector',
  metadata: { doc_id: 'asa-150-spec' },
  provenance: { document: 'ASA 150 Technical Bulletin' },
  ...overrides,
});

export const createMockChatResponse = (overrides = {}) => ({
  answer: 'ASA 150 has a viscosity of 150 cP at 25°C.',
  sources: [createMockSearchResult()],
  conversationId: 'conv-123',
  queryAnalysis: {
    queryType: 'specification',
    entities: ['ASA 150'],
    intentConfidence: 0.9,
  },
  responseTimeMs: 250,
  kgEnhanced: true,
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

export const mockClipboard = () => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(),
      readText: vi.fn(),
    },
  });
};

export const mockScrollIntoView = () => {
  Element.prototype.scrollIntoView = vi.fn();
};

// Setup function for common test setup
export const setupTest = () => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset mock implementations
  Object.values(mockApiClient).forEach((mock) => {
    if (typeof mock === 'function') {
      mock.mockReset();
    }
  });
  
  mockNavigate.mockReset();
  
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