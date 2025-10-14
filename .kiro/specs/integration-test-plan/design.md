# Design Document

## Overview

This design addresses the failing integration tests by implementing a systematic approach to fix mock infrastructure, component integration, and test reliability. The solution focuses on creating standardized mock factories, fixing component state management, and improving test infrastructure to achieve consistent, reliable test results.

## Architecture

### High-Level Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Test Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Chat Flow Tests  │  Product Tests  │  API Tests  │  Other  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Standardized Mock Infrastructure                │
├─────────────────────────────────────────────────────────────┤
│  • Mock Factories (createMockUseChat, etc.)                 │
│  • Test Utilities (render, waitFor, etc.)                   │
│  • Mock Data Builders (messages, products, etc.)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                           │
├─────────────────────────────────────────────────────────────┤
│  ChatInterface  │  ProductBrowser  │  Error Components      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hook Layer (Mocked)                       │
├─────────────────────────────────────────────────────────────┤
│  useChat  │  useProducts  │  useConversations  │  useApi    │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Standardization**: All mocks use factory functions with consistent interfaces
2. **Type Safety**: Mock data structures match actual hook return types exactly
3. **Isolation**: Each test has independent mock state to prevent interference
4. **Realism**: Mock behavior closely mimics actual hook behavior
5. **Maintainability**: Centralized mock infrastructure reduces duplication

## Components and Interfaces

### Mock Factory System

#### Core Mock Factories

**File**: `apps/frontend/src/test/standardized-mocks.ts`

```typescript
// Hook return value factories
export interface MockUseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: ApiError | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  currentConversationId: string | null;
}

export const createMockUseChatReturn = (
  overrides?: Partial<MockUseChatReturn>
): MockUseChatReturn => ({
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn().mockResolvedValue(undefined),
  clearMessages: vi.fn(),
  retryLastMessage: vi.fn().mockResolvedValue(undefined),
  currentConversationId: null,
  ...overrides
});

export interface MockUseProductsReturn {
  products: Product[];
  isLoading: boolean;
  error: ApiError | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export const createMockUseProductsReturn = (
  overrides?: Partial<MockUseProductsReturn>
): MockUseProductsReturn => ({
  products: [],
  isLoading: false,
  error: null,
  searchTerm: '',
  setSearchTerm: vi.fn(),
  filters: {},
  setFilters: vi.fn(),
  totalCount: 0,
  hasMore: false,
  loadMore: vi.fn().mockResolvedValue(undefined),
  ...overrides
});
```

#### Mock Data Builders

```typescript
// Message builder
export const createMockMessage = (
  overrides?: Partial<Message>
): Message => ({
  id: `msg-${Date.now()}`,
  content: 'Test message',
  role: 'user',
  timestamp: new Date(),
  conversationId: 'conv-1',
  ...overrides
});

// Product builder
export const createMockProduct = (
  overrides?: Partial<Product>
): Product => ({
  id: `prod-${Date.now()}`,
  name: 'Test Product',
  short_name: 'TEST',
  family: 'Test Family',
  cas_number: '12345-67-8',
  applications: ['Testing'],
  key_properties: ['Property 1'],
  document_count: 1,
  ...overrides
});

// Error builder
export const createMockApiError = (
  message: string = 'Test error',
  status: number = 500
): ApiError => new ApiError(message, status);
```

### Test Utilities Enhancement

**File**: `apps/frontend/src/test/test-utils.tsx`

```typescript
import { render as rtlRender } from '@testing-library/react';
import { vi } from 'vitest';
import {
  createMockUseChatReturn,
  createMockUseProductsReturn,
  createMockUseConversationsReturn
} from './standardized-mocks';

// Global mock setup
export const setupMocks = () => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Setup default hook mocks
  vi.mock('@/hooks/useChat', () => ({
    useChat: vi.fn(() => createMockUseChatReturn())
  }));
  
  vi.mock('@/hooks/useProducts', () => ({
    useProducts: vi.fn(() => createMockUseProductsReturn())
  }));
  
  vi.mock('@/hooks/useConversations', () => ({
    useConversations: vi.fn(() => createMockUseConversationsReturn())
  }));
};

// Enhanced render function
export const render = (ui: React.ReactElement, options = {}) => {
  return rtlRender(ui, {
    ...options
  });
};

// Helper to update mock return values
export const updateMockHook = <T,>(
  hookName: string,
  returnValue: T
) => {
  const mockModule = vi.mocked(require(`@/hooks/${hookName}`));
  mockModule[hookName].mockReturnValue(returnValue);
};
```

### Component Fixes

#### ChatInterface Component

**File**: `apps/frontend/src/components/chat/ChatInterface.tsx`

**Key Changes**:

1. Add proper null/undefined checks for hook data
2. Ensure loading states are properly displayed
3. Add data-testid attributes for test queries
4. Handle empty message arrays gracefully
5. Display errors with proper error components

```typescript
export default function ChatInterface() {
  const { messages, isLoading, error, sendMessage } = useChat();
  
  // Defensive programming - handle undefined/null
  const displayMessages = messages ?? [];
  
  return (
    <div className="flex h-full bg-background" data-testid="chat-interface">
      <ConversationSidebar />
      
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <h1 className="text-lg font-semibold">Chemical Product Assistant</h1>
        </div>
        
        <div className="flex-1 overflow-auto p-4" data-testid="chat-messages">
          {displayMessages.length === 0 && !isLoading ? (
            <WelcomeSection />
          ) : (
            <ChatHistory messages={displayMessages} />
          )}
          
          {isLoading && (
            <div data-testid="loading-spinner">
              <LoadingSpinner />
            </div>
          )}
        </div>
        
        {error && (
          <div data-testid="chat-error">
            <ApiErrorDisplay error={error} />
          </div>
        )}
        
        <ChatInput 
          onSendMessage={sendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
```

#### ProductBrowser Component

**File**: `apps/frontend/src/components/products/ProductBrowser.tsx`

**Key Changes**:

1. Add proper null/undefined checks for product data
2. Ensure search input is accessible with proper labels
3. Add data-testid attributes for test queries
4. Handle empty product arrays gracefully
5. Display loading and error states properly

```typescript
export default function ProductBrowser() {
  const { 
    products, 
    isLoading, 
    error, 
    searchTerm, 
    setSearchTerm,
    totalCount 
  } = useProducts();
  
  // Defensive programming
  const displayProducts = products ?? [];
  
  return (
    <div className="container mx-auto p-4" data-testid="product-browser">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Product Catalog</h1>
        
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          className="w-full p-2 border rounded"
          data-testid="product-search-input"
          aria-label="Search products"
        />
      </div>
      
      {error && (
        <div data-testid="product-error">
          <ApiErrorDisplay error={error} />
        </div>
      )}
      
      {isLoading ? (
        <div data-testid="product-loading">
          <LoadingSpinner />
        </div>
      ) : displayProducts.length === 0 ? (
        <div data-testid="product-empty-state">
          <p>No products found</p>
        </div>
      ) : (
        <div data-testid="product-list">
          <p className="mb-4">{totalCount} products</p>
          <ProductList products={displayProducts} />
        </div>
      )}
    </div>
  );
}
```

## Data Models

### Mock Data Structures

All mock data structures must exactly match the TypeScript interfaces defined in `@repo/shared-types`:

```typescript
// Message structure
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  sources?: Source[];
}

// Product structure
interface Product {
  id: string;
  name: string;
  short_name: string;
  family: string;
  cas_number: string;
  applications: string[];
  key_properties: string[];
  document_count: number;
}

// Error structure
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## Error Handling

### Test Error Scenarios

1. **Network Errors**: Simulate connection failures
2. **Server Errors**: Simulate 5xx responses
3. **Client Errors**: Simulate 4xx responses
4. **Timeout Errors**: Simulate request timeouts
5. **Validation Errors**: Simulate invalid data responses

### Error Display Requirements

- Error messages must be visible in the UI
- Retry buttons must appear for retryable errors (5xx)
- Error details must be accessible for debugging
- Loading states must clear when errors occur

## Testing Strategy

### Test Organization

```
apps/frontend/src/test/
├── standardized-mocks.ts          # Mock factories and builders
├── test-utils.tsx                 # Enhanced test utilities
├── integration/
│   ├── chat-flow.test.tsx         # Chat integration tests
│   ├── product-search.test.tsx    # Product search tests
│   └── api-interaction.test.tsx   # API error handling tests
└── unit/
    ├── hooks/                     # Hook unit tests
    └── components/                # Component unit tests
```

### Test Patterns

#### Pattern 1: Component Rendering with Mock Data

```typescript
it('renders component with mocked data', async () => {
  // Arrange: Setup mock data
  const mockMessages = [
    createMockMessage({ id: '1', content: 'Hello' }),
    createMockMessage({ id: '2', content: 'World' })
  ];
  
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ messages: mockMessages })
  );
  
  // Act: Render component
  render(<ChatInterface />);
  
  // Assert: Verify rendering
  await waitFor(() => {
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });
});
```

#### Pattern 2: User Interaction Testing

```typescript
it('handles user interaction', async () => {
  // Arrange: Setup mock with spy
  const mockSendMessage = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ sendMessage: mockSendMessage })
  );
  
  render(<ChatInterface />);
  
  // Act: Simulate user interaction
  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'Test message');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));
  
  // Assert: Verify function called
  expect(mockSendMessage).toHaveBeenCalledWith('Test message');
});
```

#### Pattern 3: Error State Testing

```typescript
it('displays error state', async () => {
  // Arrange: Setup mock with error
  const mockError = createMockApiError('Network error', 500);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ error: mockError })
  );
  
  // Act: Render component
  render(<ChatInterface />);
  
  // Assert: Verify error display
  await waitFor(() => {
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

### Test Execution Strategy

1. **Isolation**: Each test runs with fresh mock state
2. **Cleanup**: Mocks are reset after each test
3. **Async Handling**: Use `waitFor` and `findBy` for async operations
4. **Query Priority**: Use `getBy` for expected elements, `queryBy` for conditional elements
5. **User Simulation**: Use `@testing-library/user-event` for realistic interactions

## Implementation Phases

### Phase 1: Mock Infrastructure (Days 1-2)

- Create standardized mock factories
- Update test utilities
- Ensure type safety

### Phase 2: Component Fixes (Days 3-5)

- Fix ChatInterface integration
- Fix ProductBrowser integration
- Fix error handling components

### Phase 3: Test Updates (Days 6-7)

- Update integration tests to use new mocks
- Add missing test coverage
- Verify test stability

## Success Metrics

- Chat flow tests: ≥95% pass rate
- Product search tests: ≥95% pass rate
- API interaction tests: ≥95% pass rate
- Zero flaky tests
- Consistent test execution times
