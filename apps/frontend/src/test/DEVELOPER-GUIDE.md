# Frontend Testing Developer Guide

## Overview

This guide covers the comprehensive testing infrastructure built for the Dixie Chemical Product Agent frontend. The system provides reactive mocks, performance optimization, and reliable test execution.

## Quick Start

### Basic Test Setup

```typescript
import { setupTest } from '@/test/enhanced-setup';
import { render } from '@testing-library/react';

describe('My Component', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest();
  });

  it('should work correctly', async () => {
    // Update mock state
    await testContext.updateChat({ isLoading: false });
    
    // Render component
    testContext.renderComponent(<MyComponent />);
    
    // Test assertions
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

### Input Testing

```typescript
import { typeIntoInput, submitForm } from '@/test/input-utilities';

it('should handle form submission', async () => {
  const user = userEvent.setup();
  testContext.renderComponent(<ChatInterface />);
  
  const input = screen.getByPlaceholderText(/ask about/i);
  
  // Type into input (automatically clears first)
  await typeIntoInput(input, 'test message', user);
  
  // Submit form via Enter key
  await submitForm(input, { viaEnterKey: true }, user);
  
  // Verify submission
  expect(testContext.mocks.chat.sendMessage).toHaveBeenCalledWith('test message');
});
```

## Reactive Mock System

### Core Concepts

The reactive mock system ensures that mock state changes trigger React component re-renders, solving the common issue where tests fail because components don't update when mock data changes.

### ReactiveHookMock

```typescript
import { ReactiveHookMock } from '@/test/reactive-mocks';

// Create a reactive mock
const chatMock = new ReactiveHookMock({
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn(),
});

// Update state (triggers re-render)
await chatMock.updateValue({ isLoading: true });

// Use in test
mockUseChat.mockImplementation(chatMock.getMock());
```

### MockRegistry

```typescript
import { mockRegistry } from '@/test/reactive-mocks';

// Register mocks
mockRegistry.register('useChat', chatMock);
mockRegistry.register('useProducts', productsMock);

// Update by name
await mockRegistry.update('useChat', { error: new ApiError('Test error', 500) });

// Reset all mocks
mockRegistry.resetAll();
```

### Enhanced Setup Function

The `setupTest()` function provides a complete testing environment:

```typescript
const testContext = setupTest({
  // Optional: Custom initial state
  initialChatState: {
    messages: [mockMessage],
    isLoading: false,
  },
  
  // Optional: Performance optimizations
  enablePerformanceOptimizations: true,
});

// Available methods
await testContext.updateChat({ isLoading: true });
await testContext.updateProducts({ products: mockProducts });
await testContext.updateConversations({ conversations: mockConversations });

const { container } = testContext.renderComponent(<MyComponent />);
```

## Input Utilities

### typeIntoInput

Handles text input with proper clearing and timing:

```typescript
import { typeIntoInput } from '@/test/input-utilities';

// Basic usage
await typeIntoInput(inputElement, 'test text', user);

// With options
await typeIntoInput(inputElement, 'test text', user, {
  clearFirst: false,  // Don't clear existing text
  delay: 100,         // Delay between keystrokes
  skipClick: true,    // Don't click before typing
});
```

### submitForm

Handles form submission via different methods:

```typescript
import { submitForm } from '@/test/input-utilities';

// Submit via Enter key
await submitForm(inputElement, { viaEnterKey: true }, user);

// Submit via button click
const submitButton = screen.getByRole('button', { name: /send/i });
await submitForm(inputElement, { viaButton: submitButton }, user);
```

### waitForDebounce

Handles debounced operations:

```typescript
import { waitForDebounce } from '@/test/input-utilities';

// Wait for debounce with callback
await waitForDebounce(async () => {
  expect(mockSearchFunction).toHaveBeenCalledWith('search term');
}, 500); // 500ms delay
```

## Performance Optimization

### Lazy Mock System

Reduces mock creation overhead:

```typescript
import { getMock, returnMock } from '@/test/lazy-mock-system';

// Get a mock (created lazily)
const expensiveMock = getMock('expensiveOperation', () => createExpensiveMock());

// Return when done (for pooling)
returnMock('expensiveOperation', expensiveMock);
```

### DOM Optimization

Optimizes DOM queries:

```typescript
import { optimizedScreen } from '@/test/dom-optimizer';

// Use optimized queries (cached)
const element = optimizedScreen.getByTestId('my-element');
const button = optimizedScreen.getByRole('button', { name: /click me/i });
```

### Performance Monitoring

Track test performance:

```typescript
// Enable performance monitoring
process.env.PERF_MONITORING = 'true';

// Run tests with monitoring
pnpm test

// Generate performance report
process.env.GENERATE_PERF_REPORTS = 'true';
pnpm test
```

## Common Patterns

### Testing Error States

```typescript
it('should display error correctly', async () => {
  const error = new ApiError('Test error', 500);
  
  // Set error state
  await testContext.updateChat({ error });
  
  testContext.renderComponent(<ChatInterface />);
  
  // Verify error display
  await waitFor(() => {
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

### Testing Loading States

```typescript
it('should show loading state', async () => {
  // Set loading state
  await testContext.updateChat({ isLoading: true });
  
  testContext.renderComponent(<ChatInterface />);
  
  // Verify loading display
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Clear loading state
  await testContext.updateChat({ isLoading: false });
  
  // Verify loading cleared
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
});
```

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const user = userEvent.setup();
  testContext.renderComponent(<ChatInterface />);
  
  // Start async operation
  const input = screen.getByPlaceholderText(/ask about/i);
  await typeIntoInput(input, 'test message', user);
  await submitForm(input, { viaEnterKey: true }, user);
  
  // Verify loading state
  await waitFor(() => {
    expect(testContext.mocks.chat.isLoading).toBe(true);
  });
  
  // Complete async operation
  await testContext.updateChat({ 
    isLoading: false,
    messages: [...testContext.mocks.chat.messages, mockResponse]
  });
  
  // Verify completion
  await waitFor(() => {
    expect(screen.getByText('Response text')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

#### Tests Not Re-rendering After Mock Updates

**Problem**: Component doesn't update when mock state changes.

**Solution**: Use reactive mocks instead of static mocks:

```typescript
// ❌ Static mock (doesn't trigger re-renders)
mockUseChat.mockReturnValue({ isLoading: true });

// ✅ Reactive mock (triggers re-renders)
await testContext.updateChat({ isLoading: true });
```

#### Flaky Tests Due to Timing

**Problem**: Tests fail intermittently due to timing issues.

**Solution**: Use proper async utilities:

```typescript
// ❌ No waiting
expect(screen.getByText('Loaded')).toBeInTheDocument();

// ✅ Wait for element
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

#### Input Tests Failing

**Problem**: Text input tests produce unexpected results.

**Solution**: Use input utilities:

```typescript
// ❌ Direct user event (may duplicate text)
await user.type(input, 'test');

// ✅ Input utility (handles clearing)
await typeIntoInput(input, 'test', user);
```

#### Performance Issues

**Problem**: Tests run slowly.

**Solution**: Enable performance optimizations:

```typescript
// Enable optimizations
const testContext = setupTest({
  enablePerformanceOptimizations: true,
});

// Use optimized queries
import { optimizedScreen } from '@/test/dom-optimizer';
```

### Debugging Tips

#### Mock State Inspection

```typescript
// Check current mock state
console.log('Chat state:', testContext.mocks.chat.getCurrentValue());

// Subscribe to state changes
testContext.mocks.chat.subscribe((state) => {
  console.log('Chat state changed:', state);
});
```

#### Performance Analysis

```typescript
// Enable performance monitoring
process.env.PERF_MONITORING = 'true';

// Check slow tests
process.env.GENERATE_PERF_REPORTS = 'true';
```

#### DOM Debugging

```typescript
// Debug DOM state
screen.debug(); // Full DOM
screen.debug(screen.getByTestId('my-element')); // Specific element

// Check for elements
console.log('Available buttons:', screen.getAllByRole('button'));
```

## Migration Guide

### From Old Mock System

If you have existing tests using the old mock system:

```typescript
// ❌ Old approach
beforeEach(() => {
  mockUseChat.mockReturnValue({
    messages: [],
    isLoading: false,
    sendMessage: vi.fn(),
  });
});

// ✅ New approach
beforeEach(() => {
  testContext = setupTest({
    initialChatState: {
      messages: [],
      isLoading: false,
    },
  });
});
```

### From Static Mocks to Reactive Mocks

```typescript
// ❌ Static mock update
mockUseChat.mockReturnValue({ isLoading: true });

// ✅ Reactive mock update
await testContext.updateChat({ isLoading: true });
```

## Best Practices

### Test Organization

1. **Use descriptive test names** that explain the scenario
2. **Group related tests** in describe blocks
3. **Set up clean state** in beforeEach hooks
4. **Clean up** in afterEach hooks

### Mock Management

1. **Use reactive mocks** for state that changes during tests
2. **Reset mocks** between tests for isolation
3. **Verify mock calls** to ensure correct behavior
4. **Use realistic mock data** that matches production

### Async Testing

1. **Always await** async operations
2. **Use waitFor** for elements that appear asynchronously
3. **Set appropriate timeouts** for slow operations
4. **Handle loading states** explicitly

### Performance

1. **Enable optimizations** for large test suites
2. **Use lazy mocks** for expensive operations
3. **Monitor performance** regularly
4. **Optimize slow tests** identified by profiling

## Running Tests

### Basic Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/components/chat/ChatInterface.test.tsx

# Run tests in watch mode
pnpm test --watch

# Run with coverage
pnpm test --coverage
```

### Performance Commands

```bash
# Run with performance monitoring
PERF_MONITORING=true pnpm test

# Run optimized tests
pnpm run test:optimized

# Generate performance reports
GENERATE_PERF_REPORTS=true pnpm test

# Save performance baseline
SAVE_BASELINE=true pnpm test
```

### Debug Commands

```bash
# Run with verbose output
pnpm test --reporter=verbose

# Run single test with debugging
pnpm test --reporter=verbose src/path/to/test.tsx

# Run with DOM debugging
DEBUG=true pnpm test
```

## Configuration

### Vitest Configuration

Key settings in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    // Performance settings
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        isolate: true,
      },
    },
    
    // Environment
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Environment Variables

```bash
# Performance monitoring
PERF_MONITORING=true

# Enable optimizations
ENABLE_LAZY_MOCKS=true
ENABLE_DOM_OPTIMIZATION=true
ENABLE_PARALLEL_OPTIMIZATION=true

# Reporting
GENERATE_PERF_REPORTS=true
SAVE_BASELINE=true
```

## Support

For questions or issues:

1. Check this guide for common patterns
2. Review the troubleshooting section
3. Look at existing test examples
4. Check performance reports for optimization opportunities

The testing infrastructure is designed to be reliable, fast, and easy to use. Following these patterns will help ensure your tests are stable and maintainable.
