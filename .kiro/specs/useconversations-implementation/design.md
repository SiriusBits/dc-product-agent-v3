# Design Document: useConversations Hook Implementation

## Overview

The `useConversations` hook is a custom React hook that provides conversation management functionality for the Dixie Chemical Product Agent frontend. It handles loading, creating, deleting, and updating conversations while managing loading states, error handling, and local state synchronization with the backend API.

The hook follows React best practices and provides a clean interface for components to interact with conversation data without directly managing API calls or state logic.

## Architecture

### Hook Interface

```typescript
interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<Conversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  retry: () => Promise<void>;
  isRetryable: boolean;
}
```

### State Management

The hook manages three primary state variables:

- `conversations`: Array of conversation objects
- `isLoading`: Boolean indicating if any operation is in progress
- `error`: ApiError instance or null for error state

### API Integration

The hook integrates with the `apiClient` to perform CRUD operations:

- `listConversations()`: Fetch all conversations
- `createConversation()`: Create a new conversation
- `deleteConversation(id)`: Delete a specific conversation
- `updateConversationTitle(id, title)`: Update conversation title

## Components and Interfaces

### Core Hook Structure

```typescript
export function useConversations(): UseConversationsReturn {
  // State management
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  
  // Cleanup tracking
  const isMountedRef = useRef(true);
  
  // Core operations
  const loadConversations = useCallback(async () => { /* ... */ }, []);
  const createConversation = useCallback(async () => { /* ... */ }, []);
  const deleteConversation = useCallback(async (id: string) => { /* ... */ }, []);
  const updateConversationTitle = useCallback(async (id: string, title: string) => { /* ... */ }, []);
  const retry = useCallback(async () => { /* ... */ }, [loadConversations]);
  
  // Effects and cleanup
  useEffect(() => { /* Initial load */ }, []);
  useEffect(() => { /* Cleanup */ }, []);
  
  return { /* ... */ };
}
```

### Error Handling Strategy

1. **ApiError Wrapping**: All caught errors are wrapped in ApiError instances
2. **Error Classification**: Errors are classified as retryable or non-retryable
3. **State Management**: Error state is cleared on successful operations
4. **User-Friendly Messages**: Generic error messages for unknown errors

### Memory Management

1. **Ref-Based Cleanup**: Use `useRef` to track component mount status
2. **Conditional State Updates**: Prevent state updates after unmount
3. **Effect Cleanup**: Proper cleanup in useEffect return functions
4. **Callback Dependencies**: Minimal dependencies in useCallback hooks

## Data Models

### Conversation Type

```typescript
interface Conversation {
  id: string;
  messages: ChatMessage[];
  created_at: Date;
  updated_at: Date;
  title?: string;
  metadata?: Record<string, any>;
}
```

### ApiError Type

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public requestId?: string
  );
  
  isRetryable(): boolean;
  isNetworkError(): boolean;
  isServerError(): boolean;
  isClientError(): boolean;
}
```

## Error Handling

### Error Classification

- **Network Errors (status: 0)**: Always retryable
- **Server Errors (5xx)**: Always retryable  
- **Timeout Errors (408)**: Always retryable
- **Client Errors (4xx)**: Not retryable (except 408)

### Error Recovery

1. **Automatic Retry**: Not implemented at hook level
2. **Manual Retry**: `retry()` function re-attempts `loadConversations()`
3. **Error Persistence**: Errors persist until next successful operation
4. **Error Clearing**: Errors are cleared when operations start

### Error Messages

- Network errors: "Network error: Please check your connection and try again."
- Timeout errors: "Request timeout: The server is taking too long to respond."
- Generic errors: Operation-specific messages (e.g., "Failed to create conversation")

## Testing Strategy

### Unit Tests

1. **Initial Loading**: Test conversation loading on mount
2. **CRUD Operations**: Test create, delete, and update operations
3. **Error Scenarios**: Test various error conditions and recovery
4. **State Management**: Test loading states and error states
5. **Cleanup**: Test proper cleanup on unmount

### Test Structure

```typescript
describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads conversations on mount', async () => { /* ... */ });
  it('handles loading error', async () => { /* ... */ });
  it('creates new conversation', async () => { /* ... */ });
  it('deletes conversation', async () => { /* ... */ });
  it('updates conversation title', async () => { /* ... */ });
  it('retries loading conversations', async () => { /* ... */ });
});
```

### Mock Strategy

- Mock `apiClient` methods with `vi.fn()`
- Use `renderHook` from `@testing-library/react`
- Use `waitFor` for async operations
- Mock conversation data with test utilities

## Implementation Details

### State Updates

1. **Optimistic Updates**: Local state updated immediately for better UX
2. **Error Rollback**: Failed operations don't rollback optimistic updates
3. **Consistent Ordering**: New conversations added to beginning of list
4. **Immutable Updates**: Use functional state updates for arrays

### Loading States

1. **Global Loading**: Single loading state for all operations
2. **Operation Overlap**: Multiple operations can set loading state
3. **Loading Reset**: Loading state reset on operation completion
4. **Error During Loading**: Loading state reset even on errors

### Async Operation Handling

1. **Promise Returns**: Operations return promises for caller handling
2. **Error Propagation**: Errors thrown from delete/update operations
3. **Null Returns**: Create operation returns null on failure
4. **Void Returns**: Delete/update operations return void on success

### Cleanup Implementation

```typescript
useEffect(() => {
  isMountedRef.current = true;
  
  return () => {
    isMountedRef.current = false;
  };
}, []);

// In async operations:
if (!isMountedRef.current) return;
setConversations(data);
```

## Performance Considerations

### Callback Optimization

- Use `useCallback` for all operation functions
- Minimize dependencies in callback arrays
- Stable function references prevent unnecessary re-renders

### State Update Optimization

- Use functional state updates for arrays
- Avoid unnecessary state changes
- Clear error state only when needed

### Memory Leak Prevention

- Track component mount status with ref
- Prevent state updates after unmount
- Clean up any pending operations

## Integration Points

### API Client Integration

The hook depends on the `apiClient` module for all backend communication:

```typescript
import { apiClient, ApiError } from '../lib/api-client';
```

### Component Integration

Components use the hook through destructuring:

```typescript
const {
  conversations,
  isLoading,
  error,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  retry,
  isRetryable
} = useConversations();
```

### Type Safety

- Full TypeScript support with proper type definitions
- Shared types from `@repo/shared-types` package
- Proper error type handling with ApiError class

## Security Considerations

### Input Validation

- Conversation IDs validated as non-empty strings
- Titles validated for reasonable length limits
- API client handles request sanitization

### Error Information

- Sensitive error details not exposed to UI
- Generic error messages for unknown errors
- Request IDs preserved for debugging

### State Protection

- No direct state mutation allowed
- Immutable update patterns enforced
- Proper error boundaries recommended for components
