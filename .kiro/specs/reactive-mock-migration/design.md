# Reactive Mock Migration - Technical Design

## Overview

This design provides a systematic approach to migrate the remaining ~17 failing tests from static mocks to reactive mocks, achieving the ≥95% pass rate target. The reactive mock infrastructure is already implemented and proven effective - this design focuses on the migration strategy, patterns, and specific fixes needed for each test category.

## Current State Analysis

### Test Suite Status

- **Total Tests:** ~87 tests
- **Currently Passing:** ~23 tests (55% pass rate)
- **Currently Failing:** ~17 tests (need migration)
- **Target:** ≥83 tests passing (95% pass rate)
- **Performance:** Excellent (~4-7 seconds execution time)

### Root Cause Identified

The core issue is **mock synchronization**: static mocks don't trigger React re-renders when state changes.

```typescript
// ❌ CURRENT PROBLEM: Static mocks don't trigger re-renders
mockUseChat.mockReturnValue({ error: new ApiError('Test error', 500) });
render(<ChatInterface />);
// Component renders once with initial state, never updates when mock changes

// ✅ SOLUTION: Reactive mocks trigger re-renders
await testContext.updateChat({ error: new ApiError('Test error', 500) });
testContext.renderComponent(<ChatInterface />);
// Component automatically re-renders when mock state changes
```

## Architecture Overview

### Migration Strategy Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration Process                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              1. Static Mock Detection                        │
│  • Scan for mockReturnValue patterns                       │
│  • Identify setupFixedLoadingMocks usage                   │
│  • Find manual mock state assignments                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              2. Pattern Replacement                          │
│  • Replace static patterns with reactive equivalents       │
│  • Update test setup to use setupTest()                    │
│  • Convert assertions to use reactive patterns             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              3. Component Integration Fix                    │
│  • Ensure components respond to reactive mock changes      │
│  • Fix error display and loading state handling            │
│  • Update test IDs and selectors as needed                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              4. Validation & Performance                     │
│  • Run migrated tests to verify functionality              │
│  • Monitor performance impact                              │
│  • Ensure no regressions in passing tests                  │
└─────────────────────────────────────────────────────────────┘
```

## Migration Patterns

### 1. Static Mock to Reactive Mock Migration

#### Pattern 1: Basic Hook Mock Migration

```typescript
// ❌ BEFORE: Static mock pattern
describe('Component Test', () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: vi.fn(),
    });
  });

  it('should show error state', () => {
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      error: new ApiError('Test error', 500),
      sendMessage: vi.fn(),
    });
    
    render(<ChatInterface />);
    // ❌ Component doesn't re-render, test fails
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});

// ✅ AFTER: Reactive mock pattern
describe('Component Test', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest();
  });

  it('should show error state', async () => {
    await testContext.updateChat({
      error: new ApiError('Test error', 500)
    });
    
    testContext.renderComponent(<ChatInterface />);
    // ✅ Component re-renders automatically, test passes
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

#### Pattern 2: Loading State Migration

```typescript
// ❌ BEFORE: Loading state stuck
it('should show loading state', async () => {
  mockUseChat.mockReturnValue({ isLoading: true });
  render(<ChatInterface />);
  
  // ❌ Component doesn't show loading because no re-render
  expect(screen.getByTestId('loading')).toBeInTheDocument();
  
  // Later in test - loading never clears
  await waitForLoadingToComplete(); // ❌ Times out after 3000ms
});

// ✅ AFTER: Reactive loading state
it('should show loading state', async () => {
  await testContext.updateChat({ isLoading: true });
  testContext.renderComponent(<ChatInterface />);
  
  // ✅ Component shows loading immediately
  expect(screen.getByTestId('loading')).toBeInTheDocument();
  
  // Clear loading state
  await testContext.updateChat({ isLoading: false });
  // ✅ Component hides loading immediately
  await waitFor(() => {
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });
});
```

#### Pattern 3: Integration Test Migration

```typescript
// ❌ BEFORE: Multi-step flow broken
it('should handle chat flow', async () => {
  const mockSendMessage = vi.fn();
  mockUseChat.mockReturnValue({
    messages: [],
    sendMessage: mockSendMessage,
    isLoading: false,
  });
  
  render(<ChatInterface />);
  
  const input = screen.getByRole('textbox');
  await user.type(input, 'test message');
  await user.keyboard('{Enter}');
  
  // ❌ Mock state changes but component doesn't update
  mockUseChat.mockReturnValue({
    messages: [{ id: '1', content: 'test message' }],
    isLoading: false,
  });
  
  // ❌ Component still shows empty messages
  expect(screen.getByText('test message')).toBeInTheDocument();
});

// ✅ AFTER: Reactive integration flow
it('should handle chat flow', async () => {
  const mockSendMessage = vi.fn().mockImplementation(async (content) => {
    // Simulate loading
    await testContext.updateChat({ isLoading: true });
    
    // Simulate response
    await testContext.updateChat({
      isLoading: false,
      messages: [{ id: '1', content, role: 'user' }]
    });
  });

  await testContext.updateChat({ sendMessage: mockSendMessage });
  testContext.renderComponent(<ChatInterface />);
  
  const input = screen.getByRole('textbox');
  await typeIntoInput(input, 'test message', user);
  await submitForm(input, { viaEnterKey: true }, user);
  
  // ✅ Component automatically updates to show message
  await waitFor(() => {
    expect(screen.getByText('test message')).toBeInTheDocument();
  });
});
```

### 2. Component-Specific Migration Patterns

#### Error Handling Components

```typescript
// Fix ApiErrorDisplay to respond to reactive props
export function ApiErrorDisplay({ error }: { error: ApiError | null }) {
  // ✅ Ensure component re-renders when error prop changes
  const [displayError, setDisplayError] = useState(error);
  
  useEffect(() => {
    setDisplayError(error);
  }, [error]);

  if (!displayError) return null;

  return (
    <div data-testid="api-error-display">
      <div data-testid="error-message">{displayError.message}</div>
      {displayError.isRetryable() && (
        <button data-testid="retry-button">Retry</button>
      )}
    </div>
  );
}
```

#### Loading State Components

```typescript
// Fix loading components to respond to reactive state
export function LoadingSpinner({ testId }: { testId?: string }) {
  return (
    <div data-testid={testId || 'loading-spinner'}>
      <div className="animate-spin">Loading...</div>
    </div>
  );
}

// Use unique test IDs to prevent conflicts
export function ProductBrowser() {
  if (productsLoading) {
    return <LoadingSpinner testId="products-loading" />;
  }
  // ... rest of component
}
```

## Specific Test File Migration Plans

### 1. Error Handling Tests (`error-handling.test.tsx`)

**Current Issues:**

- Unable to find "Invalid input" and "Network error" messages
- Components not re-rendering when error state changes

**Migration Strategy:**

```typescript
// Replace setupFixedLoadingMocks with setupTest
const testContext = setupTest();

// Set error state reactively
await testContext.updateChat({ 
  error: new ApiError('Invalid input', 400) 
});

testContext.renderComponent(<ChatInterface />);

// Component automatically re-renders to show error
await waitFor(() => {
  expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid input');
});
```

### 2. Loading State Tests (`loading-state-fixes.test.tsx`)

**Current Issues:**

- "Found multiple elements with role 'button' and name /new/i"
- Loading states timing out after 3000ms

**Migration Strategy:**

```typescript
// Use unique test IDs to prevent conflicts
const testContext = setupTest();

// Set loading state reactively
await testContext.updateChat({ isLoading: true });
testContext.renderComponent(<ChatInterface />);

// Verify loading state appears
expect(screen.getByTestId('chat-loading')).toBeInTheDocument();

// Clear loading state
await testContext.updateChat({ isLoading: false });

// Verify loading state disappears
await waitFor(() => {
  expect(screen.queryByTestId('chat-loading')).not.toBeInTheDocument();
});
```

### 3. Product Browser Tests (`ProductBrowser.test.tsx`)

**Current Issues:**

- Cannot find combobox with name /family/i
- Product filtering not working correctly

**Migration Strategy:**

```typescript
// Set up products with reactive mocks
await testContext.updateProducts({
  products: mockProducts,
  productsLoading: false,
  productsError: null
});

testContext.renderComponent(<ProductBrowser />);

// Use more specific selectors
const familySelect = screen.getByTestId('product-family-filter');
await user.click(familySelect);

// Update filter state reactively
await testContext.updateProducts({
  products: filteredProducts
});

// Component automatically shows filtered results
expect(screen.getByText('Filtered Product')).toBeInTheDocument();
```

### 4. Chat Flow Integration (`chat-flow.test.tsx`)

**Current Issues:**

- Message sending not working properly
- Conversation state not updating

**Migration Strategy:**

```typescript
// Set up reactive message sending
const mockSendMessage = vi.fn().mockImplementation(async (content) => {
  await testContext.updateChat({ isLoading: true });
  
  // Simulate API response
  setTimeout(async () => {
    await testContext.updateChat({
      isLoading: false,
      messages: [...currentMessages, { id: Date.now().toString(), content, role: 'user' }]
    });
  }, 100);
});

await testContext.updateChat({ sendMessage: mockSendMessage });
testContext.renderComponent(<ChatInterface />);

// Use input utilities for reliable typing
const input = screen.getByRole('textbox');
await typeIntoInput(input, 'test message', user);
await submitForm(input, { viaEnterKey: true }, user);

// Wait for message to appear
await waitFor(() => {
  expect(screen.getByText('test message')).toBeInTheDocument();
});
```

## Migration Automation Tools

### 1. Static Mock Detection Script

```typescript
// Automated detection of static mock patterns
export function detectStaticMocks(filePath: string): StaticMockPattern[] {
  const content = readFileSync(filePath, 'utf-8');
  const patterns: StaticMockPattern[] = [];
  
  // Detect mockReturnValue patterns
  const mockReturnValueRegex = /mock\w+\.mockReturnValue\(/g;
  let match;
  while ((match = mockReturnValueRegex.exec(content)) !== null) {
    patterns.push({
      type: 'mockReturnValue',
      line: getLineNumber(content, match.index),
      pattern: match[0]
    });
  }
  
  // Detect setupFixedLoadingMocks
  if (content.includes('setupFixedLoadingMocks')) {
    patterns.push({
      type: 'setupFixedLoadingMocks',
      line: getLineNumber(content, content.indexOf('setupFixedLoadingMocks')),
      pattern: 'setupFixedLoadingMocks'
    });
  }
  
  return patterns;
}
```

### 2. Migration Helper Script

```typescript
// Automated migration assistance
export function generateMigrationSuggestions(
  filePath: string,
  patterns: StaticMockPattern[]
): MigrationSuggestion[] {
  return patterns.map(pattern => {
    switch (pattern.type) {
      case 'mockReturnValue':
        return {
          original: pattern.pattern,
          replacement: 'await testContext.updateChat(',
          explanation: 'Replace static mock with reactive mock update'
        };
      
      case 'setupFixedLoadingMocks':
        return {
          original: 'setupFixedLoadingMocks',
          replacement: 'setupTest',
          explanation: 'Replace fixed mocks with reactive test context'
        };
      
      default:
        return {
          original: pattern.pattern,
          replacement: '// TODO: Manual migration needed',
          explanation: 'Pattern requires manual migration'
        };
    }
  });
}
```

## Performance Considerations

### 1. Reactive Mock Overhead

**Current Performance:** ~4-7 seconds (excellent)
**Expected Impact:** ≤10% increase (still excellent)

**Optimization Strategies:**

- Batch mock updates where possible
- Use lazy initialization for complex mock objects
- Minimize unnecessary re-renders through careful state management

### 2. Memory Management

```typescript
// Ensure proper cleanup to prevent memory leaks
export function setupTest(): TestContext {
  const cleanup = () => {
    mockRegistry.resetAll();
    // Clear any pending timeouts
    vi.clearAllTimers();
    // Unsubscribe from all listeners
    cleanupSubscriptions();
  };

  // Auto-cleanup after each test
  afterEach(cleanup);
  
  return testContext;
}
```

## Validation Strategy

### 1. Migration Validation Process

For each migrated test file:

1. **Before Migration:** Record current pass/fail status
2. **After Migration:** Verify improved pass rate
3. **Regression Check:** Ensure no previously passing tests now fail
4. **Performance Check:** Verify execution time remains acceptable

### 2. Success Metrics Tracking

```typescript
// Track migration progress
interface MigrationMetrics {
  totalTests: number;
  passingBefore: number;
  passingAfter: number;
  improvementCount: number;
  regressionCount: number;
  executionTimeBefore: number;
  executionTimeAfter: number;
}

// Generate migration report
export function generateMigrationReport(
  beforeMetrics: TestMetrics,
  afterMetrics: TestMetrics
): MigrationReport {
  return {
    passRateImprovement: afterMetrics.passRate - beforeMetrics.passRate,
    testsFixed: afterMetrics.passing - beforeMetrics.passing,
    performanceImpact: afterMetrics.executionTime - beforeMetrics.executionTime,
    success: afterMetrics.passRate >= 0.95
  };
}
```

## Risk Mitigation

### 1. Incremental Migration Strategy

- Migrate one test file at a time
- Validate each migration before proceeding
- Maintain rollback capability for each step
- Run full test suite after each migration

### 2. Performance Monitoring

- Continuous performance tracking during migration
- Alert if execution time increases >20%
- Profile slow tests and optimize as needed
- Maintain performance baseline throughout migration

### 3. Regression Prevention

- Run full test suite after each migration
- Track previously passing tests for regressions
- Automated validation of migration success
- Clear rollback procedures if issues arise

## Success Criteria

The migration is considered successful when:

1. **Pass Rate:** ≥95% achieved (≥83/87 tests passing)
2. **Performance:** Execution time remains ≤90 seconds (currently ~4-7s)
3. **Reliability:** Zero flaky tests across 10 consecutive runs
4. **Coverage:** 100% of tests migrated to reactive mock system
5. **Functionality:** All error handling, loading states, and integration flows working correctly

This design provides a systematic, low-risk approach to achieving the 95% pass rate target while maintaining the excellent performance and reliability of the test suite.
