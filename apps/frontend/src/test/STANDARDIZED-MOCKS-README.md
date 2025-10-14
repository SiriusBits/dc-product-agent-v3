# Standardized Mock Infrastructure

This document describes the standardized mock infrastructure created for integration tests.

## Overview

The standardized mock infrastructure provides type-safe, consistent mock factories for all hook return values and data structures used in tests. This ensures:

- **Type Safety**: All mocks match actual hook interfaces exactly
- **Consistency**: All tests use the same mock creation patterns
- **Maintainability**: Centralized mock definitions reduce duplication
- **Reliability**: Proper mock reset and isolation between tests

## Files

### `standardized-mocks.ts`

Contains all mock factory functions and data builders:

#### Hook Return Value Factories

- `createMockUseChatReturn()` - Creates mock return value for `useChat` hook
- `createMockUseProductsReturn()` - Creates mock return value for `useProducts` hook
- `createMockUseConversationsReturn()` - Creates mock return value for `useConversations` hook
- `createMockUseApiReturn<T>()` - Creates generic mock return value for API hooks

#### Mock Data Builders

- `createMockMessage()` - Creates a mock chat message
- `createMockProduct()` - Creates a mock product
- `createMockConversation()` - Creates a mock conversation
- `createMockApiError()` - Creates a mock API error
- `createMockSource()` - Creates a mock retrieval result/source
- `createMockSearchFacets()` - Creates mock search facets

#### Batch Data Builders

- `createMockMessages(count)` - Creates multiple messages at once
- `createMockProducts(count)` - Creates multiple products at once
- `createMockConversations(count)` - Creates multiple conversations at once

### `test-utils.tsx`

Enhanced test utilities with standardized mock setup:

#### Setup Functions

- `setupMocks(options)` - Initializes all hook mocks with optional overrides
- `updateMockHook(hookName, returnValue)` - Updates a specific hook mock during a test
- `resetMocks()` - Resets all mocks to default state

## Usage Examples

### Basic Test Setup

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupMocks, resetMocks, mockUseChat } from '@/test/test-utils';
import { createMockMessage } from '@/test/standardized-mocks';

describe('MyComponent', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    resetMocks();
  });

  it('renders with default state', () => {
    const { messages, isLoading } = mockUseChat();
    
    expect(messages).toEqual([]);
    expect(isLoading).toBe(false);
  });
});
```

### Custom Initial State

```typescript
it('renders with messages', () => {
  const messages = [
    createMockMessage({ content: 'Hello' }),
    createMockMessage({ content: 'World', role: 'assistant' }),
  ];

  setupMocks({
    useChat: {
      messages,
      isLoading: false,
    },
  });

  const chatReturn = mockUseChat();
  expect(chatReturn.messages).toHaveLength(2);
});
```

### Updating Mock State During Test

```typescript
it('handles loading state changes', () => {
  setupMocks();

  // Initial state
  let chatReturn = mockUseChat();
  expect(chatReturn.isLoading).toBe(false);

  // Simulate loading
  updateMockHook('useChat', {
    isLoading: true,
  });

  chatReturn = mockUseChat();
  expect(chatReturn.isLoading).toBe(true);

  // Simulate loaded with data
  const messages = [createMockMessage()];
  updateMockHook('useChat', {
    messages,
    isLoading: false,
  });

  chatReturn = mockUseChat();
  expect(chatReturn.messages).toBe(messages);
  expect(chatReturn.isLoading).toBe(false);
});
```

### Error State Testing

```typescript
import { createMockApiError } from '@/test/standardized-mocks';

it('displays error state', () => {
  const error = createMockApiError('Network error', 0);

  setupMocks({
    useChat: {
      error,
      isRetryable: true,
    },
  });

  const chatReturn = mockUseChat();
  expect(chatReturn.error).toBe(error);
  expect(chatReturn.isRetryable).toBe(true);
});
```

### Batch Data Creation

```typescript
import { createMockMessages, createMockProducts } from '@/test/standardized-mocks';

it('handles multiple items', () => {
  // Create 5 messages alternating between user and assistant
  const messages = createMockMessages(5);
  expect(messages).toHaveLength(5);
  expect(messages[0].role).toBe('user');
  expect(messages[1].role).toBe('assistant');

  // Create 10 products with custom family
  const products = createMockProducts(10, { family: 'ASA' });
  expect(products).toHaveLength(10);
  expect(products.every(p => p.family === 'ASA')).toBe(true);
});
```

## Best Practices

1. **Always use `setupMocks()` in `beforeEach`** - Ensures consistent starting state
2. **Always use `resetMocks()` in `afterEach`** - Ensures test isolation
3. **Use factory functions for all mock data** - Ensures type safety and consistency
4. **Use `updateMockHook()` for state changes** - Preserves existing mock values
5. **Prefer specific overrides over full objects** - Only override what you need to test

## Type Safety

All mock factories are fully typed and will produce TypeScript errors if:

- Mock structure doesn't match actual hook interface
- Required properties are missing
- Property types don't match

This ensures that when hook interfaces change, tests will fail at compile time rather than runtime.

## Testing the Infrastructure

The mock infrastructure itself is tested in:

- `standardized-mocks.test.ts` - Tests all factory functions
- `test-utils-setup.test.ts` - Tests setup/update/reset functions

Run these tests to verify the infrastructure:

```bash
pnpm vitest --run src/test/standardized-mocks.test.ts src/test/test-utils-setup.test.ts
```

## Migration Guide

To migrate existing tests to use the standardized infrastructure:

1. Replace manual mock creation with factory functions:

   ```typescript
   // Before
   const message = { id: '1', content: 'test', role: 'user', ... };
   
   // After
   const message = createMockMessage({ content: 'test' });
   ```

2. Replace manual hook mocking with `setupMocks()`:

   ```typescript
   // Before
   mockUseChat.mockReturnValue({ messages: [], isLoading: false, ... });
   
   // After
   setupMocks({ useChat: { messages: [] } });
   ```

3. Use `updateMockHook()` for state changes:

   ```typescript
   // Before
   mockUseChat.mockReturnValue({ ...previousValue, isLoading: true });
   
   // After
   updateMockHook('useChat', { isLoading: true });
   ```

4. Add proper cleanup:

   ```typescript
   afterEach(() => {
     resetMocks();
   });
   ```
