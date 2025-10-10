# Action Plan: Fixing useConversations Tests

## Overview

This document provides a step-by-step action plan to fix all 15 failing tests in the `useConversations.test.ts` file. Each action includes the specific code changes needed and the expected outcome.

## Action Items

### Action 1: Fix the useEffect Dependency Issue

**File**: `apps/frontend/src/hooks/useConversations.ts`

**Current Code**:

```typescript
useEffect(() => {
  loadConversations();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Change To**:

```typescript
useEffect(() => {
  loadConversations();
}, [loadConversations]);
```

**Rationale**: The `loadConversations` function should be included in the dependency array to ensure the effect properly triggers. Since `loadConversations` is wrapped in `useCallback` with an empty dependency array, it will be stable across renders.

**Expected Impact**:

- Tests 1, 8-15 should start working (initial load will execute)
- This is the critical fix that enables all other tests

---

### Action 2: Ensure loadConversations is Stable

**File**: `apps/frontend/src/hooks/useConversations.ts`

**Current Code**:

```typescript
const loadConversations = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  // ... rest of implementation
}, []);
```

**Verification Needed**: Confirm that `loadConversations` has no external dependencies that should be in its dependency array.

**Expected Impact**: Ensures the function reference is stable and doesn't cause infinite re-renders

---

### Action 3: Fix Test Setup - Add Default Mocks

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Change To**:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Set default mock implementations to prevent undefined returns
  mockApiClient.listConversations.mockResolvedValue([]);
  mockApiClient.createConversation.mockResolvedValue(createMockConversation());
  mockApiClient.deleteConversation.mockResolvedValue(undefined);
  mockApiClient.updateConversationTitle.mockResolvedValue(undefined);
});
```

**Rationale**: Ensures all mocks have default implementations, preventing undefined returns

**Expected Impact**: Tests will have predictable mock behavior

---

### Action 4: Fix Async Timing in Test 1

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('loads conversations on mount', async () => {
  const mockConversations = [
    createMockConversation({ id: 'conv-1', title: 'Test Conversation 1' }),
    createMockConversation({ id: 'conv-2', title: 'Test Conversation 2' }),
  ];

  mockApiClient.listConversations.mockResolvedValue(mockConversations);

  const { result } = renderHook(() => useConversations());

  // Wait for the effect to run and complete
  await waitFor(() => {
    expect(mockApiClient.listConversations).toHaveBeenCalledTimes(1);
  });

  // Wait for loading to complete
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.conversations).toEqual(mockConversations);
  expect(result.current.error).toBe(null);
});
```

**Change To**:

```typescript
it('loads conversations on mount', async () => {
  const mockConversations = [
    createMockConversation({ id: 'conv-1', title: 'Test Conversation 1' }),
    createMockConversation({ id: 'conv-2', title: 'Test Conversation 2' }),
  ];

  mockApiClient.listConversations.mockResolvedValue(mockConversations);

  const { result } = renderHook(() => useConversations());

  // Wait for loading to start
  await waitFor(() => {
    expect(result.current.isLoading).toBe(true);
  });

  // Wait for loading to complete and data to be set
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual(mockConversations);
  });

  expect(mockApiClient.listConversations).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe(null);
});
```

**Rationale**: Better async handling ensures we wait for the complete loading cycle

**Expected Impact**: Test 1 should pass reliably

---

### Action 5: Fix Error Handling Tests (Tests 2-5)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Pattern**:

```typescript
it('handles loading error with proper ApiError wrapping', async () => {
  const mockError = new Error('Network connection failed');
  mockApiClient.listConversations.mockRejectedValue(mockError);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.conversations).toEqual([]);
  expect(result.current.error).toBeTruthy();
  // ... more assertions
});
```

**Change To**:

```typescript
it('handles loading error with proper ApiError wrapping', async () => {
  const mockError = new Error('Network connection failed');
  mockApiClient.listConversations.mockRejectedValue(mockError);

  const { result } = renderHook(() => useConversations());

  // Wait for error to be set
  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
  }, { timeout: 3000 });

  // Verify error state
  expect(result.current.isLoading).toBe(false);
  expect(result.current.conversations).toEqual([]);
  expect(result.current.error?.message).toBe(
    'Failed to load conversations: Network connection failed'
  );
  expect(result.current.error?.details).toEqual({
    originalError: 'Network connection failed',
  });
});
```

**Rationale**: Wait specifically for the error state to be set, with increased timeout

**Expected Impact**: Tests 2-5 should pass

---

### Action 6: Fix Create Conversation Test (Test 6)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('creates new conversation', async () => {
  const newConversation = createMockConversation({
    id: 'new-conv',
    title: 'New Conversation',
  });
  mockApiClient.listConversations.mockResolvedValue([]);
  mockApiClient.createConversation.mockResolvedValue(newConversation);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  const createdConversation = await result.current.createConversation();

  expect(createdConversation).toEqual(newConversation);
  expect(result.current.conversations).toEqual([newConversation]);
  expect(result.current.error).toBe(null);
  expect(mockApiClient.createConversation).toHaveBeenCalledTimes(1);
});
```

**Change To**:

```typescript
it('creates new conversation', async () => {
  const newConversation = createMockConversation({
    id: 'new-conv',
    title: 'New Conversation',
  });
  mockApiClient.listConversations.mockResolvedValue([]);
  mockApiClient.createConversation.mockResolvedValue(newConversation);

  const { result } = renderHook(() => useConversations());

  // Wait for initial load to complete
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  // Create conversation
  const createdConversation = await result.current.createConversation();

  // Wait for state to update
  await waitFor(() => {
    expect(result.current.conversations).toHaveLength(1);
  });

  expect(createdConversation).toEqual(newConversation);
  expect(result.current.conversations).toEqual([newConversation]);
  expect(result.current.error).toBe(null);
  expect(mockApiClient.createConversation).toHaveBeenCalledTimes(1);
});
```

**Rationale**: Wait for state updates after the async operation completes

**Expected Impact**: Test 6 should pass

---

### Action 7: Fix Delete Conversation Test (Test 8)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('deletes conversation', async () => {
  const conversations = [
    createMockConversation({ id: 'conv-1', title: 'Conversation 1' }),
    createMockConversation({ id: 'conv-2', title: 'Conversation 2' }),
  ];

  mockApiClient.listConversations.mockResolvedValue(conversations);
  mockApiClient.deleteConversation.mockResolvedValue(undefined);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.conversations).toEqual(conversations);
  });

  await result.current.deleteConversation('conv-1');

  expect(result.current.conversations).toEqual([conversations[1]]);
  expect(result.current.error).toBe(null);
  expect(mockApiClient.deleteConversation).toHaveBeenCalledWith('conv-1');
});
```

**Change To**:

```typescript
it('deletes conversation', async () => {
  const conversations = [
    createMockConversation({ id: 'conv-1', title: 'Conversation 1' }),
    createMockConversation({ id: 'conv-2', title: 'Conversation 2' }),
  ];

  mockApiClient.listConversations.mockResolvedValue(conversations);
  mockApiClient.deleteConversation.mockResolvedValue(undefined);

  const { result } = renderHook(() => useConversations());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.conversations).toEqual(conversations);
    expect(result.current.isLoading).toBe(false);
  });

  // Delete conversation
  await result.current.deleteConversation('conv-1');

  // Wait for state update
  await waitFor(() => {
    expect(result.current.conversations).toHaveLength(1);
  });

  expect(result.current.conversations).toEqual([conversations[1]]);
  expect(result.current.error).toBe(null);
  expect(mockApiClient.deleteConversation).toHaveBeenCalledWith('conv-1');
});
```

**Rationale**: Ensure initial load completes and wait for state updates after deletion

**Expected Impact**: Test 8 should pass

---

### Action 8: Apply Similar Pattern to Tests 9-11

**Files**: Same test file, tests for delete error, update title, and update title error

**Pattern**: Apply the same async handling pattern:

1. Wait for initial load to complete
2. Perform the operation
3. Wait for state updates
4. Assert final state

**Expected Impact**: Tests 9-11 should pass

---

### Action 9: Fix Retry Tests (Tests 12-13)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('retries loading conversations', async () => {
  mockApiClient.listConversations
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce([createMockConversation()]);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
  });

  await result.current.retry();

  await waitFor(() => {
    expect(result.current.error).toBe(null);
    expect(result.current.conversations).toHaveLength(1);
  });

  expect(mockApiClient.listConversations).toHaveBeenCalledTimes(2);
});
```

**Change To**:

```typescript
it('retries loading conversations', async () => {
  mockApiClient.listConversations
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce([createMockConversation()]);

  const { result } = renderHook(() => useConversations());

  // Wait for initial error
  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  }, { timeout: 3000 });

  // Retry
  await result.current.retry();

  // Wait for successful retry
  await waitFor(() => {
    expect(result.current.error).toBe(null);
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  }, { timeout: 3000 });

  expect(mockApiClient.listConversations).toHaveBeenCalledTimes(2);
});
```

**Rationale**: Ensure proper async handling for both error and retry states

**Expected Impact**: Tests 12-13 should pass

---

### Action 10: Fix ApiError Preservation Test (Test 14)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('preserves ApiError instances when they are thrown', async () => {
  const { ApiError } = await import('../../lib/api-client');
  const apiError = new ApiError('Custom API error', 500);
  mockApiClient.listConversations.mockRejectedValue(apiError);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.error).toBe(apiError);
    expect(result.current.error?.status).toBe(500);
  });
});
```

**Verification Needed**: Check if the hook properly preserves ApiError instances or wraps them

**Potential Issue**: The hook might be wrapping ApiError instances in new ApiError instances

**Fix in Hook** (if needed):

```typescript
// In loadConversations catch block
if (err instanceof ApiError) {
  apiError = err; // Don't wrap, just use it
} else if (err instanceof Error) {
  // ... wrap other errors
}
```

**Expected Impact**: Test 14 should pass

---

### Action 11: Fix Retry Status Test (Test 15)

**File**: `apps/frontend/src/hooks/__tests__/useConversations.test.ts`

**Current Code**:

```typescript
it('provides correct retry status based on error type', async () => {
  // Test with retryable error (network error)
  const networkError = new Error('fetch failed');
  mockApiClient.listConversations.mockRejectedValue(networkError);

  const { result } = renderHook(() => useConversations());

  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
    expect(result.current.isRetryable).toBe(true);
  });
});
```

**Change To**:

```typescript
it('provides correct retry status based on error type', async () => {
  // Test with retryable error (network error)
  const networkError = new Error('fetch failed');
  mockApiClient.listConversations.mockRejectedValue(networkError);

  const { result } = renderHook(() => useConversations());

  // Wait for error to be set
  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  }, { timeout: 3000 });

  // Check retry status
  expect(result.current.isRetryable).toBe(true);
});
```

**Rationale**: Ensure error is fully set before checking retry status

**Expected Impact**: Test 15 should pass

---

## Implementation Order

1. **Critical Path** (Do First):
   - Action 1: Fix useEffect dependency
   - Action 2: Verify loadConversations stability
   - Action 3: Add default mocks

2. **Foundation Tests** (Do Second):
   - Action 4: Fix test 1 (loads on mount)
   - Action 5: Fix tests 2-5 (error handling)

3. **CRUD Operations** (Do Third):
   - Action 6: Fix test 6 (create)
   - Action 7: Fix test 8 (delete)
   - Action 8: Fix tests 9-11 (delete error, update, update error)

4. **Advanced Features** (Do Last):
   - Action 9: Fix tests 12-13 (retry)
   - Action 10: Fix test 14 (ApiError preservation)
   - Action 11: Fix test 15 (retry status)

## Validation Steps

After each action:

1. Run the specific test(s) affected
2. Verify no new failures introduced
3. Check for act() warnings
4. Verify test execution time is reasonable

After all actions:

1. Run full test suite: `pnpm vitest --run src/hooks/__tests__/useConversations.test.ts`
2. Run 10 times to check for flakiness
3. Verify no act() warnings
4. Check code coverage

## Success Metrics

- ✅ All 15 tests pass
- ✅ No act() warnings
- ✅ Test execution < 15 seconds
- ✅ No flaky tests (10 consecutive successful runs)
- ✅ Code coverage > 80%

## Rollback Plan

If issues arise:

1. Revert changes in reverse order
2. Test after each revert
3. Identify the problematic change
4. Re-analyze and adjust approach
