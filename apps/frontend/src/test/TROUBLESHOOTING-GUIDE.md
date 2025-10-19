# Frontend Testing Troubleshooting Guide

## Common Test Failures and Solutions

### 1. Component Not Re-rendering After Mock Updates

#### Symptoms

- Mock state is updated but component doesn't reflect changes
- Tests expect updated UI but see stale content
- `waitFor` timeouts waiting for elements that should appear

#### Root Cause

Using static mocks that don't trigger React re-renders when state changes.

#### Solution

Use reactive mock system:

```typescript
// ❌ Static mock (doesn't trigger re-renders)
mockUseChat.mockReturnValue({ isLoading: true });

// ✅ Reactive mock (triggers re-renders)
await testContext.updateChat({ isLoading: true });
```

#### Example Fix

```typescript
// Before
it('should show loading state', () => {
  mockUseChat.mockReturnValue({ isLoading: true });
  render(<ChatInterface />);
  expect(screen.getByTestId('loading')).toBeInTheDocument(); // ❌ Fails
});

// After
it('should show loading state', async () => {
  await testContext.updateChat({ isLoading: true });
  testContext.renderComponent(<ChatInterface />);
  expect(screen.getByTestId('loading')).toBeInTheDocument(); // ✅ Works
});
```

### 2. Input Tests Producing Duplicate Text

#### Symptoms

- Typing "hello" results in "hellohello" in input
- Form submissions with wrong values
- Inconsistent input behavior

#### Root Cause

Input elements retaining previous values between test interactions.

#### Solution

Use `typeIntoInput` utility with automatic clearing:

```typescript
// ❌ Direct typing (may duplicate)
await user.type(input, 'test message');

// ✅ Input utility (clears first)
await typeIntoInput(input, 'test message', user);
```

#### Advanced Options

```typescript
// Don't clear existing text
await typeIntoInput(input, 'additional text', user, { clearFirst: false });

// Add delay between keystrokes
await typeIntoInput(input, 'slow typing', user, { delay: 100 });
```

### 3. Tests Stuck in Loading States

#### Symptoms

- `waitForLoadingToComplete` times out
- Components show loading spinners indefinitely
- Tests fail with "Loading did not complete within 3000ms"

#### Root Cause

Mock loading states not being properly cleared.

#### Solution

Ensure loading states are explicitly cleared:

```typescript
// ❌ Loading state never cleared
await testContext.updateChat({ isLoading: true });
// ... test logic ...
// Loading state still true!

// ✅ Explicitly clear loading state
await testContext.updateChat({ isLoading: true });
// ... test logic ...
await testContext.updateChat({ isLoading: false });
```

#### For Fixed Loading Mocks

```typescript
// Wait for loading to complete
await testHelpers.waitForLoadingToComplete();

// Or manually clear
testHelpers.mockState.chat.isLoading = false;
testHelpers.mockState.conversations.isLoading = false;
```

### 4. Error Messages Not Displaying

#### Symptoms

- Error states set in mocks but not visible in UI
- Tests looking for error text fail
- Components don't show error sections

#### Root Cause

1. Error not properly set in mock state
2. Component not re-rendering after error set
3. Error display logic issues

#### Solution

```typescript
// ✅ Set error and verify display
const error = new ApiError('Test error', 500);
await testContext.updateChat({ error });

testContext.renderComponent(<ChatInterface />);

await waitFor(() => {
  expect(screen.getByTestId('chat-error')).toBeInTheDocument();
  expect(screen.getByText('Test error')).toBeInTheDocument();
});
```

#### Check Error Display Logic

Ensure component shows errors correctly:

```typescript
// In component
{(error || conversationsError) && (
  <div data-testid="chat-error">
    <div>{error?.message || conversationsError?.message}</div>
  </div>
)}
```

### 5. Multiple Elements Found Errors

#### Symptoms

- "Found multiple elements with role 'button' and name /new/i"
- Tests fail when trying to click specific elements
- Ambiguous element selection

#### Root Cause

Multiple similar elements without unique identifiers.

#### Solution

Use more specific selectors:

```typescript
// ❌ Ambiguous selector
const button = screen.getByRole('button', { name: /new/i });

// ✅ More specific selector
const button = screen.getByTestId('new-conversation-button');

// ✅ Or use container scoping
const sidebar = screen.getByTestId('conversation-sidebar');
const button = within(sidebar).getByRole('button', { name: /new/i });
```

#### Add Unique Test IDs

```typescript
// In component
<button data-testid="new-conversation-button">
  New Conversation
</button>
```

### 6. Async Operations Not Completing

#### Symptoms

- `waitFor` timeouts
- Elements expected to appear never show up
- Async operations seem to hang

#### Root Cause

1. Not waiting for async operations
2. Mock promises not resolving
3. Incorrect async/await usage

#### Solution

```typescript
// ✅ Proper async handling
it('should handle async operation', async () => {
  const user = userEvent.setup();
  testContext.renderComponent(<MyComponent />);
  
  // Trigger async operation
  const button = screen.getByRole('button');
  await user.click(button);
  
  // Wait for result
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

#### Mock Promise Resolution

```typescript
// Ensure mock promises resolve
const mockAsyncFunction = vi.fn().mockResolvedValue('success');
```

### 7. Form Submission Not Working

#### Symptoms

- Form onSubmit not called
- Submit button clicks don't trigger submission
- Enter key doesn't submit form

#### Root Cause

1. Form not properly structured
2. Event handlers not attached
3. Form submission prevented

#### Solution

```typescript
// ✅ Proper form submission testing
await typeIntoInput(input, 'test message', user);

// Submit via Enter key
await submitForm(input, { viaEnterKey: true }, user);

// Or submit via button
const submitButton = screen.getByRole('button', { name: /send/i });
await submitForm(input, { viaButton: submitButton }, user);

// Verify submission
expect(mockSendMessage).toHaveBeenCalledWith('test message');
```

#### Check Form Structure

```typescript
// Ensure proper form structure
<form onSubmit={handleSubmit}>
  <input type="text" />
  <button type="submit">Submit</button>
</form>
```

### 8. Performance Issues

#### Symptoms

- Tests run slowly
- High memory usage
- Timeouts in CI/CD

#### Root Cause

1. Inefficient mock creation
2. Unnecessary DOM operations
3. No performance optimizations

#### Solution

Enable performance optimizations:

```typescript
// ✅ Enable optimizations
const testContext = setupTest({
  enablePerformanceOptimizations: true,
});

// Use optimized queries
import { optimizedScreen } from '@/test/dom-optimizer';
const element = optimizedScreen.getByTestId('my-element');
```

#### Monitor Performance

```bash
# Run with performance monitoring
PERF_MONITORING=true pnpm test

# Generate performance reports
GENERATE_PERF_REPORTS=true pnpm test
```

### 9. Mock Function Not Called

#### Symptoms

- `expect(mockFn).toHaveBeenCalled()` fails
- Mock functions show 0 calls
- Component interactions don't trigger mocks

#### Root Cause

1. Mock not properly connected
2. Component not triggering the function
3. Mock cleared between calls

#### Solution

```typescript
// ✅ Verify mock setup
const mockSendMessage = vi.fn();
await testContext.updateChat({ sendMessage: mockSendMessage });

// Trigger the action
await user.click(submitButton);

// Verify call
expect(mockSendMessage).toHaveBeenCalledTimes(1);
expect(mockSendMessage).toHaveBeenCalledWith('expected message');
```

#### Debug Mock Calls

```typescript
// Check what was called
console.log('Mock calls:', mockSendMessage.mock.calls);
console.log('Mock call count:', mockSendMessage.mock.calls.length);
```

### 10. Test Isolation Issues

#### Symptoms

- Tests pass individually but fail when run together
- State leaking between tests
- Inconsistent test results

#### Root Cause

1. Mocks not reset between tests
2. Global state not cleaned up
3. DOM not properly cleaned

#### Solution

```typescript
// ✅ Proper test isolation
describe('My Component', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest(); // Fresh context each test
  });

  afterEach(() => {
    cleanup(); // Clean up DOM
    vi.clearAllMocks(); // Clear all mocks
  });
});
```

## Debugging Techniques

### 1. DOM Inspection

```typescript
// Debug entire DOM
screen.debug();

// Debug specific element
const element = screen.getByTestId('my-element');
screen.debug(element);

// List all elements of a type
console.log('All buttons:', screen.getAllByRole('button'));
```

### 2. Mock State Inspection

```typescript
// Check current mock state
console.log('Chat state:', testContext.mocks.chat.getCurrentValue());

// Subscribe to state changes
testContext.mocks.chat.subscribe((state) => {
  console.log('Chat state changed:', state);
});
```

### 3. Performance Analysis

```typescript
// Enable detailed performance monitoring
process.env.PERF_MONITORING = 'true';
process.env.GENERATE_PERF_REPORTS = 'true';

// Check performance report after test run
// Report saved to test-performance-report.json
```

### 4. Network Mock Debugging

```typescript
// Log API calls
const mockApiCall = vi.fn().mockImplementation((url, options) => {
  console.log('API call:', url, options);
  return Promise.resolve(mockResponse);
});
```

### 5. Event Debugging

```typescript
// Log user events
const user = userEvent.setup({
  advanceTimers: vi.advanceTimersByTime,
  delay: null, // Remove delays for debugging
});

// Add event listeners for debugging
element.addEventListener('click', (e) => {
  console.log('Click event:', e);
});
```

## Environment-Specific Issues

### CI/CD Environment

#### Common Issues

- Tests timeout more frequently
- Different timing behavior
- Resource constraints

#### Solutions

```typescript
// Increase timeouts in CI
const timeout = process.env.CI ? 30000 : 15000;

// Reduce parallelism in CI
const maxThreads = process.env.CI ? 2 : 4;

// Use more reliable waits
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: process.env.CI ? 10000 : 5000 });
```

### Local Development

#### Common Issues

- Tests pass locally but fail in CI
- Inconsistent timing
- Cache issues

#### Solutions

```bash
# Clear test cache
pnpm test --clearCache

# Run tests in CI mode locally
CI=true pnpm test

# Use same Node version as CI
nvm use 18
```

## Quick Fixes Checklist

When a test fails, check these common issues:

- [ ] Are you using reactive mocks instead of static mocks?
- [ ] Are you awaiting async operations?
- [ ] Are you using `waitFor` for elements that appear asynchronously?
- [ ] Are you clearing input fields before typing?
- [ ] Are you properly cleaning up between tests?
- [ ] Are your selectors specific enough?
- [ ] Are loading states being cleared?
- [ ] Are error states being set correctly?
- [ ] Are mock functions properly connected?
- [ ] Are you using the correct test utilities?

## Getting Help

### Debug Information to Collect

When asking for help, provide:

1. **Test code** that's failing
2. **Error message** (full stack trace)
3. **DOM output** from `screen.debug()`
4. **Mock state** from `getCurrentValue()`
5. **Environment** (local vs CI, Node version, etc.)

### Performance Issues

For performance problems, provide:

1. **Performance report** (run with `GENERATE_PERF_REPORTS=true`)
2. **Test execution time** comparison
3. **Memory usage** if available
4. **Number of tests** and test file size

### Mock Issues

For mock-related problems, provide:

1. **Mock setup code**
2. **Expected vs actual** mock calls
3. **Component code** that should trigger mocks
4. **Mock state** before and after operations

This troubleshooting guide covers the most common issues encountered with the frontend testing infrastructure. Following these solutions should resolve most test failures and performance issues.
