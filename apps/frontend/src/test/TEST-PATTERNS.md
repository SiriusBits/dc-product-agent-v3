# Test Patterns Guide

## Overview

This guide documents the correct patterns for testing React components and hooks using API-level mocking instead of hook-level mocking.

## Why API-Level Mocking?

**Problem with Hook Mocking:**

- Mocked hooks return static values
- Static values don't trigger React re-renders
- Components fail to update when state changes
- Tests become unreliable and fail

**Solution with API Mocking:**

- Mock `@/lib/api-client` instead of hooks
- Real hooks run with mocked API responses
- Real hooks maintain React state naturally
- Components re-render correctly
- Tests reflect actual user experience

## Pattern 1: Component Integration Tests

### Setup

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mock API client at module level
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    // ... other methods
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// Import after mocking
import { apiClient } from '@/lib/api-client';
import Component from '@/components/Component';
```

### Basic Test

```typescript
describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default responses
    vi.mocked(apiClient.listConversations).mockResolvedValue([]);
  });

  it('renders and handles user interaction', async () => {
    // Setup specific response for this test
    vi.mocked(apiClient.sendMessage).mockResolvedValue({
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: 'Response',
        timestamp: new Date().toISOString(),
      },
      conversation_id: 'conv-1',
      sources: [],
    });

    render(<Component />);
    
    // Interact with component
    await userEvent.type(screen.getByRole('textbox'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    
    // Verify API was called
    expect(apiClient.sendMessage).toHaveBeenCalledWith({
      content: 'Hello',
    });
    
    // Wait for response to appear
    await waitFor(() => {
      expect(screen.getByText('Response')).toBeInTheDocument();
    });
  });
});
```

### Testing Loading States

```typescript
it('shows loading indicator during API call', async () => {
  // Setup delayed response
  vi.mocked(apiClient.sendMessage).mockImplementation(
    () => new Promise(resolve => 
      setTimeout(() => resolve(mockResponse), 100)
    )
  );

  render(<Component />);
  
  // Trigger action
  await userEvent.click(screen.getByRole('button'));
  
  // Verify loading state appears
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
});
```

### Testing Error Handling

```typescript
it('displays error message on API failure', async () => {
  // Setup error response
  vi.mocked(apiClient.sendMessage).mockRejectedValue(
    new Error('Server error')
  );

  render(<Component />);
  
  await userEvent.click(screen.getByRole('button'));
  
  // Wait for error message
  await waitFor(() => {
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
  });
});
```

## Pattern 2: Hook Unit Tests

### Setup

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

// Mock API client
vi.mock('@/lib/api-client');

import { apiClient } from '@/lib/api-client';
import { useChat } from '@/hooks/useChat';
```

### Basic Hook Test

```typescript
describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages loading state correctly', async () => {
    vi.mocked(apiClient.sendMessage).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useChat());
    
    // Initial state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toEqual([]);
    
    // Send message
    await act(async () => {
      await result.current.sendMessage('test');
    });
    
    // Verify state updated
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(2); // user + assistant
  });
});
```

### Testing Hook Side Effects

```typescript
it('handles API errors gracefully', async () => {
  vi.mocked(apiClient.sendMessage).mockRejectedValue(
    new Error('Network error')
  );
  
  const { result } = renderHook(() => useChat());
  
  await act(async () => {
    try {
      await result.current.sendMessage('test');
    } catch (error) {
      // Expected to throw
    }
  });
  
  expect(result.current.error).toBeDefined();
  expect(result.current.isLoading).toBe(false);
});
```

## Pattern 3: Using Test Utilities

### With Mock Factory

```typescript
import { createApiMocks, mockDefaults } from '@/test/api-mock-factory';

vi.mock('@/lib/api-client', () => ({
  apiClient: createApiMocks({
    chat: {
      sendMessage: mockDefaults.chatResponse(),
      listConversations: [],
    },
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));
```

### With Test Utils

```typescript
import { setupApiMocks, mockWithDelay, mockWithError } from '@/test/api-test-utils';

describe('Component', () => {
  let mocks: ReturnType<typeof setupApiMocks>;

  beforeEach(() => {
    mocks = setupApiMocks();
  });

  it('handles delayed response', async () => {
    mockWithDelay(mocks.sendMessage, mockResponse, 200);
    
    render(<Component />);
    // ... test logic
  });

  it('handles error', async () => {
    mockWithError(mocks.sendMessage, 'Server error');
    
    render(<Component />);
    // ... test logic
  });
});
```

## Common Patterns

### Multiple API Calls

```typescript
it('handles multiple sequential API calls', async () => {
  vi.mocked(apiClient.listConversations).mockResolvedValue([conv1, conv2]);
  vi.mocked(apiClient.getConversation).mockResolvedValue(conv1);
  
  render(<Component />);
  
  // Wait for initial load
  await waitFor(() => {
    expect(screen.getByText(conv1.title)).toBeInTheDocument();
  });
  
  // Click to load details
  await userEvent.click(screen.getByText(conv1.title));
  
  // Verify both calls made
  expect(apiClient.listConversations).toHaveBeenCalledTimes(1);
  expect(apiClient.getConversation).toHaveBeenCalledWith(conv1.id);
});
```

### Retry Logic

```typescript
it('retries failed requests', async () => {
  // Fail first two times, succeed third time
  vi.mocked(apiClient.sendMessage)
    .mockRejectedValueOnce(new Error('Timeout'))
    .mockRejectedValueOnce(new Error('Timeout'))
    .mockResolvedValueOnce(mockResponse);
  
  render(<Component />);
  
  await userEvent.click(screen.getByRole('button'));
  
  // Wait for success after retries
  await waitFor(() => {
    expect(screen.getByText('Response')).toBeInTheDocument();
  }, { timeout: 5000 });
  
  expect(apiClient.sendMessage).toHaveBeenCalledTimes(3);
});
```

### Cleanup

```typescript
afterEach(() => {
  vi.clearAllMocks();
  cleanup(); // From @testing-library/react
});
```

## Anti-Patterns (Don't Do This)

### ❌ Mocking Hooks

```typescript
// DON'T DO THIS
vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isLoading: false,
  }),
}));
```

**Why:** Mocked hooks don't trigger re-renders, breaking component tests.

### ❌ Mocking React Internals

```typescript
// DON'T DO THIS
vi.mock('react', () => ({
  ...vi.importActual('react'),
  useState: vi.fn(),
}));
```

**Why:** Breaks React's internal state management.

### ❌ Complex Mock Registries

```typescript
// DON'T DO THIS
const mockRegistry = new Map();
function setupTest(config) {
  mockRegistry.set('useChat', createMock(config));
  // ... complex setup
}
```

**Why:** Overly complex, hard to maintain, doesn't solve the core problem.

## Best Practices

1. **Mock at the API boundary** - Mock `@/lib/api-client`, not hooks
2. **Use real hooks** - Let hooks manage state naturally
3. **Test user behavior** - Focus on what users see and do
4. **Wait for async operations** - Use `waitFor` for state updates
5. **Clear mocks between tests** - Prevent test pollution
6. **Use meaningful test data** - Make tests readable and maintainable
7. **Test error scenarios** - Don't just test happy paths
8. **Keep tests simple** - One concept per test

## Troubleshooting

### Component doesn't update

**Problem:** Component renders but doesn't show updated state.

**Solution:** Ensure you're using `waitFor` to wait for async updates:

```typescript
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

### Mock not being called

**Problem:** `expect(apiClient.method).toHaveBeenCalled()` fails.

**Solution:** Verify mock is setup before component renders:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.method).mockResolvedValue(response);
});
```

### Test times out

**Problem:** Test hangs and times out.

**Solution:** Check for missing mock implementations:

```typescript
// Ensure all API methods used by component are mocked
vi.mocked(apiClient.listConversations).mockResolvedValue([]);
vi.mocked(apiClient.createConversation).mockResolvedValue(conv);
```

### Flaky tests

**Problem:** Tests pass sometimes, fail other times.

**Solution:** Add proper cleanup and isolation:

```typescript
afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});
```

## Migration Checklist

When migrating from hook mocking to API mocking:

- [ ] Remove `vi.mock('@/hooks/...')` statements
- [ ] Add `vi.mock('@/lib/api-client')` at module level
- [ ] Import `apiClient` after mock declaration
- [ ] Setup default mock responses in `beforeEach`
- [ ] Update test assertions to use `waitFor` for async updates
- [ ] Verify loading states work correctly
- [ ] Test error handling scenarios
- [ ] Run tests multiple times to ensure stability
- [ ] Update test documentation

## Examples

See working examples in:

- `apps/frontend/src/test/integration/loading-indicators-api-mocked.test.tsx`
- Component integration tests in `apps/frontend/src/components/**/__tests__/`
- Hook unit tests in `apps/frontend/src/hooks/__tests__/`
