# Design Document: Comprehensive Frontend Test Suite Fix

## Overview

This design addresses the systematic resolution of 233 failing frontend tests by implementing a React-aware mock infrastructure, fixing user input event handling, and consolidating test utilities into a unified system. The solution focuses on making mock state changes trigger React re-renders and ensuring component integration tests accurately reflect real-world behavior.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Execution Layer                     │
│  (Vitest + React Testing Library + User Event)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Reactive Mock Infrastructure                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ReactiveHookMock<T>                                 │  │
│  │  - Manages hook state with React awareness          │  │
│  │  - Triggers re-renders via act()                    │  │
│  │  - Provides updateValue() for state changes         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MockRegistry                                        │  │
│  │  - Central registry for all mocks                   │  │
│  │  - Handles lifecycle and cleanup                    │  │
│  │  - Provides isolation between tests                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Standardized Mock Factories                     │
│  - createMockUseChat()                                      │
│  - createMockUseProducts()                                  │
│  - createMockUseConversations()                             │
│  - createMockApiClient()                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Component Tests                             │
│  - Unit Tests (isolated components)                         │
│  - Integration Tests (component interactions)               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. ReactiveHookMock Class

**Purpose**: Manages mock hook state with React awareness, ensuring state changes trigger component re-renders.

**Interface**:

```typescript
class ReactiveHookMock<T> {
  constructor(initialValue: T);
  
  // Update mock state and trigger re-renders
  updateValue(newValue: Partial<T>): void;
  
  // Get the Vitest mock function
  getMock(): MockedFunction<() => T>;
  
  // Get current value without triggering updates
  getCurrentValue(): T;
  
  // Reset to initial value
  reset(): void;
  
  // Subscribe to value changes (for debugging)
  subscribe(callback: (value: T) => void): () => void;
}
```

**Key Design Decisions**:

- Uses React's `act()` to wrap all state updates
- Maintains internal state that persists across mock calls
- Provides type-safe partial updates via `Partial<T>`
- Supports subscription pattern for debugging and testing

### 2. MockRegistry

**Purpose**: Central registry for managing all mocks, handling lifecycle, and ensuring proper cleanup.

**Interface**:

```typescript
class MockRegistry {
  // Register a new reactive mock
  register<T>(name: string, mock: ReactiveHookMock<T>): void;
  
  // Get a registered mock by name
  get<T>(name: string): ReactiveHookMock<T> | undefined;
  
  // Update a mock by name
  update<T>(name: string, value: Partial<T>): void;
  
  // Reset all mocks to initial values
  resetAll(): void;
  
  // Clear all mocks (for test cleanup)
  clearAll(): void;
  
  // Get all registered mock names
  getRegisteredNames(): string[];
}
```

**Key Design Decisions**:

- Singleton pattern for global access
- Automatic cleanup in `afterEach` hooks
- Type-safe mock retrieval with generics
- Supports debugging by listing all registered mocks

### 3. Enhanced Test Utilities

**Purpose**: Provide a unified API for test setup, mock management, and common test operations.

**Interface**:

```typescript
// Main setup function
function setupTest(options?: SetupOptions): TestContext;

interface SetupOptions {
  // Hook mock overrides
  useChat?: Partial<UseChatReturn>;
  useProducts?: Partial<UseProductsReturn>;
  useConversations?: Partial<UseConversationsReturn>;
  
  // API client mock overrides
  apiClient?: Partial<ApiClient>;
  
  // Test environment options
  skipCleanup?: boolean;
  debugMode?: boolean;
}

interface TestContext {
  // Reactive mock instances
  mocks: {
    useChat: ReactiveHookMock<UseChatReturn>;
    useProducts: ReactiveHookMock<UseProductsReturn>;
    useConversations: ReactiveHookMock<UseConversationsReturn>;
  };
  
  // Update helpers
  updateChat: (value: Partial<UseChatReturn>) => void;
  updateProducts: (value: Partial<UseProductsReturn>) => void;
  updateConversations: (value: Partial<UseConversationsReturn>) => void;
  
  // Render helper with automatic cleanup
  renderComponent: <P>(
    Component: React.ComponentType<P>,
    props?: P
  ) => RenderResult;
  
  // User event helper with fixed typing behavior
  user: ReturnType<typeof userEvent.setup>;
  
  // Cleanup function
  cleanup: () => void;
}
```

### 4. Fixed User Input Utilities

**Purpose**: Provide reliable user input simulation that avoids duplicate character issues.

**Interface**:

```typescript
// Enhanced typing that clears before typing
async function typeIntoInput(
  element: HTMLElement,
  text: string,
  options?: TypeOptions
): Promise<void>;

interface TypeOptions {
  clearFirst?: boolean; // Default: true
  delay?: number; // Default: 0
  skipClick?: boolean; // Default: false
}

// Enhanced form submission
async function submitForm(
  form: HTMLElement,
  options?: SubmitOptions
): Promise<void>;

interface SubmitOptions {
  viaEnterKey?: boolean; // Default: false
  viaButton?: boolean; // Default: true
}

// Wait for debounced operations
async function waitForDebounce(
  callback: () => void | Promise<void>,
  delay?: number // Default: 500ms
): Promise<void>;
```

## Data Models

### Mock State Types

```typescript
// Hook return types (from existing codebase)
interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ApiError | null;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  clearError: () => void;
}

interface UseProductsReturn {
  products: Product[];
  productsLoading: boolean;
  productsError: ApiError | null;
  searchProducts: (params: SearchParams) => Promise<void>;
  clearFilters: () => void;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: ApiError | null;
  createConversation: () => Promise<Conversation>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

// Mock configuration
interface MockConfig {
  initialState: Record<string, unknown>;
  autoReset: boolean;
  debugMode: boolean;
}
```

## Error Handling

### Mock Update Errors

**Strategy**: Validate mock updates before applying them to prevent invalid state.

```typescript
class MockUpdateError extends Error {
  constructor(
    public mockName: string,
    public attemptedUpdate: unknown,
    public reason: string
  ) {
    super(`Failed to update mock "${mockName}": ${reason}`);
  }
}

// Validation before updates
function validateMockUpdate<T>(
  currentValue: T,
  update: Partial<T>
): void {
  // Check for type mismatches
  // Validate required fields
  // Ensure update is compatible with current state
}
```

### Component Integration Errors

**Strategy**: Provide clear error messages when components don't integrate correctly with mocks.

```typescript
// Enhanced error messages for common issues
function assertComponentState(
  component: RenderResult,
  expectedState: ComponentState
): void {
  // Check if component rendered
  // Verify expected elements exist
  // Validate state matches expectations
  // Provide actionable error messages
}
```

### Async Operation Errors

**Strategy**: Handle timeout and race condition errors gracefully.

```typescript
// Enhanced waitFor with better error messages
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options?: WaitOptions
): Promise<void> {
  const { timeout = 3000, interval = 50, onTimeout } = options || {};
  
  try {
    await waitFor(condition, { timeout, interval });
  } catch (error) {
    if (onTimeout) {
      onTimeout(error);
    }
    throw new Error(
      `Condition not met within ${timeout}ms. ` +
      `Last state: ${captureComponentState()}`
    );
  }
}
```

## Testing Strategy

### Unit Testing Approach

**Reactive Mock Infrastructure**:

- Test `ReactiveHookMock` state updates trigger re-renders
- Test `MockRegistry` lifecycle management
- Test mock isolation between tests
- Test error handling for invalid updates

**User Input Utilities**:

- Test `typeIntoInput` produces correct character sequences
- Test form submission triggers handlers correctly
- Test debounce waiting works as expected
- Test input clearing before typing

### Integration Testing Approach

**Component Integration**:

- Test ChatInput with mocked useChat hook
- Test ProductBrowser with mocked useProducts hook
- Test ChatInterface with multiple mocked hooks
- Test error state propagation through components

**End-to-End Flows**:

- Test complete chat conversation flow
- Test product search and filter flow
- Test error handling and retry flow
- Test concurrent operations

### Performance Testing

**Metrics to Track**:

- Mock creation time (target: <10ms)
- Mock update time (target: <5ms)
- Test execution time per file (target: <5s)
- Full suite execution time (target: <90s)

**Optimization Strategies**:

- Lazy mock initialization
- Shared mock instances where safe
- Parallel test execution
- Minimal DOM operations

## Implementation Phases

### Phase 1: Reactive Mock Infrastructure (Week 1)

- Implement `ReactiveHookMock` class
- Implement `MockRegistry` singleton
- Create enhanced `setupTest` function
- Migrate existing tests to use new infrastructure

### Phase 2: User Input Fixes (Week 1-2)

- Implement `typeIntoInput` utility
- Implement `submitForm` utility
- Implement `waitForDebounce` utility
- Fix all input-related test failures

### Phase 3: Component Integration Fixes (Week 2)

- Fix ChatInput disabled state handling
- Fix ProductBrowser conditional rendering
- Fix ApiErrorDisplay button consistency
- Fix test ID conflicts

### Phase 4: Test Suite Optimization (Week 2-3)

- Consolidate duplicate test utilities
- Improve test isolation
- Optimize mock creation and cleanup
- Achieve ≥95% pass rate target

## Migration Strategy

### Incremental Migration

**Step 1**: Create new infrastructure alongside existing code

- No breaking changes to existing tests
- New tests use new infrastructure
- Gradual migration of existing tests

**Step 2**: Migrate high-impact test files first

- ChatInterface integration tests
- ProductBrowser integration tests
- Hook unit tests

**Step 3**: Deprecate old utilities

- Mark old utilities as deprecated
- Provide migration guide
- Remove old code after full migration

### Backward Compatibility

**Approach**: Maintain compatibility layer during migration

```typescript
// Legacy function that uses new infrastructure
export function updateMockHook<T>(
  hookName: string,
  value: Partial<T>
): void {
  // Delegate to new MockRegistry
  mockRegistry.update(hookName, value);
}
```

## Risk Mitigation

### Risk: Breaking Existing Passing Tests

**Mitigation**:

- Run full test suite after each change
- Maintain backward compatibility during migration
- Use feature flags to enable new infrastructure gradually

### Risk: Performance Regression

**Mitigation**:

- Benchmark before and after changes
- Profile slow tests and optimize
- Use lazy initialization where possible

### Risk: Incomplete Migration

**Mitigation**:

- Track migration progress with metrics
- Prioritize high-impact files
- Set clear completion criteria

## Success Criteria

1. **Pass Rate**: ≥95% (664+ passing tests out of 699)
2. **Stability**: Zero flaky tests across 10 consecutive runs
3. **Performance**: Full suite execution ≤90 seconds
4. **Maintainability**: Single unified mock system
5. **Developer Experience**: Clear error messages and debugging tools
