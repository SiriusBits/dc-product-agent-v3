# Test Utilities Migration Guide

## Overview

This guide documents the migration from multiple test utility files to a unified test infrastructure using the new reactive mock system. The migration consolidates duplicate utilities and provides a single source of truth for test setup and mocking.

## Migration Summary

### ✅ New Unified Infrastructure

- **`enhanced-setup.ts`** - Main setup function with reactive mocks
- **`reactive-mocks.ts`** - ReactiveHookMock infrastructure and MockRegistry
- **`input-utilities.ts`** - User input simulation utilities
- **`test-id-validation.ts`** - Test ID uniqueness validation

### ⚠️ Deprecated Files (Use New Infrastructure Instead)

- **`test-utils.tsx`** - ❌ DEPRECATED - Use `enhanced-setup.ts` instead
- **`enhanced-test-utils.tsx`** - ❌ DEPRECATED - Use `enhanced-setup.ts` instead
- **`enhanced-test-setup.ts`** - ❌ DEPRECATED - Use `enhanced-setup.ts` instead
- **`optimized-setup.ts`** - ❌ DEPRECATED - Use `enhanced-setup.ts` instead
- **`enhanced-hook-mocks.ts`** - ❌ DEPRECATED - Use `reactive-mocks.ts` instead
- **`standardized-mocks.ts`** - ✅ KEEP - Still used for data factories

## Migration Patterns

### 1. Basic Test Setup

**OLD (test-utils.tsx):**

```typescript
import { setupMocks, updateMockHook, render } from '@/test/test-utils';

describe('Component', () => {
  beforeEach(() => {
    setupMocks({
      useChat: { messages: [], isLoading: false }
    });
  });

  it('should work', () => {
    updateMockHook('useChat', { isLoading: true });
    const { getByTestId } = render(<Component />);
    // assertions
  });
});
```

**NEW (enhanced-setup.ts):**

```typescript
import { setupTest } from '@/test/enhanced-setup';

describe('Component', () => {
  it('should work', async () => {
    const { updateChat, renderComponent } = setupTest({
      initialChatMessages: [],
      chatLoading: false
    });

    await updateChat({ isLoading: true });
    const { getByTestId } = renderComponent(<Component />);
    // assertions
  });
});
```

### 2. Enhanced Test Utils

**OLD (enhanced-test-utils.tsx):**

```typescript
import { render, createMockChatMessage } from '@/test/enhanced-test-utils';

const message = createMockChatMessage({ content: 'test' });
const { getByText } = render(<Component />);
```

**NEW (enhanced-setup.ts + standardized-mocks.ts):**

```typescript
import { setupTest } from '@/test/enhanced-setup';
import { createMockMessage } from '@/test/standardized-mocks';

const message = createMockMessage({ content: 'test' });
const { renderComponent } = setupTest();
const { getByText } = renderComponent(<Component />);
```

### 3. Input Utilities

**OLD (various files):**

```typescript
import userEvent from '@testing-library/user-event';

// Manual input handling with potential duplication issues
await userEvent.type(input, 'text');
```

**NEW (input-utilities.ts):**

```typescript
import { typeIntoInput, submitForm, waitForDebounce } from '@/test/input-utilities';

// Reliable input handling with clear-first behavior
await typeIntoInput(input, 'text');
await submitForm(form, { viaEnterKey: true });
await waitForDebounce(() => expect(callback).toHaveBeenCalled());
```

### 4. Mock State Updates

**OLD (various approaches):**

```typescript
// Different patterns across files
mockUseChat.mockReturnValue({ messages: newMessages });
updateMockHook('useChat', { messages: newMessages });
mockHookControls.setMessages(newMessages);
```

**NEW (reactive-mocks.ts):**

```typescript
import { setupTest } from '@/test/enhanced-setup';

const { updateChat } = setupTest();
await updateChat({ messages: newMessages }); // Triggers React re-renders
```

## File-by-File Migration

### Component Tests

**Before:**

```typescript
import { setupMocks, render } from '@/test/test-utils';
import { createMockUseChatReturn } from '@/test/standardized-mocks';
```

**After:**

```typescript
import { setupTest } from '@/test/enhanced-setup';
import { createMockMessage } from '@/test/standardized-mocks';
```

### Integration Tests

**Before:**

```typescript
import { render } from '@/test/enhanced-test-utils';
import { setupOptimizedMocks } from '@/test/optimized-setup';
```

**After:**

```typescript
import { setupTest } from '@/test/enhanced-setup';
// All optimization is built into the new infrastructure
```

### Hook Tests

**Before:**

```typescript
import { setupTest, cleanupTest } from '@/test/test-utils';
import { waitForDebounce } from '@/test/input-utilities';
```

**After:**

```typescript
import { setupTest } from '@/test/enhanced-setup';
import { waitForDebounce } from '@/test/input-utilities';
// Cleanup is automatic with new infrastructure
```

## Key Benefits of Migration

### 1. React-Aware Mock Updates

- Mock state changes now trigger React re-renders using `act()`
- No more stale component state in tests
- Proper async handling for state updates

### 2. Unified API

- Single `setupTest()` function for all test scenarios
- Consistent patterns across all test files
- Reduced cognitive load for developers

### 3. Better Performance

- Optimized mock creation and cleanup
- Automatic test isolation
- Reduced memory leaks

### 4. Enhanced Debugging

- MockRegistry provides visibility into all registered mocks
- Better error messages for test failures
- Performance monitoring built-in

## Common Migration Issues

### 1. Mock State Not Updating Components

**Problem:** Component doesn't reflect mock state changes

```typescript
// OLD - doesn't trigger re-renders
mockUseChat.mockReturnValue({ isLoading: true });
```

**Solution:** Use reactive mock updates

```typescript
// NEW - triggers re-renders with act()
await updateChat({ isLoading: true });
```

### 2. Input Duplication Issues

**Problem:** Text appears duplicated in inputs

```typescript
// OLD - can cause duplication
await userEvent.type(input, 'text');
```

**Solution:** Use input utilities with clear-first behavior

```typescript
// NEW - clears before typing
await typeIntoInput(input, 'text');
```

### 3. Test Isolation Problems

**Problem:** Tests affect each other

```typescript
// OLD - manual cleanup required
afterEach(() => {
  vi.clearAllMocks();
  // ... more cleanup
});
```

**Solution:** Automatic cleanup with new infrastructure

```typescript
// NEW - automatic cleanup
const { renderComponent } = setupTest({ enableAutoCleanup: true }); // default
```

## Validation Steps

After migrating a test file:

1. **Run the test** - Ensure it passes with new infrastructure
2. **Check for warnings** - Look for deprecation warnings in console
3. **Verify isolation** - Run test multiple times to ensure no interference
4. **Performance check** - Ensure test execution time hasn't increased significantly

## Rollback Plan

If issues arise during migration:

1. **Revert imports** to old utilities temporarily
2. **File issue** with specific test failure details
3. **Use feature flag** to enable/disable new infrastructure per test file
4. **Gradual migration** - migrate one test file at a time

## Support

For migration questions or issues:

1. Check this guide first
2. Look at migrated test examples in the codebase
3. Review the reactive-mocks.ts documentation
4. File an issue with specific test failure details

## Timeline

- **Phase 1** ✅ - Infrastructure created (Tasks 1-13)
- **Phase 2** 🔄 - Migration and consolidation (Task 14)
- **Phase 3** ⏳ - Cleanup and optimization (Tasks 15-20)
