# Loading State Cleanup Guide

## Overview

This guide explains how to properly clean up loading states in tests to prevent them from blocking the interface indefinitely and causing test timeouts.

## The Problem

Loading states can persist across tests or remain active after operations complete, causing:

- Tests timing out after 3000ms
- Interface elements remaining disabled
- Subsequent tests failing due to leftover state
- Flaky test behavior

## The Solution

Proper cleanup of loading states involves:

1. Clearing active loading states before test cleanup
2. Cancelling pending promises and timers
3. Resetting mock state to initial values
4. Using the enhanced cleanup utilities

## Best Practices

### 1. Use Enhanced Setup with Auto-Cleanup

The `setupTest()` function from `enhanced-setup.ts` includes automatic loading state cleanup:

```typescript
import { setupTest } from '@/test/enhanced-setup';

describe('My Test Suite', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest({
      enableAutoCleanup: true, // Default: true
      chatLoading: false,
      productsLoading: false,
      conversationsLoading: false,
    });
  });

  // Tests here - cleanup happens automatically
});
```

### 2. Manual Cleanup in afterEach

If you need manual control, ensure you clear loading states:

```typescript
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

afterEach(async () => {
  // 1. Force clear any active loading states
  try {
    if (chatMock) {
      const currentState = chatMock.getCurrentValue();
      if (currentState.isLoading) {
        await chatMock.updateValue({ isLoading: false });
      }
    }
  } catch (error) {
    // Ignore errors during cleanup
  }

  // 2. Cleanup rendered components
  cleanup();

  // 3. Clear all mocks and timers
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // 4. Reset mocks
  chatMock?.reset();
});
```

### 3. Use Loading State Manager Cleanup

For tests using the `LoadingStateManager`:

```typescript
import { 
  cleanupLoadingStates, 
  emergencyCleanupLoadingStates 
} from '@/test/loading-state-manager';

afterEach(() => {
  // Normal cleanup
  cleanupLoadingStates();
  
  // Or emergency cleanup if tests are stuck
  // emergencyCleanupLoadingStates();
});
```

### 4. Ensure Operations Complete

Always wait for loading operations to complete before ending tests:

```typescript
it('should handle loading states', async () => {
  const user = userEvent.setup();
  
  await testContext.updateChat({ isLoading: true });
  testContext.renderComponent(<ChatInterface />);
  
  // Verify loading state
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Clear loading state before test ends
  await testContext.updateChat({ isLoading: false });
  
  // Wait for UI to update
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
});
```

### 5. Handle Async Operations Properly

When testing async operations, ensure they complete:

```typescript
it('should send message', async () => {
  const mockSendMessage = vi.fn().mockImplementation(async (content: string) => {
    // Set loading
    await testContext.updateChat({ isLoading: true });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // IMPORTANT: Always clear loading state
    await testContext.updateChat({ 
      isLoading: false,
      messages: [{ id: '1', content, role: 'user', timestamp: new Date() }]
    });
  });

  await testContext.updateChat({ sendMessage: mockSendMessage });
  testContext.renderComponent(<ChatInterface />);
  
  // Trigger send
  await user.click(sendButton);
  
  // Wait for operation to complete
  await waitFor(() => {
    expect(testContext.chatMock.getCurrentValue().isLoading).toBe(false);
  }, { timeout: 1000 });
});
```

## Common Pitfalls

### ❌ Don't: Leave loading states active

```typescript
it('bad test', async () => {
  await testContext.updateChat({ isLoading: true });
  testContext.renderComponent(<ChatInterface />);
  
  // Test ends with loading still active - BAD!
});
```

### ✅ Do: Clear loading states

```typescript
it('good test', async () => {
  await testContext.updateChat({ isLoading: true });
  testContext.renderComponent(<ChatInterface />);
  
  // Clear loading before test ends
  await testContext.updateChat({ isLoading: false });
  
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
});
```

### ❌ Don't: Forget to wait for async operations

```typescript
it('bad test', async () => {
  const mockSendMessage = vi.fn().mockImplementation(async () => {
    await testContext.updateChat({ isLoading: true });
    // Async operation that never completes - BAD!
  });
  
  await user.click(sendButton);
  // Test ends before operation completes
});
```

### ✅ Do: Wait for operations to complete

```typescript
it('good test', async () => {
  const mockSendMessage = vi.fn().mockImplementation(async () => {
    await testContext.updateChat({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 50));
    await testContext.updateChat({ isLoading: false });
  });
  
  await user.click(sendButton);
  
  // Wait for operation to complete
  await waitFor(() => {
    expect(testContext.chatMock.getCurrentValue().isLoading).toBe(false);
  }, { timeout: 1000 });
});
```

## Debugging Loading State Issues

### Check Active Loading States

```typescript
import { loadingStateManager } from '@/test/loading-state-manager';

// In your test
const activeOps = loadingStateManager.getActiveOperations();
console.log('Active loading operations:', activeOps);

const hasPending = loadingStateManager.hasPendingOperations();
console.log('Has pending operations:', hasPending);
```

### Force Reset Loading States

If tests are stuck, you can force reset:

```typescript
import { emergencyCleanupLoadingStates } from '@/test/loading-state-manager';

// In afterEach or when debugging
emergencyCleanupLoadingStates();
```

### Check Mock State

```typescript
// Check current loading state
const chatState = testContext.chatMock.getCurrentValue();
console.log('Chat loading:', chatState.isLoading);

const productsState = testContext.productsMock.getCurrentValue();
console.log('Products loading:', productsState.loading);
```

## Cleanup Checklist

Before ending each test, ensure:

- [ ] All loading states are set to `false`
- [ ] All async operations have completed
- [ ] All timers are cleared (`vi.clearAllTimers()`)
- [ ] All mocks are reset
- [ ] Components are unmounted (`cleanup()`)
- [ ] No pending promises remain

## Integration with Test Infrastructure

The loading state cleanup is integrated into:

1. **enhanced-setup.ts**: Automatic cleanup in `afterEach`
2. **loading-state-manager.ts**: Centralized loading state management
3. **fixed-loading-mocks.ts**: Cleanup in `cleanupFixedLoadingMocks()`
4. **enhanced-loading-mocks.ts**: Cleanup in `cleanupEnhancedLoadingMocks()`

All these utilities work together to ensure proper cleanup.

## Performance Impact

Proper cleanup has minimal performance impact:

- Cleanup operations take < 10ms
- Prevents test timeouts (saves 3000ms+ per failed test)
- Improves test reliability and reduces flakiness
- Maintains fast test execution (< 90 seconds for full suite)

## Summary

Proper loading state cleanup is essential for:

- ✅ Preventing test timeouts
- ✅ Ensuring test isolation
- ✅ Maintaining test reliability
- ✅ Fast test execution
- ✅ Accurate test results

Always use the provided cleanup utilities and follow the best practices outlined in this guide.
