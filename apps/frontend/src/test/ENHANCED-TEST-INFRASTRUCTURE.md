# Enhanced Test Infrastructure

This document describes the enhanced test infrastructure that provides comprehensive reliability improvements for integration tests.

## Overview

The enhanced test infrastructure addresses the requirements for task 8 "Improve test infrastructure reliability" by implementing:

1. **Consistent Mock Reset Strategy** (Requirement 5.1, 5.3)
2. **Standardized Async Operation Handling** (Requirement 5.4)
3. **Enhanced Query Methods** (Requirement 5.5, 5.6)
4. **Comprehensive Debugging Utilities** (Requirement 5.6)

## Architecture

```
Enhanced Test Infrastructure
├── test-infrastructure.ts      # Core infrastructure with mock reset & setup
├── async-test-utils.ts         # Async operation handling utilities
├── query-utils.ts              # Standardized query methods with error handling
├── debug-utils.ts              # Comprehensive debugging utilities
└── enhanced-test-infrastructure.ts  # Integration layer
```

## Features

### 1. Consistent Mock Reset Strategy

**Files**: `test-infrastructure.ts`

- **Automatic Mock Reset**: All mocks are reset between tests using `beforeEach` and `afterEach` hooks
- **Proper Isolation**: Each test runs with clean mock state to prevent interference
- **Comprehensive Cleanup**: DOM, storage, timers, and async operations are all cleaned up
- **Mock Tracking**: Mock calls are tracked for debugging purposes

```typescript
// Automatic setup in beforeEach
beforeEach(() => {
  testInfrastructure.resetAllMocks();
  testInfrastructure.setupTestMocks();
});

// Automatic cleanup in afterEach
afterEach(async () => {
  await testInfrastructure.waitForAsyncOperations(1000);
  testInfrastructure.resetAllMocks();
});
```

### 2. Standardized Async Operation Handling

**Files**: `async-test-utils.ts`

- **Enhanced waitFor**: Better error handling and performance tracking
- **Async Element Queries**: `findByTestIdEnhanced`, `findByRoleEnhanced`, etc.
- **Controlled Async Mocks**: Create mocks that can be resolved/rejected manually
- **Timeout Management**: Proper timeout handling for slow operations
- **Retry Logic**: Automatic retry for flaky operations

```typescript
// Enhanced waitFor with better error messages
await enhancedWaitFor(
  () => {
    const element = screen.getByTestId('loading-spinner');
    if (element) throw new Error('Still loading');
    return true;
  },
  {
    timeout: 5000,
    operationName: 'loading completion',
  }
);

// Controlled async mock for testing
const { mockFn, resolve, reject } = createControlledAsyncMock<string>();
mockApiCall.mockImplementation(mockFn);

// Later in test...
resolve('success data');
```

### 3. Enhanced Query Methods

**Files**: `query-utils.ts`

- **Clear Error Messages**: Detailed error messages with suggestions
- **Query Type Guidance**: Use `getBy` for elements that should exist, `queryBy` for optional elements, `findBy` for async elements
- **Alternative Suggestions**: Suggest similar test IDs, roles, or text when queries fail
- **DOM Snapshots**: Include DOM state in error messages for debugging

```typescript
// Create enhanced queries for a component
const queries = createStandardizedQueries(renderResult, {
  testName: 'ChatInterface test',
  componentName: 'ChatInterface',
});

// Enhanced error messages with suggestions
try {
  const button = queries.getByTestId('submit-btn');
} catch (error) {
  // Error includes:
  // - Clear description of what failed
  // - Suggestions for similar test IDs
  // - Available roles and elements
  // - DOM snapshot for debugging
}

// Async queries with timeout handling
const asyncElement = await queries.findByTestId('async-content', {
  timeout: 3000,
  errorContext: 'waiting for API response',
});
```

### 4. Comprehensive Debugging Utilities

**Files**: `debug-utils.ts`

- **Component State Logging**: Track component state changes during tests
- **Mock Call Inspection**: Detailed history of all mock function calls
- **Async Operation Timing**: Track performance of async operations
- **Failure Snapshots**: Comprehensive debug information when tests fail

```typescript
// Log component state at key points
logComponentState('After user clicks submit', {
  componentName: 'ChatInterface',
  props: { messages: [...] },
  domElement: container,
});

// Register mocks for detailed inspection
registerMock('useChat', mockUseChat);

// Time async operations
const { result, duration } = await timeAsyncOperation(
  'API call',
  () => apiClient.sendMessage('test')
);

// Create failure snapshot
const snapshot = createFailureSnapshot(testName, error, {
  userAction: 'clicking submit button',
  expectedBehavior: 'message should be sent',
});
```

## Usage

### Basic Setup

The enhanced infrastructure is automatically initialized when you import the test setup:

```typescript
// In your test file
import { render, screen } from '@testing-library/react';
import { setupEnhancedTest } from '@/test/enhanced-test-infrastructure';

describe('MyComponent', () => {
  const { enhancedRender, logState, timeOperation } = setupEnhancedTest();

  it('should work correctly', async () => {
    const renderResult = render(<MyComponent />);
    const enhanced = enhancedRender(renderResult);

    // Use enhanced utilities
    await enhanced.waitForElement('submit-button');
    enhanced.logState('After component mount');
    
    const { result } = await enhanced.timeOperation('user interaction', async () => {
      // Perform user interaction
    });
  });
});
```

### Advanced Configuration

You can customize the infrastructure behavior:

```typescript
const { infrastructure, utils } = setupEnhancedTest({
  debug: {
    enableComponentStateLogging: true,
    enableMockInspection: true,
    logLevel: 'debug',
  },
  async: {
    defaultTimeout: 10000,
    maxRetries: 5,
  },
  queries: {
    enableSuggestions: true,
    enableDOMSnapshot: true,
  },
});
```

### Integration with Existing Tests

The enhanced infrastructure is designed to work with existing tests with minimal changes:

```typescript
// Before (standard approach)
it('should display messages', async () => {
  render(<ChatInterface />);
  
  await waitFor(() => {
    expect(screen.getByTestId('message-1')).toBeInTheDocument();
  });
});

// After (enhanced approach)
it('should display messages', async () => {
  const renderResult = render(<ChatInterface />);
  const { queries } = createStandardizedQueries(renderResult);
  
  // Better error messages and debugging if this fails
  const message = await queries.findByTestId('message-1');
  expect(message).toBeInTheDocument();
});
```

## Configuration Options

### Test Infrastructure Config

```typescript
interface TestInfrastructureConfig {
  mockReset: {
    resetBetweenTests: boolean;      // Reset mocks between tests
    resetBetweenSuites: boolean;     // Reset mocks between test suites
    clearCallHistory: boolean;       // Clear mock call history
  };
  
  asyncHandling: {
    defaultTimeout: number;          // Default timeout for async operations
    maxRetries: number;              // Max retries for flaky operations
    enableActWrapper: boolean;       // Wrap async operations in act()
  };
  
  performance: {
    enableMonitoring: boolean;       // Track test performance
    warnThreshold: number;           // Warn if test takes longer than this
    errorThreshold: number;          // Error if test takes longer than this
  };
}
```

### Debug Config

```typescript
interface DebugConfig {
  enableComponentStateLogging: boolean;  // Log component state changes
  enableMockInspection: boolean;         // Track mock function calls
  enableTimingDebug: boolean;            // Track async operation timing
  enableDOMInspection: boolean;          // Include DOM snapshots in errors
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}
```

## Best Practices

### 1. Use Appropriate Query Methods

```typescript
// ✅ Use getBy for elements that should exist
const submitButton = queries.getByTestId('submit-button');

// ✅ Use queryBy for elements that may not exist
const errorMessage = queries.queryByTestId('error-message');
if (errorMessage) {
  // Handle error case
}

// ✅ Use findBy for elements that appear asynchronously
const loadedContent = await queries.findByTestId('loaded-content');
```

### 2. Log State at Key Points

```typescript
it('should handle user interaction', async () => {
  const { enhanced } = setupEnhancedTest();
  
  enhanced.logState('Initial render');
  
  // Perform user action
  await userEvent.click(submitButton);
  enhanced.logState('After user click');
  
  // Wait for response
  await enhanced.waitForData(() => messages);
  enhanced.logState('After data loaded');
});
```

### 3. Use Controlled Mocks for Complex Scenarios

```typescript
it('should handle loading states', async () => {
  const { resolve, reject } = createControlledAsyncMock<Message[]>();
  mockApiCall.mockImplementation(() => resolve);
  
  render(<ChatInterface />);
  
  // Verify loading state
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Resolve the promise
  resolve([{ id: '1', content: 'Hello' }]);
  
  // Verify loaded state
  await screen.findByText('Hello');
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
});
```

### 4. Time Performance-Critical Operations

```typescript
it('should respond quickly to user input', async () => {
  const { timeOperation } = setupEnhancedTest();
  
  const { duration } = await timeOperation('message sending', async () => {
    await userEvent.type(input, 'Hello world');
    await userEvent.click(submitButton);
    await screen.findByText('Hello world');
  });
  
  // Assert performance requirement
  expect(duration).toBeLessThan(1000); // Should complete within 1 second
});
```

## Troubleshooting

### Common Issues

1. **Tests timing out**: Check async operation timeouts and increase if necessary
2. **Flaky tests**: Use controlled mocks and proper waiting strategies
3. **Mock interference**: Ensure mocks are properly reset between tests
4. **Memory leaks**: Check that async operations are properly cleaned up

### Debug Information

When tests fail, the enhanced infrastructure provides comprehensive debug information:

- Component state history
- Mock call history with arguments and return values
- Async operation timing
- DOM snapshots at failure points
- Performance metrics

### Performance Monitoring

The infrastructure tracks test performance and warns about slow operations:

- Tests taking longer than 2 seconds trigger warnings
- Tests taking longer than 5 seconds trigger errors
- Async operations are timed and reported
- Memory usage is tracked (when available)

## Migration Guide

### From Standard Testing Library

1. **Replace basic queries with enhanced queries**:

   ```typescript
   // Before
   const element = screen.getByTestId('my-element');
   
   // After
   const queries = createStandardizedQueries(renderResult);
   const element = queries.getByTestId('my-element');
   ```

2. **Replace waitFor with enhanced waitFor**:

   ```typescript
   // Before
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   
   // After
   await enhancedWaitFor(
     () => screen.getByText('Loaded'),
     { operationName: 'content loading' }
   );
   ```

3. **Add state logging for debugging**:

   ```typescript
   // Add at key points in your tests
   logComponentState('After user interaction', {
     componentName: 'MyComponent',
     additionalData: { userAction: 'click submit' },
   });
   ```

### From Existing Mock Setup

1. **Register mocks for debugging**:

   ```typescript
   // After creating mocks
   registerMock('useChat', mockUseChat);
   registerMock('useProducts', mockUseProducts);
   ```

2. **Use controlled mocks for complex scenarios**:

   ```typescript
   // Replace simple mocks with controlled ones
   const { mockFn, resolve, reject } = createControlledAsyncMock();
   mockApiCall.mockImplementation(mockFn);
   ```

## Files Reference

- **`test-infrastructure.ts`**: Core infrastructure with mock management
- **`async-test-utils.ts`**: Async operation utilities and enhanced waitFor
- **`query-utils.ts`**: Standardized query methods with error enhancement
- **`debug-utils.ts`**: Debugging utilities for component state and mock inspection
- **`enhanced-test-infrastructure.ts`**: Integration layer that combines all utilities
- **`setup.ts`**: Main test setup file that initializes the infrastructure

## Requirements Fulfilled

- ✅ **5.1**: Consistent mock reset strategy with proper isolation
- ✅ **5.2**: Standardized mock factory functions and test utilities
- ✅ **5.3**: Proper mock isolation between tests with comprehensive cleanup
- ✅ **5.4**: Enhanced async operation handling with waitFor and findBy queries
- ✅ **5.5**: Standardized query methods with appropriate usage patterns
- ✅ **5.6**: Clear error messages and debugging utilities for test failures
- ✅ **5.7**: Consistent patterns and best practices for reliable tests
