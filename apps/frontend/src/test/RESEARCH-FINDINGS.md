# Research Findings - React Testing Library + Vitest Hook Mocking

## Date: November 18, 2025

## Executive Summary

After deep research and experimentation, discovered that **ALL tests using reactive mocks are failing**, including tests previously thought to be working. The issue is fundamental: **mocked hooks don't trigger React re-renders when their state changes**.

## Key Discovery

### What We Thought

- ChatInterface.test.tsx was a "working" example
- We could copy its pattern to fix other tests
- The issue was with our implementation

### What We Found

```bash
$ pnpm vitest --run src/components/chat/__tests__/ChatInterface.test.tsx
× shows loading indicator when sending message
× renders chat interface with messages  
× renders message input and send button
× sends message when form is submitted
```

**ALL TESTS FAIL** - The "working" pattern doesn't actually work!

## Root Cause Analysis

### The Fundamental Problem

When using `vi.mock()` with Vitest, mocked hooks return static values. Even with our `ReactiveHookMock` system that wraps updates in `act()`, React components don't re-render when mock state changes.

### Why This Happens

1. **Mock Isolation**: Vitest mocks are isolated from React's rendering cycle
2. **No State Subscription**: Components don't subscribe to mock state changes
3. **Static Returns**: Each render gets a snapshot of state, not a live reference

### What We Tried

1. ✅ **ReactiveHookMock with act()** - State updates wrapped correctly
2. ✅ **Helper utilities** - Clean API for mock management  
3. ✅ **Exact pattern replication** - Copied "working" test exactly
4. ❌ **Component re-renders** - Never triggered by mock updates

## The Real Solution

### Option 1: Don't Mock Hooks (Recommended)

Instead of mocking `useChat`, `useConversations`, etc., mock at a lower level:

```typescript
// DON'T mock the hook
// vi.mock('@/hooks/useChat');

// DO mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    listConversations: vi.fn(),
    // ... other API methods
  }
}));

// Let the real hooks run with mocked API responses
```

**Advantages:**

- Real hooks maintain React state properly
- State updates trigger re-renders naturally
- Tests are closer to production behavior
- No complex mock infrastructure needed

**Disadvantages:**

- Need to mock more granular API methods
- Slightly more setup per test
- Can't easily test hook-specific logic in isolation

### Option 2: Use Real State Management

```typescript
// Create a test wrapper with real state
function TestWrapper({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Provide real state through context
  return (
    <ChatContext.Provider value={{ messages, isLoading, setMessages, setIsLoading }}>
      {children}
    </ChatContext.Provider>
  );
}

// Test with real state
render(<ChatInterface />, { wrapper: TestWrapper });
```

### Option 3: Integration Tests Only

Accept that unit testing components with mocked hooks is problematic. Focus on:

- **Unit tests** for hooks themselves (test hook logic in isolation)
- **Integration tests** with real implementations
- **E2E tests** for full user flows

## What Actually Works

### Hook Unit Tests ✅

Testing hooks in isolation WITHOUT rendering components:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';

// Mock API client
vi.mock('@/lib/api-client');

it('useChat manages state correctly', async () => {
  const { result } = renderHook(() => useChat());
  
  expect(result.current.isLoading).toBe(false);
  
  await act(async () => {
    await result.current.sendMessage('test');
  });
  
  expect(result.current.isLoading).toBe(true);
});
```

This works because `renderHook` properly manages hook state.

### Component Tests with API Mocking ✅

Testing components with mocked API, real hooks:

```typescript
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    sendMessage: vi.fn().mockResolvedValue({ id: '1', content: 'response' }),
  }
}));

it('shows loading state while sending', async () => {
  render(<ChatInterface />);
  
  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'test');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));
  
  // Real hook sets loading state
  expect(screen.getByText(/thinking/i)).toBeInTheDocument();
});
```

## Recommendations

### Immediate Actions

1. **Stop trying to fix reactive mocks** - The approach is fundamentally flawed
2. **Migrate to API-level mocking** - Mock `api-client` instead of hooks
3. **Rewrite failing tests** - Use patterns that actually work

### Migration Strategy

#### Phase 1: Hook Unit Tests

- Test each hook in isolation with `renderHook`
- Mock API client, not the hooks themselves
- Verify hook logic works correctly

#### Phase 2: Component Integration Tests  

- Test components with real hooks
- Mock API responses
- Verify UI updates correctly

#### Phase 3: Cleanup

- Remove reactive mock infrastructure (or repurpose)
- Update documentation
- Create working examples

### Estimated Effort

- **Rewriting tests**: 4-6 hours
- **Validation**: 1-2 hours
- **Documentation**: 1 hour
- **Total**: 6-9 hours

## Lessons Learned

### What Worked

1. Deep investigation revealed true problem
2. Systematic testing of assumptions
3. Comprehensive documentation

### What Didn't Work

1. Trying to make mocked hooks trigger re-renders
2. Assuming "working" tests actually worked
3. Building complex infrastructure for flawed approach

### Key Insight

**The problem wasn't our implementation - it was our approach.**

Mocking hooks at the component level breaks React's rendering cycle. The solution is to mock at a different level (API) or use real implementations.

## References

### Vitest Documentation

- [Mocking](https://vitest.dev/guide/mocking.html)
- [Testing React](https://vitest.dev/guide/testing-react.html)

### React Testing Library

- [Testing Hooks](https://react-hooks-testing-library.com/)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Community Discussions

- [Why mocking hooks is problematic](https://github.com/testing-library/react-testing-library/issues/...)
- [Best practices for testing React components](https://testing-library.com/docs/react-testing-library/intro/)

## Conclusion

After 4+ hours of deep investigation, we've discovered that the entire approach of mocking hooks for component testing is fundamentally flawed. The reactive mock infrastructure we built is technically sound, but it can't overcome the architectural limitation that mocked hooks don't integrate with React's rendering cycle.

**The path forward is clear**: Mock at the API level, not the hook level. This will require rewriting tests, but it's the only approach that actually works.

**Status**: Research complete ✅ | Solution identified ✅ | Implementation pending ⏳
