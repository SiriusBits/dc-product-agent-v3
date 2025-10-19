# Test Migration Examples

This document provides concrete examples of migrating from old testing patterns to the new reactive mock infrastructure.

## Basic Component Test Migration

### Before (Static Mocks)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';
import ChatInterface from '@/components/chat/ChatInterface';

// Static mock
vi.mock('@/hooks/useChat');
const mockUseChat = useChat as vi.MockedFunction<typeof useChat>;

describe('ChatInterface', () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
    });
  });

  it('should display empty state', () => {
    render(<ChatInterface />);
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    // ❌ This doesn't trigger re-render
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: true,
      error: null,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
    });
    
    render(<ChatInterface />);
    // This will fail because component doesn't re-render
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
```

### After (Reactive Mocks)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { setupTest } from '@/test/enhanced-setup';
import ChatInterface from '@/components/chat/ChatInterface';

describe('ChatInterface', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest();
  });

  it('should display empty state', () => {
    testContext.renderComponent(<ChatInterface />);
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('should show loading state', async () => {
    // ✅ This triggers re-render
    await testContext.updateChat({ isLoading: true });
    
    testContext.renderComponent(<ChatInterface />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
```

## Input Testing Migration

### Before (Manual User Events)

```typescript
import userEvent from '@testing-library/user-event';

describe('ChatInput', () => {
  it('should handle message input', async () => {
    const mockSendMessage = vi.fn();
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
    });

    const user = userEvent.setup();
    render(<ChatInput />);
    
    const input = screen.getByPlaceholderText(/ask about/i);
    
    // ❌ May cause duplicate text
    await user.type(input, 'test message');
    await user.keyboard('{Enter}');
    
    expect(mockSendMessage).toHaveBeenCalledWith('test message');
  });
});
```

### After (Input Utilities)

```typescript
import { typeIntoInput, submitForm } from '@/test/input-utilities';
import userEvent from '@testing-library/user-event';

describe('ChatInput', () => {
  it('should handle message input', async () => {
    const user = userEvent.setup();
    testContext.renderComponent(<ChatInput />);
    
    const input = screen.getByPlaceholderText(/ask about/i);
    
    // ✅ Handles clearing and timing correctly
    await typeIntoInput(input, 'test message', user);
    await submitForm(input, { viaEnterKey: true }, user);
    
    expect(testContext.mocks.chat.sendMessage).toHaveBeenCalledWith('test message');
  });
});
```

## Error Handling Migration

### Before (Static Error Mocks)

```typescript
describe('Error Handling', () => {
  it('should display error', () => {
    const error = new ApiError('Test error', 500);
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      error, // ❌ Component won't re-render to show this
      sendMessage: vi.fn(),
    });

    render(<ChatInterface />);
    
    // This will fail
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

### After (Reactive Error Handling)

```typescript
describe('Error Handling', () => {
  it('should display error', async () => {
    const error = new ApiError('Test error', 500);
    
    // ✅ Set error state reactively
    await testContext.updateChat({ error });
    
    testContext.renderComponent(<ChatInterface />);
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });
});
```

## Async Operations Migration

### Before (Manual Promise Handling)

```typescript
describe('Async Operations', () => {
  it('should handle message sending', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockUseChat.mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
    });

    const user = userEvent.setup();
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText(/ask about/i);
    await user.type(input, 'test');
    await user.keyboard('{Enter}');
    
    // ❌ No way to verify loading state changes
    expect(mockSendMessage).toHaveBeenCalled();
  });
});
```

### After (State Transition Testing)

```typescript
describe('Async Operations', () => {
  it('should handle message sending', async () => {
    const user = userEvent.setup();
    testContext.renderComponent(<ChatInterface />);
    
    const input = screen.getByPlaceholderText(/ask about/i);
    await typeIntoInput(input, 'test', user);
    await submitForm(input, { viaEnterKey: true }, user);
    
    // ✅ Verify loading state
    await waitFor(() => {
      expect(testContext.mocks.chat.isLoading).toBe(true);
    });
    
    // Simulate completion
    await testContext.updateChat({ 
      isLoading: false,
      messages: [mockMessage]
    });
    
    // Verify completion
    await waitFor(() => {
      expect(screen.getByText('Response text')).toBeInTheDocument();
    });
  });
});
```

## Complex State Management Migration

### Before (Multiple Mock Updates)

```typescript
describe('Complex State', () => {
  it('should handle multiple state changes', async () => {
    // ❌ Multiple mock setups, no re-renders
    mockUseChat.mockReturnValue({ isLoading: true });
    render(<ChatInterface />);
    
    // This won't work - component already rendered
    mockUseChat.mockReturnValue({ 
      isLoading: false, 
      messages: [mockMessage] 
    });
    
    // Component won't update
    expect(screen.getByText('Message text')).toBeInTheDocument();
  });
});
```

### After (Sequential State Updates)

```typescript
describe('Complex State', () => {
  it('should handle multiple state changes', async () => {
    // ✅ Start with loading
    await testContext.updateChat({ isLoading: true });
    testContext.renderComponent(<ChatInterface />);
    
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // ✅ Update to loaded state
    await testContext.updateChat({ 
      isLoading: false, 
      messages: [mockMessage] 
    });
    
    await waitFor(() => {
      expect(screen.getByText('Message text')).toBeInTheDocument();
    });
  });
});
```

## Integration Test Migration

### Before (Manual Mock Coordination)

```typescript
describe('Chat Flow Integration', () => {
  it('should handle full conversation flow', async () => {
    const mockSendMessage = vi.fn();
    const mockCreateConversation = vi.fn();
    
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
    });
    
    mockUseConversations.mockReturnValue({
      conversations: [],
      createConversation: mockCreateConversation,
    });

    const user = userEvent.setup();
    render(<ChatInterface />);
    
    // ❌ Complex manual coordination
    await user.type(screen.getByPlaceholderText(/ask/i), 'test');
    await user.keyboard('{Enter}');
    
    // Hard to verify state transitions
  });
});
```

### After (Coordinated State Management)

```typescript
describe('Chat Flow Integration', () => {
  it('should handle full conversation flow', async () => {
    const user = userEvent.setup();
    testContext.renderComponent(<ChatInterface />);
    
    // ✅ Send message
    const input = screen.getByPlaceholderText(/ask/i);
    await typeIntoInput(input, 'test message', user);
    await submitForm(input, { viaEnterKey: true }, user);
    
    // ✅ Verify loading state
    await waitFor(() => {
      expect(testContext.mocks.chat.isLoading).toBe(true);
    });
    
    // ✅ Simulate response
    await testContext.updateChat({
      isLoading: false,
      messages: [
        { role: 'user', content: 'test message' },
        { role: 'assistant', content: 'response' }
      ]
    });
    
    // ✅ Verify conversation created
    await testContext.updateConversations({
      conversations: [mockConversation]
    });
    
    // ✅ Verify UI updates
    await waitFor(() => {
      expect(screen.getByText('response')).toBeInTheDocument();
    });
  });
});
```

## Performance Optimization Migration

### Before (No Optimization)

```typescript
describe('Performance Test', () => {
  it('should handle many operations', async () => {
    // ❌ No performance considerations
    for (let i = 0; i < 100; i++) {
      mockUseChat.mockReturnValue({
        messages: Array(i).fill(mockMessage),
      });
      
      render(<ChatInterface />);
      cleanup();
    }
  });
});
```

### After (Optimized Testing)

```typescript
describe('Performance Test', () => {
  it('should handle many operations', async () => {
    // ✅ Enable performance optimizations
    testContext = setupTest({
      enablePerformanceOptimizations: true,
    });
    
    // ✅ Use optimized queries
    import { optimizedScreen } from '@/test/dom-optimizer';
    
    for (let i = 0; i < 100; i++) {
      await testContext.updateChat({
        messages: Array(i).fill(mockMessage),
      });
      
      // ✅ Optimized rendering and querying
      testContext.renderComponent(<ChatInterface />);
      
      const messages = optimizedScreen.getAllByTestId('message');
      expect(messages).toHaveLength(i);
    }
  });
});
```

## Mock Registry Migration

### Before (Manual Mock Management)

```typescript
describe('Multiple Components', () => {
  beforeEach(() => {
    // ❌ Manual mock setup for each hook
    mockUseChat.mockReturnValue(defaultChatState);
    mockUseProducts.mockReturnValue(defaultProductsState);
    mockUseConversations.mockReturnValue(defaultConversationsState);
  });

  it('should coordinate multiple hooks', () => {
    // ❌ Hard to update specific hook state
    mockUseChat.mockReturnValue({ ...defaultChatState, isLoading: true });
    
    render(<ComplexComponent />);
  });
});
```

### After (Registry-Based Management)

```typescript
describe('Multiple Components', () => {
  beforeEach(() => {
    testContext = setupTest();
    // ✅ All mocks automatically registered
  });

  it('should coordinate multiple hooks', async () => {
    // ✅ Easy to update specific hook state
    await testContext.updateChat({ isLoading: true });
    await testContext.updateProducts({ products: mockProducts });
    
    testContext.renderComponent(<ComplexComponent />);
    
    // ✅ Verify coordinated state
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText('Product 1')).toBeInTheDocument();
  });
});
```

## Migration Checklist

When migrating a test file:

### 1. Update Imports

```typescript
// Remove
import { render, screen } from '@testing-library/react';

// Add
import { setupTest } from '@/test/enhanced-setup';
import { typeIntoInput, submitForm } from '@/test/input-utilities';
```

### 2. Replace Mock Setup

```typescript
// Remove static mocks
vi.mock('@/hooks/useChat');
const mockUseChat = useChat as vi.MockedFunction<typeof useChat>;

// Add test context
let testContext: ReturnType<typeof setupTest>;
beforeEach(() => {
  testContext = setupTest();
});
```

### 3. Update State Changes

```typescript
// Replace static mock returns
mockUseChat.mockReturnValue({ isLoading: true });

// With reactive updates
await testContext.updateChat({ isLoading: true });
```

### 4. Update Rendering

```typescript
// Replace direct render
render(<Component />);

// With context render
testContext.renderComponent(<Component />);
```

### 5. Update Input Handling

```typescript
// Replace manual user events
await user.type(input, 'text');
await user.keyboard('{Enter}');

// With input utilities
await typeIntoInput(input, 'text', user);
await submitForm(input, { viaEnterKey: true }, user);
```

### 6. Add Async Waits

```typescript
// Add waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

### 7. Enable Optimizations

```typescript
// For performance-critical tests
testContext = setupTest({
  enablePerformanceOptimizations: true,
});
```

## Common Migration Patterns

### Pattern 1: Simple State Update

```typescript
// Before
mockHook.mockReturnValue(newState);

// After
await testContext.updateHook(newState);
```

### Pattern 2: Error Testing

```typescript
// Before
mockHook.mockReturnValue({ error: new Error('test') });

// After
await testContext.updateHook({ error: new Error('test') });
```

### Pattern 3: Loading States

```typescript
// Before
mockHook.mockReturnValue({ isLoading: true });

// After
await testContext.updateHook({ isLoading: true });
// ... test loading state ...
await testContext.updateHook({ isLoading: false });
```

### Pattern 4: Form Submission

```typescript
// Before
await user.type(input, 'text');
await user.click(button);

// After
await typeIntoInput(input, 'text', user);
await submitForm(input, { viaButton: button }, user);
```

This migration guide provides concrete examples for updating existing tests to use the new reactive mock infrastructure. The new system provides better reliability, performance, and maintainability.
