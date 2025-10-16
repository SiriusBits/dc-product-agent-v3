# Integration Test Best Practices Guide

## Overview

This guide provides best practices for writing reliable, maintainable integration tests for the Dixie Chemical Product Agent v3 frontend application.

## Core Principles

### 1. Test User Interactions, Not Implementation Details

```typescript
// ❌ Don't test implementation details
expect(component.state.isLoading).toBe(true);

// ✅ Test user-visible behavior
expect(screen.getByText('Loading...')).toBeInTheDocument();
expect(screen.getByRole('button')).toBeDisabled();
```

### 2. Use Standardized Mock Infrastructure

```typescript
// ❌ Don't create inline mocks
vi.mocked(useChat).mockReturnValue({
  messages: [],
  isLoading: false,
  sendMessage: vi.fn(),
  // ... many more properties
});

// ✅ Use standardized mock factories
vi.mocked(useChat).mockReturnValue(
  createMockUseChatReturn({
    isLoading: false,
    sendMessage: vi.fn().mockResolvedValue(undefined)
  })
);
```

### 3. Test Component Integration, Not Isolation

```typescript
// ❌ Don't test components in complete isolation
render(<ChatInput onSendMessage={mockFn} />);

// ✅ Test full component integration
render(<ChatInterface />); // Tests ChatInterface + ChatInput + hooks
```

## Test Structure Patterns

### Standard Test Structure

```typescript
describe('Component Integration', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Setup default mock state
    vi.mocked(useChat).mockReturnValue(createMockUseChatReturn());
    vi.mocked(useProducts).mockReturnValue(createMockUseProductsReturn());
  });

  describe('Feature Group', () => {
    it('should handle specific user interaction', async () => {
      // Arrange: Setup specific test state
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useChat).mockReturnValue(
        createMockUseChatReturn({ sendMessage: mockSendMessage })
      );

      // Act: Render and interact
      render(<ChatInterface />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test message');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      // Assert: Verify expected behavior
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });
  });
});
```

### Test Naming Conventions

```typescript
// ✅ Good test names - describe user behavior
it('should send message when user clicks send button')
it('should disable input during message sending')
it('should display error when network request fails')
it('should clear search filters when clear button is clicked')

// ❌ Poor test names - describe implementation
it('should call sendMessage function')
it('should set isLoading to true')
it('should update state on error')
```

## Mock Setup Best Practices

### 1. Use Mock Factories

```typescript
// Create specific mock states for each test
const loadingState = createMockUseChatReturn({
  isLoading: true,
  messages: []
});

const errorState = createMockUseChatReturn({
  error: createMockApiError('Network error', 500),
  isLoading: false
});

const successState = createMockUseChatReturn({
  messages: [
    createMockMessage({ content: 'Hello' }),
    createMockMessage({ content: 'World', role: 'assistant' })
  ]
});
```

### 2. Mock Data Builders

```typescript
// Use builders for consistent test data
const testMessage = createMockMessage({
  id: 'test-msg-1',
  content: 'Test message content',
  role: 'user',
  timestamp: new Date('2024-01-01T10:00:00Z')
});

const testProduct = createMockProduct({
  id: 'test-prod-1',
  name: 'Test Product',
  family: 'Test Family',
  applications: ['Testing', 'Development']
});
```

### 3. Mock Function Setup

```typescript
// Setup mock functions with proper return values
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockSearchProducts = vi.fn().mockResolvedValue([testProduct]);
const mockRetryOperation = vi.fn().mockResolvedValue(undefined);

// Use in mock return values
vi.mocked(useChat).mockReturnValue(
  createMockUseChatReturn({
    sendMessage: mockSendMessage,
    retryLastMessage: mockRetryOperation
  })
);
```

## Query Best Practices

### 1. Use Appropriate Query Methods

```typescript
// Use getBy when element SHOULD exist
const sendButton = screen.getByRole('button', { name: /send/i });
expect(sendButton).toBeInTheDocument();

// Use queryBy when element MAY NOT exist
const errorMessage = screen.queryByText('Error occurred');
expect(errorMessage).not.toBeInTheDocument();

// Use findBy when element appears ASYNCHRONOUSLY
const loadingSpinner = await screen.findByTestId('loading-spinner');
expect(loadingSpinner).toBeInTheDocument();
```

### 2. Prefer Semantic Queries

```typescript
// ✅ Preferred - semantic queries
screen.getByRole('button', { name: /send/i })
screen.getByRole('textbox', { name: /search/i })
screen.getByLabelText('Search products')
screen.getByText('Error occurred')

// ⚠️ Acceptable - when semantic queries don't work
screen.getByTestId('chat-interface')
screen.getByTestId('product-loading')

// ❌ Avoid - brittle queries
screen.getByClassName('btn-primary')
screen.getBySelector('[data-cy="send-btn"]')
```

### 3. Use Unique Test IDs

```typescript
// ✅ Component-specific test IDs
<div data-testid="chat-interface">
<div data-testid="chat-loading-spinner">
<div data-testid="product-browser">
<div data-testid="product-loading-spinner">

// ❌ Generic test IDs (cause conflicts)
<div data-testid="loading-spinner">  // Used in multiple components
<div data-testid="error-display">    // Used in multiple components
```

## Async Testing Patterns

### 1. Waiting for State Changes

```typescript
// Wait for loading to start
await waitFor(() => {
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});

// Wait for loading to complete
await waitFor(() => {
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
});

// Wait for error to appear
await waitFor(() => {
  expect(screen.getByText('Network error')).toBeInTheDocument();
});
```

### 2. User Interaction Timing

```typescript
// Type in input field
const input = screen.getByRole('textbox');
await userEvent.type(input, 'Test message');

// Click button and wait for result
const button = screen.getByRole('button', { name: /send/i });
await userEvent.click(button);

// Wait for the interaction result
await waitFor(() => {
  expect(mockSendMessage).toHaveBeenCalledWith('Test message');
});
```

### 3. Mock Function Timing

```typescript
// Setup mock with delay to simulate real API
const mockSendMessage = vi.fn().mockImplementation(async (message) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return { id: 'msg-1', content: message };
});

// Test the loading state during the delay
render(<ChatInterface />);
await userEvent.click(sendButton);

// Verify loading state appears
expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

// Wait for completion
await waitFor(() => {
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
});
```

## Error Testing Patterns

### 1. Error State Testing

```typescript
it('should display error when API call fails', async () => {
  // Setup error state
  const mockError = createMockApiError('Network error', 500);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ error: mockError })
  );

  render(<ChatInterface />);

  // Verify error display
  expect(screen.getByText('Network error')).toBeInTheDocument();
  
  // Verify retry button for retryable errors
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

### 2. Error Recovery Testing

```typescript
it('should clear error when retry succeeds', async () => {
  // Start with error state
  const mockRetry = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({
      error: createMockApiError('Server error', 500),
      retryLastMessage: mockRetry
    })
  );

  render(<ChatInterface />);

  // Click retry button
  const retryButton = screen.getByRole('button', { name: /retry/i });
  await userEvent.click(retryButton);

  // Verify retry function called
  expect(mockRetry).toHaveBeenCalled();
});
```

## Loading State Testing

### 1. Loading State Activation

```typescript
it('should show loading state during operation', async () => {
  // Setup loading state
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ isLoading: true })
  );

  render(<ChatInterface />);

  // Verify loading indicators
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
});
```

### 2. Loading State Transitions

```typescript
it('should transition from loading to success', async () => {
  // Start with loading state
  const { rerender } = render(<Component />);
  vi.mocked(useHook).mockReturnValue(createMockReturn({ isLoading: true }));
  
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

  // Update to success state
  vi.mocked(useHook).mockReturnValue(createMockReturn({ 
    isLoading: false,
    data: [testData]
  }));
  rerender(<Component />);

  // Verify transition
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  expect(screen.getByText('Test Data')).toBeInTheDocument();
});
```

## Component Integration Patterns

### 1. Parent-Child Component Testing

```typescript
it('should pass props correctly to child components', () => {
  const mockSendMessage = vi.fn();
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({
      sendMessage: mockSendMessage,
      isLoading: true
    })
  );

  render(<ChatInterface />);

  // Verify child component receives props
  const input = screen.getByRole('textbox');
  expect(input).toBeDisabled(); // Verifies disabled prop passed to ChatInput
});
```

### 2. Event Flow Testing

```typescript
it('should handle complete user interaction flow', async () => {
  const mockSendMessage = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ sendMessage: mockSendMessage })
  );

  render(<ChatInterface />);

  // Complete user flow
  const input = screen.getByRole('textbox');
  const button = screen.getByRole('button', { name: /send/i });

  await userEvent.type(input, 'Hello world');
  await userEvent.click(button);

  // Verify complete flow
  expect(mockSendMessage).toHaveBeenCalledWith('Hello world');
  expect(input).toHaveValue(''); // Input should be cleared
});
```

## Performance Testing

### 1. Render Performance

```typescript
it('should render within performance budget', () => {
  const startTime = performance.now();
  
  render(<LargeComponent />);
  
  const renderTime = performance.now() - startTime;
  expect(renderTime).toBeLessThan(100); // 100ms budget
});
```

### 2. Interaction Performance

```typescript
it('should handle rapid interactions efficiently', async () => {
  render(<Component />);
  
  const button = screen.getByRole('button');
  
  // Simulate rapid clicks
  const startTime = performance.now();
  for (let i = 0; i < 10; i++) {
    await userEvent.click(button);
  }
  const totalTime = performance.now() - startTime;
  
  expect(totalTime).toBeLessThan(1000); // Should handle 10 clicks in < 1s
});
```

## Accessibility Testing

### 1. ARIA Labels and Roles

```typescript
it('should have proper accessibility attributes', () => {
  render(<Component />);

  // Check ARIA labels
  expect(screen.getByLabelText('Search products')).toBeInTheDocument();
  
  // Check roles
  expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  
  // Check accessible descriptions
  expect(screen.getByRole('textbox')).toHaveAccessibleDescription();
});
```

### 2. Keyboard Navigation

```typescript
it('should support keyboard navigation', async () => {
  render(<Component />);

  const input = screen.getByRole('textbox');
  const button = screen.getByRole('button');

  // Tab navigation
  await userEvent.tab();
  expect(input).toHaveFocus();

  await userEvent.tab();
  expect(button).toHaveFocus();

  // Enter key activation
  await userEvent.keyboard('{Enter}');
  expect(mockFunction).toHaveBeenCalled();
});
```

## Common Anti-Patterns to Avoid

### 1. Testing Implementation Details

```typescript
// ❌ Don't test internal state
expect(component.state.messages).toHaveLength(2);

// ✅ Test user-visible behavior
expect(screen.getAllByRole('listitem')).toHaveLength(2);
```

### 2. Overly Complex Test Setup

```typescript
// ❌ Don't create overly complex mocks
const complexMock = {
  messages: [
    { id: 1, content: 'msg1', role: 'user', timestamp: new Date(), ... },
    { id: 2, content: 'msg2', role: 'assistant', timestamp: new Date(), ... }
  ],
  isLoading: false,
  error: null,
  sendMessage: vi.fn().mockImplementation(async (msg) => {
    // Complex implementation
  }),
  // ... many more properties
};

// ✅ Use simple, focused mocks
const mockReturn = createMockUseChatReturn({
  messages: [
    createMockMessage({ content: 'msg1' }),
    createMockMessage({ content: 'msg2', role: 'assistant' })
  ]
});
```

### 3. Brittle Selectors

```typescript
// ❌ Don't use brittle selectors
screen.getByClassName('message-container-wrapper-div');
screen.getBySelector('[data-cy="msg-123"]');

// ✅ Use semantic selectors
screen.getByRole('listitem');
screen.getByText('Message content');
screen.getByTestId('message-container');
```

## Test Maintenance

### 1. Keep Tests DRY

```typescript
// Create reusable test utilities
const renderChatWithState = (chatState: Partial<UseChatReturn>) => {
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn(chatState)
  );
  return render(<ChatInterface />);
};

// Use in tests
it('should handle loading state', () => {
  renderChatWithState({ isLoading: true });
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});
```

### 2. Update Tests with Component Changes

```typescript
// When component props change, update test mocks
// Old component: <ChatInput onSend={fn} />
// New component: <ChatInput onSendMessage={fn} disabled={bool} />

// Update test accordingly
const mockSendMessage = vi.fn();
render(<ChatInput onSendMessage={mockSendMessage} disabled={false} />);
```

### 3. Regular Test Review

- Review test failures to identify patterns
- Update mock factories when interfaces change
- Remove obsolete tests when features are removed
- Add tests for new edge cases discovered in production

## Debugging Integration Tests

### 1. Add Debug Output

```typescript
// Temporary debug output
console.log('Mock state:', mockReturnValue);
screen.debug(); // Shows current DOM
screen.debug(screen.getByTestId('specific-element')); // Shows specific element
```

### 2. Use Test Isolation

```typescript
// Run single test for focused debugging
// pnpm test --run -t "specific test name"

// Use .only for temporary focus
it.only('should debug this specific test', () => {
  // Test code
});
```

### 3. Verify Mock Setup

```typescript
// Add assertions to verify mocks are working
expect(vi.mocked(useChat)).toHaveBeenCalled();
expect(mockSendMessage).toHaveBeenCalledTimes(1);
```

This guide should help you write reliable, maintainable integration tests that accurately test user interactions and component integration while avoiding common pitfalls.
