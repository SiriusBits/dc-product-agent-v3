# Integration Test Troubleshooting Guide

## Quick Reference

### Most Common Failures

| Error Pattern | Root Cause | Quick Fix |
|---------------|------------|-----------|
| `SendMessage function not called` | Event handlers not wired | Check form submission handlers |
| `Element not disabled during loading` | Props not flowing to child components | Verify prop passing |
| `Product list visible during loading` | Conditional rendering issues | Fix loading state logic |
| `Retry button not found` | Error display integration missing | Check ApiErrorDisplay integration |
| `Multiple elements with same testid` | Duplicate test IDs | Use unique component-specific IDs |

## Detailed Troubleshooting

### 1. SendMessage Function Not Called

**Error Message**:

```
AssertionError: expected "spy" to be called with arguments: [ 'Test message' ]
Number of calls: 0
```

**Root Cause**: Event handlers in ChatInput component are not properly connected to the sendMessage function from useChat hook.

**Debugging Steps**:

1. Check if ChatInterface is passing sendMessage prop to ChatInput
2. Verify ChatInput is using the prop in form submission handler
3. Ensure form submission prevents default and calls the function

**Fix Example**:

```typescript
// In ChatInterface.tsx
<ChatInput 
  onSendMessage={sendMessage}  // ← Ensure this prop is passed
  disabled={isLoading}
/>

// In ChatInput.tsx
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  if (message.trim() && onSendMessage) {
    onSendMessage(message.trim());  // ← Ensure this is called
    setMessage('');
  }
};
```

### 2. Input Not Disabled During Loading

**Error Message**:

```
Error: expect(element).toBeDisabled()
Received element is not disabled
```

**Root Cause**: The `disabled` prop is not being passed from ChatInterface to ChatInput, or not being applied to form elements.

**Debugging Steps**:

1. Check if ChatInterface passes `disabled={isLoading}` to ChatInput
2. Verify ChatInput applies disabled to textarea and button elements
3. Ensure isLoading state is correctly mocked in tests

**Fix Example**:

```typescript
// In ChatInterface.tsx
<ChatInput 
  onSendMessage={sendMessage}
  disabled={isLoading}  // ← Pass loading state
/>

// In ChatInput.tsx
interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;  // ← Accept disabled prop
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  return (
    <form onSubmit={handleSubmit}>
      <textarea 
        disabled={disabled}  // ← Apply to textarea
        // ... other props
      />
      <button 
        disabled={disabled || !message.trim()}  // ← Apply to button
        // ... other props
      />
    </form>
  );
}
```

### 3. Product List Visible During Loading

**Error Message**:

```
Error: expect(element).not.toBeInTheDocument()
expected document not to contain element, found <div data-testid="product-list">
```

**Root Cause**: ProductBrowser component is showing both loading indicator and product list simultaneously.

**Debugging Steps**:

1. Check conditional rendering logic in ProductBrowser
2. Verify isLoading state is properly used
3. Ensure only one state is shown at a time

**Fix Example**:

```typescript
// In ProductBrowser.tsx
export default function ProductBrowser() {
  const { products, isLoading, error } = useProducts();

  if (error) {
    return <ApiErrorDisplay error={error} />;
  }

  if (isLoading) {
    return (
      <div data-testid="product-loading">
        <LoadingSpinner />
      </div>
    );
  }

  // Only show product list when not loading and no error
  return (
    <div data-testid="product-list">
      <ProductList products={products} />
    </div>
  );
}
```

### 4. Retry Button Not Found

**Error Message**:

```
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/retry/i`
```

**Root Cause**: ApiErrorDisplay component is not being rendered, or retry button is not included in error display.

**Debugging Steps**:

1. Check if error state is properly passed to ApiErrorDisplay
2. Verify ApiErrorDisplay renders retry button for retryable errors
3. Ensure error object has correct status code for retry logic

**Fix Example**:

```typescript
// In ProductBrowser.tsx
if (error) {
  return (
    <div data-testid="product-error">
      <ApiErrorDisplay 
        error={error} 
        onRetry={retrySearch}  // ← Pass retry function
      />
    </div>
  );
}

// In ApiErrorDisplay.tsx
export default function ApiErrorDisplay({ error, onRetry }: Props) {
  const isRetryable = error.status >= 500 || error.status === 0;
  
  return (
    <div>
      <p>{error.message}</p>
      {isRetryable && onRetry && (
        <button onClick={onRetry}>
          Retry  {/* ← Ensure button has correct text */}
        </button>
      )}
    </div>
  );
}
```

### 5. Multiple Elements with Same Test ID

**Error Message**:

```
TestingLibraryElementError: Found multiple elements by: [data-testid="loading-spinner"]
```

**Root Cause**: Multiple components are using the same data-testid value.

**Debugging Steps**:

1. Search codebase for duplicate data-testid values
2. Identify which components are using the same ID
3. Make test IDs unique per component

**Fix Example**:

```typescript
// Instead of generic IDs:
<div data-testid="loading-spinner">  // ❌ Generic

// Use component-specific IDs:
<div data-testid="chat-loading-spinner">     // ✅ Specific
<div data-testid="product-loading-spinner">  // ✅ Specific
<div data-testid="conversation-loading-spinner">  // ✅ Specific
```

## Test Infrastructure Issues

### Mock Setup Problems

**Issue**: Mocks not returning expected values

**Solution**:

```typescript
// Use standardized mock factories
const mockChatReturn = createMockUseChatReturn({
  isLoading: true,
  sendMessage: vi.fn().mockResolvedValue(undefined)
});

vi.mocked(useChat).mockReturnValue(mockChatReturn);
```

### Async Operation Issues

**Issue**: Tests failing due to timing issues

**Solution**:

```typescript
// Use waitFor for state changes
await waitFor(() => {
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});

// Use findBy for elements that appear asynchronously
const errorMessage = await screen.findByText('Error occurred');
```

### Query Method Issues

**Issue**: Using wrong query methods

**Solution**:

```typescript
// Use getBy when element should exist
expect(screen.getByRole('button')).toBeInTheDocument();

// Use queryBy when element may not exist
expect(screen.queryByRole('button')).not.toBeInTheDocument();

// Use findBy when element appears asynchronously
const button = await screen.findByRole('button');
```

## Component-Specific Troubleshooting

### ChatInterface Issues

**Common Problems**:

- Props not passed to ChatInput
- Event handlers not wired up
- Loading states not managed

**Debug Checklist**:

- [ ] sendMessage prop passed to ChatInput
- [ ] disabled prop passed to ChatInput
- [ ] isLoading state used for conditional rendering
- [ ] Error display integrated

### ProductBrowser Issues

**Common Problems**:

- Multiple states shown simultaneously
- Filter parameters incorrect
- Error display missing

**Debug Checklist**:

- [ ] Conditional rendering logic correct
- [ ] Loading state hides product list
- [ ] Error state shows ApiErrorDisplay
- [ ] Filter clear passes correct parameters

### ApiErrorDisplay Issues

**Common Problems**:

- Retry button not rendered
- Error messages not displayed
- Retry function not called

**Debug Checklist**:

- [ ] Retry button shown for retryable errors (5xx, 0, 408)
- [ ] Retry button hidden for non-retryable errors (4xx)
- [ ] onRetry prop passed and called
- [ ] Error message displayed correctly

## Prevention Strategies

### 1. Component Integration Testing

Always test component integration, not just individual components:

```typescript
// Test the full integration
it('should handle message sending flow', async () => {
  const mockSendMessage = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ sendMessage: mockSendMessage })
  );

  render(<ChatInterface />);
  
  const input = screen.getByRole('textbox');
  const button = screen.getByRole('button', { name: /send/i });
  
  await userEvent.type(input, 'Test message');
  await userEvent.click(button);
  
  expect(mockSendMessage).toHaveBeenCalledWith('Test message');
});
```

### 2. Prop Flow Validation

Test that props flow correctly between components:

```typescript
it('should pass loading state to child components', () => {
  vi.mocked(useChat).mockReturnValue(
    createMockUseChatReturn({ isLoading: true })
  );

  render(<ChatInterface />);
  
  const input = screen.getByRole('textbox');
  expect(input).toBeDisabled();
});
```

### 3. State Management Testing

Test state changes and their effects:

```typescript
it('should update UI when loading state changes', async () => {
  const mockReturn = createMockUseChatReturn({ isLoading: true });
  const { rerender } = render(<Component />);
  
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Update mock to not loading
  vi.mocked(useHook).mockReturnValue({ ...mockReturn, isLoading: false });
  rerender(<Component />);
  
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
});
```

## Getting Help

### Debug Output

Add debug output to understand what's happening:

```typescript
// In tests
console.log('Mock state:', mockReturnValue);
screen.debug(); // Shows current DOM

// In components
console.log('Props received:', props);
console.log('Current state:', state);
```

### Common Debug Commands

```bash
# Run specific test with debug output
pnpm test --run src/test/integration/chat-flow.test.tsx --reporter=verbose

# Run with coverage to see what's not being tested
pnpm test --run --coverage

# Run single test for focused debugging
pnpm test --run -t "should send message when button clicked"
```

### When to Ask for Help

1. **After trying the troubleshooting steps above**
2. **When the same test fails consistently across multiple runs**
3. **When you've verified the component logic but tests still fail**
4. **When you need help understanding the expected component behavior**

Include in your help request:

- Specific error message
- Test file and test name
- Steps you've already tried
- Relevant component code
- Mock setup being used
