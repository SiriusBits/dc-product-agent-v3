# Integration Test Implementation Tasks

## Immediate Action Items

### Task A: Fix Hook Mock Data Structures (Critical - Day 1)

#### A1: Create Standardized Mock Factories

**File**: `apps/frontend/src/test/standardized-mocks.ts`

```typescript
// Create comprehensive mock factories that match actual hook interfaces
export const createMockUseChatReturn = (overrides = {}) => ({
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn().mockResolvedValue(undefined),
  clearMessages: vi.fn(),
  retryLastMessage: vi.fn(),
  currentConversationId: null,
  ...overrides
});

export const createMockUseProductsReturn = (overrides = {}) => ({
  products: [],
  isLoading: false,
  error: null,
  searchTerm: '',
  setSearchTerm: vi.fn(),
  filters: {},
  setFilters: vi.fn(),
  totalCount: 0,
  hasMore: false,
  loadMore: vi.fn(),
  ...overrides
});

export const createMockUseConversationsReturn = (overrides = {}) => ({
  conversations: [],
  isLoading: false,
  error: null,
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  currentConversationId: null,
  setCurrentConversationId: vi.fn(),
  ...overrides
});
```

#### A2: Update Test Utils with Standardized Mocks

**File**: `apps/frontend/src/test/test-utils.tsx`

```typescript
// Replace existing mock setup with standardized factories
import { 
  createMockUseChatReturn,
  createMockUseProductsReturn,
  createMockUseConversationsReturn 
} from './standardized-mocks';

// Update mock implementations to use factories
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(() => createMockUseChatReturn())
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(() => createMockUseProductsReturn()),
  useProductDetail: vi.fn(() => ({ product: null, isLoading: false, error: null })),
  useProductFilters: vi.fn(() => ({ filters: {}, setFilters: vi.fn() }))
}));
```

### Task B: Fix ChatInterface Integration (Critical - Day 2)

#### B1: Create Working Chat Flow Test

**File**: `apps/frontend/src/test/integration/working-chat-flow.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/test-utils';
import { createMockUseChatReturn, createMockChatMessage } from '@/test/standardized-mocks';

// Mock the hooks with working data
const mockUseChat = vi.fn();
vi.mock('@/hooks/useChat', () => ({ useChat: () => mockUseChat() }));

describe('Working Chat Flow Integration', () => {
  beforeEach(() => {
    // Setup working mock data
    mockUseChat.mockReturnValue(createMockUseChatReturn({
      messages: [
        createMockChatMessage({
          id: 'msg-1',
          content: 'Hello, how can I help?',
          role: 'user',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }),
        createMockChatMessage({
          id: 'msg-2', 
          content: 'I can help you with chemical products.',
          role: 'assistant',
          timestamp: new Date('2024-01-01T10:01:00Z')
        })
      ],
      sendMessage: vi.fn().mockResolvedValue(undefined)
    }));
  });

  it('displays existing messages', async () => {
    render(<ChatInterface />);
    
    // Wait for messages to appear
    await waitFor(() => {
      expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
      expect(screen.getByText('I can help you with chemical products.')).toBeInTheDocument();
    });
  });

  it('sends new messages', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockUseChat.mockReturnValue(createMockUseChatReturn({
      messages: [],
      sendMessage: mockSendMessage
    }));

    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText(/ask about chemical products/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await userEvent.type(input, 'Test message');
    await userEvent.click(sendButton);
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });
});
```

#### B2: Fix ChatInterface Component Issues

**File**: `apps/frontend/src/components/chat/ChatInterface.tsx`

```typescript
// Ensure component properly handles empty states and loading
export default function ChatInterface() {
  const { messages, isLoading, error, sendMessage } = useChat();
  
  // Add proper fallbacks for empty states
  const displayMessages = messages || [];
  
  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <ConversationSidebar />
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <h1 className="text-lg font-semibold">Chemical Product Assistant</h1>
        </div>
        
        {/* Messages area */}
        <div className="flex-1 overflow-auto p-4">
          {displayMessages.length === 0 ? (
            <WelcomeSection />
          ) : (
            <ChatHistory messages={displayMessages} />
          )}
        </div>
        
        {/* Input area */}
        <ChatInput 
          onSendMessage={sendMessage}
          disabled={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
```

### Task C: Fix ProductBrowser Integration (Critical - Day 3)

#### C1: Create Working Product Search Test

**File**: `apps/frontend/src/test/integration/working-product-search.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductBrowser from '@/components/products/ProductBrowser';
import { render } from '@/test/test-utils';
import { createMockUseProductsReturn } from '@/test/standardized-mocks';

const mockUseProducts = vi.fn();
vi.mock('@/hooks/useProducts', () => ({ 
  useProducts: () => mockUseProducts(),
  useProductDetail: () => ({ product: null, isLoading: false, error: null }),
  useProductFilters: () => ({ filters: {}, setFilters: vi.fn() })
}));

describe('Working Product Search Integration', () => {
  beforeEach(() => {
    mockUseProducts.mockReturnValue(createMockUseProductsReturn({
      products: [
        {
          id: 'asa-150',
          name: 'ASA 150',
          short_name: 'ASA150',
          family: 'ASA',
          cas_number: '12345-67-8',
          applications: ['Coatings'],
          key_properties: ['Viscosity: 150 cP'],
          document_count: 1
        }
      ],
      totalCount: 1,
      isLoading: false
    }));
  });

  it('displays product list', async () => {
    render(<ProductBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
      expect(screen.getByText('1 product')).toBeInTheDocument();
    });
  });

  it('handles search input', async () => {
    const mockSetSearchTerm = vi.fn();
    mockUseProducts.mockReturnValue(createMockUseProductsReturn({
      products: [],
      setSearchTerm: mockSetSearchTerm
    }));

    render(<ProductBrowser />);
    
    // Find search input (may need to adjust selector based on actual component)
    const searchInput = screen.getByRole('textbox', { name: /search/i });
    await userEvent.type(searchInput, 'ASA');
    
    expect(mockSetSearchTerm).toHaveBeenCalledWith('ASA');
  });
});
```

### Task D: Fix API Error Handling (Critical - Day 4)

#### D1: Create Working API Integration Test

**File**: `apps/frontend/src/test/integration/working-api-integration.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import ChatInterface from '@/components/chat/ChatInterface';
import { ApiError } from '@/lib/api-client';
import { createMockUseChatReturn } from '@/test/standardized-mocks';

const mockUseChat = vi.fn();
vi.mock('@/hooks/useChat', () => ({ useChat: () => mockUseChat() }));

describe('Working API Integration', () => {
  it('displays error messages correctly', async () => {
    const apiError = new ApiError('Network connection failed', 500);
    mockUseChat.mockReturnValue(createMockUseChatReturn({
      error: apiError,
      isLoading: false
    }));

    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });
  });

  it('shows retry button for retryable errors', async () => {
    const retryableError = new ApiError('Server error', 500);
    const mockRetry = vi.fn();
    
    mockUseChat.mockReturnValue(createMockUseChatReturn({
      error: retryableError,
      retryLastMessage: mockRetry,
      isLoading: false
    }));

    render(<ChatInterface />);
    
    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  it('handles loading states correctly', async () => {
    mockUseChat.mockReturnValue(createMockUseChatReturn({
      isLoading: true,
      messages: []
    }));

    render(<ChatInterface />);
    
    // Check for loading indicators
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

## Execution Plan

### Day 1: Foundation

- [ ] Create `standardized-mocks.ts` with all mock factories
- [ ] Update `test-utils.tsx` to use standardized mocks
- [ ] Run basic smoke tests to ensure no regressions

### Day 2: Chat Integration

- [ ] Create `working-chat-flow.test.tsx`
- [ ] Fix ChatInterface component issues
- [ ] Ensure chat tests pass

### Day 3: Product Integration  

- [ ] Create `working-product-search.test.tsx`
- [ ] Fix ProductBrowser component issues
- [ ] Ensure product search tests pass

### Day 4: API Integration

- [ ] Create `working-api-integration.test.tsx`
- [ ] Fix error handling components
- [ ] Ensure API interaction tests pass

### Day 5: Validation

- [ ] Run full integration test suite
- [ ] Fix any remaining issues
- [ ] Document final status

## Success Metrics

- [ ] Chat flow tests: 100% pass rate
- [ ] Product search tests: 100% pass rate  
- [ ] API interaction tests: 100% pass rate
- [ ] Component integration: All components render correctly with mocked data
- [ ] No flaky tests or intermittent failures

## Rollback Plan

If any phase fails:

1. Revert changes for that phase
2. Document specific failure points
3. Create simpler alternative approach
4. Continue with remaining phases
