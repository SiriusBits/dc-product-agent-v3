# Design Document: Frontend Test Fixes

## Overview

This design addresses the systematic fixing of 105 failing frontend tests across 7 test files. The approach prioritizes fixing root causes over symptoms, organizing fixes into logical milestones that build upon each other to avoid breaking and re-fixing code.

## Architecture

### Test Fix Strategy

The fix strategy follows a dependency-based approach:

```
Foundation Layer (Milestone 1)
├── Test utilities and mocks
├── Type definitions
└── Helper functions

Component Layer (Milestone 2)
├── ChatMessage component fixes
├── Timestamp formatting
└── Markdown rendering

Hook Layer (Milestone 3)
├── useChat fixes
├── useProducts fixes
└── useConversations fixes

Integration Layer (Milestone 4)
├── ChatInterface integration
├── ProductBrowser integration
└── End-to-end flows
```

### Key Design Decisions

1. **Fix from bottom-up**: Start with test utilities and mocks, then components, then hooks, then integration tests
2. **Batch related fixes**: Group fixes by component/hook to minimize context switching
3. **Verify incrementally**: Run tests after each milestone to catch regressions early
4. **Preserve functionality**: Only change test expectations when component behavior is correct

## Components and Interfaces

### 1. Test Utilities Enhancement

**File**: `apps/frontend/src/test/test-utils.tsx`

**Changes Needed**:

- Add `createMockConversation` helper
- Enhance `createMockChatMessage` to support all message properties
- Add `createMockProductDetail` helper
- Ensure all mock API methods return proper response structures

**Interface**:

```typescript
// Enhanced mock helpers
export function createMockConversation(overrides?: Partial<Conversation>): Conversation;
export function createMockProductDetail(overrides?: Partial<ProductDetail>): ProductDetail;
export function createMockChatMessage(overrides?: Partial<ChatMessage>): ChatMessage;
```

### 2. ChatMessage Component Fixes

**File**: `apps/frontend/src/components/chat/ChatMessage.tsx`

**Changes Needed**:

1. Add `data-testid="message-container"` to main container div
2. Fix timestamp formatting to use 12-hour format consistently
3. Adjust markdown rendering to use `font-weight: bold` instead of `bolder`
4. Consolidate confidence score rendering to single text node
5. Ensure copy button is properly accessible
6. Add proper error styling classes

**Component Structure**:

```tsx
<div data-testid="message-container" className={containerClasses}>
  {/* Avatar */}
  <div className="flex flex-col">
    {/* Message content */}
    <div className={messageClasses}>
      {/* Rendered content */}
    </div>
    
    {/* Sources (for assistant messages) */}
    {sources && <SourcesList sources={sources} />}
    
    {/* Timestamp */}
    <div className="text-xs text-muted-foreground">
      {formatTimestamp(timestamp)}
    </div>
  </div>
</div>
```

### 3. Timestamp Formatting Utility

**File**: `apps/frontend/src/lib/utils.ts` (or new file)

**Implementation**:

```typescript
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
```

**Rationale**: Centralized timestamp formatting ensures consistency across components and tests.

### 4. Markdown Rendering Fix

**File**: `apps/frontend/src/lib/markdown.tsx`

**Changes Needed**:

- Ensure `<strong>` tags render with `font-weight: bold` (not `bolder`)
- This may require custom CSS or component styling

**CSS Override**:

```css
.markdown-content strong {
  font-weight: bold;
}
```

### 5. Mock Configuration Fixes

**Files**: Test files using `vi.mock()`

**Changes Needed**:

1. Add `useProductDetail` export to `@/hooks/useProducts` mock
2. Ensure all hook mocks return complete interface
3. Use `importOriginal` pattern for partial mocks

**Pattern**:

```typescript
vi.mock('@/hooks/useProducts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useProducts: vi.fn(),
    useProductDetail: vi.fn(),
  };
});
```

### 6. ProductBrowser Component Fixes

**File**: `apps/frontend/src/components/products/ProductBrowser.tsx`

**Changes Needed**:

1. Ensure component properly handles all hook states
2. Add proper loading and error states
3. Ensure filter controls are accessible
4. Add proper keyboard navigation support
5. Implement comparison feature properly

**Hook Usage**:

```typescript
const { products, loading, error, searchProducts } = useProducts();
const { product, loading: detailLoading, error: detailError, loadProduct } = useProductDetail();
```

### 7. Hook Implementation Fixes

**Files**:

- `apps/frontend/src/hooks/useChat.ts`
- `apps/frontend/src/hooks/useProducts.ts`
- `apps/frontend/src/hooks/useConversations.ts`

**Changes Needed**:

1. Ensure proper error handling and state management
2. Implement retry logic correctly
3. Handle concurrent requests properly
4. Implement debouncing for search
5. Ensure proper cleanup on unmount

**State Management Pattern**:

```typescript
const [state, setState] = useState({
  data: null,
  loading: false,
  error: null
});

// Proper error handling
try {
  setState(prev => ({ ...prev, loading: true, error: null }));
  const result = await apiCall();
  setState({ data: result, loading: false, error: null });
} catch (error) {
  setState(prev => ({ ...prev, loading: false, error }));
}
```

## Data Models

### ChatMessage Enhancement

```typescript
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversation_id: string;
  sources?: Source[];
  metadata?: Record<string, unknown>;
}
```

### Source Display

```typescript
interface Source {
  content: string;
  score: number;
  source: 'vector' | 'graph';
  metadata: Record<string, unknown>;
  provenance: {
    document: string;
    page?: number;
    section?: string;
  };
}
```

## Error Handling

### Test Error Patterns

1. **Missing Elements**: Use `queryBy` for optional elements, `getBy` for required
2. **Async Operations**: Always use `waitFor` for async state changes
3. **Mock Failures**: Ensure mocks are reset between tests with `beforeEach`/`afterEach`

### Component Error Handling

1. **API Errors**: Display user-friendly error messages
2. **Loading States**: Show appropriate loading indicators
3. **Empty States**: Show helpful empty state messages

## Testing Strategy

### Test Execution Order

1. **Milestone 1**: Fix test utilities and run all tests to verify infrastructure
2. **Milestone 2**: Fix ChatMessage tests (10 tests)
3. **Milestone 3**: Fix ProductBrowser tests (23 tests)
4. **Milestone 4**: Fix hook tests (useChat, useProducts, useConversations)
5. **Milestone 5**: Fix integration tests (chat-flow, product-search)

### Verification Approach

After each milestone:

```bash
pnpm test --run --reporter=verbose
```

Track progress:

- Milestone 1: Baseline (105 failing)
- Milestone 2: Target ~95 failing (10 fixed)
- Milestone 3: Target ~72 failing (33 fixed)
- Milestone 4: Target ~20 failing (85 fixed)
- Milestone 5: Target 0 failing (132 passing)

### Regression Prevention

1. Run full test suite after each component fix
2. Use git commits per milestone for easy rollback
3. Document any intentional behavior changes
4. Update test expectations only when component is correct

## Implementation Phases

### Phase 1: Foundation (Milestone 1)

- Update test utilities
- Fix mock configurations
- Add missing type definitions

### Phase 2: Components (Milestones 2-3)

- Fix ChatMessage component
- Fix ProductBrowser component
- Update related UI components

### Phase 3: Hooks (Milestone 4)

- Fix useChat hook
- Fix useProducts hook
- Fix useConversations hook

### Phase 4: Integration (Milestone 5)

- Fix ChatInterface integration tests
- Fix ProductBrowser integration tests
- Verify end-to-end flows

## Design Rationale

### Why Bottom-Up Approach?

1. **Dependency Management**: Test utilities are used by all tests
2. **Early Validation**: Catch infrastructure issues before component fixes
3. **Reduced Rework**: Fix root causes before symptoms

### Why Batch by Component?

1. **Context Efficiency**: Keep related code in working memory
2. **Atomic Commits**: Each component fix is a logical unit
3. **Easier Review**: Changes are grouped logically

### Why Incremental Verification?

1. **Early Detection**: Catch regressions immediately
2. **Progress Tracking**: See measurable improvement
3. **Confidence Building**: Verify each fix works before moving on

## Potential Risks

1. **Cascading Failures**: Fixing one component might break others
   - Mitigation: Run full suite after each milestone

2. **Mock Drift**: Mocks might not match real API behavior
   - Mitigation: Verify mock responses match API contracts

3. **Test Brittleness**: Over-specific assertions might break easily
   - Mitigation: Use semantic queries (getByRole, getByLabelText)

4. **Time Estimation**: 105 fixes might take longer than expected
   - Mitigation: Prioritize critical paths, batch similar fixes

## Success Criteria

1. All 132 tests pass (0 failures)
2. No new console warnings or errors
3. Test execution time remains reasonable (<60s)
4. Code coverage maintained or improved
5. No functional regressions in UI
