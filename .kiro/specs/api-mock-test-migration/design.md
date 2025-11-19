# Design Document - API-Level Mock Test Migration

## Overview

This document outlines the design for migrating the frontend test suite from broken hook-level mocking to working API-level mocking. The migration will be executed in phases, starting with proof-of-concept validation, then systematic migration of failing tests, and finally documentation updates.

## Architecture

### Current State (Broken)

```
Test File
  ↓
vi.mock('@/hooks/useChat') ← Mocks the hook
  ↓
Component renders
  ↓
Hook returns static mock value
  ↓
State updates don't trigger re-renders ❌
  ↓
Tests fail
```

### Target State (Working)

```
Test File
  ↓
vi.mock('@/lib/api-client') ← Mocks the API
  ↓
Component renders
  ↓
Real hook runs with mocked API
  ↓
State updates trigger re-renders ✅
  ↓
Tests pass
```

## Components and Interfaces

### 1. API Client Mock Setup

**Purpose**: Provide consistent API mocking across all tests

**Interface**:

```typescript
// apps/frontend/src/test/api-mocks.ts
export function setupApiMocks(): {
  mockApiClient: MockedApiClient;
  resetMocks: () => void;
}

export interface MockedApiClient {
  sendMessage: MockedFunction<typeof apiClient.sendMessage>;
  listConversations: MockedFunction<typeof apiClient.listConversations>;
  createConversation: MockedFunction<typeof apiClient.createConversation>;
  deleteConversation: MockedFunction<typeof apiClient.deleteConversation>;
  updateConversationTitle: MockedFunction<typeof apiClient.updateConversationTitle>;
  searchProducts: MockedFunction<typeof apiClient.searchProducts>;
  getProductDetail: MockedFunction<typeof apiClient.getProductDetail>;
}
```

**Responsibilities**:

- Create mock implementations for all API methods
- Provide default responses for common scenarios
- Allow test-specific overrides
- Reset mocks between tests

### 2. Test Utilities

**Purpose**: Helper functions for common test scenarios

**Interface**:

```typescript
// apps/frontend/src/test/api-test-utils.ts
export function mockLoadingResponse<T>(
  data: T,
  delay: number
): Promise<T>;

export function mockErrorResponse(
  message: string,
  status: number
): Promise<never>;

export function mockSuccessResponse<T>(data: T): Promise<T>;

export function waitForLoadingState(): Promise<void>;

export function waitForErrorState(): Promise<void>;
```

**Responsibilities**:

- Simulate loading states with delays
- Create error responses
- Wait for specific UI states
- Reduce test boilerplate

### 3. Migration Patterns

**Purpose**: Standardized patterns for different test types

#### Pattern 1: Component Rendering Test

```typescript
it('renders component successfully', () => {
  // Setup: Mock API with default responses
  mockApiClient.listConversations.mockResolvedValue([]);
  
  // Execute: Render component
  render(<ChatInterface />);
  
  // Verify: Component appears
  expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
});
```

#### Pattern 2: Loading State Test

```typescript
it('shows loading indicator while fetching data', async () => {
  // Setup: Mock API with delayed response
  mockApiClient.sendMessage.mockImplementation(
    () => mockLoadingResponse(mockMessage, 100)
  );
  
  // Execute: Trigger action
  await userEvent.click(sendButton);
  
  // Verify: Loading appears
  expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  
  // Verify: Loading disappears
  await waitFor(() => {
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });
});
```

#### Pattern 3: Error Handling Test

```typescript
it('displays error message on API failure', async () => {
  // Setup: Mock API with error
  mockApiClient.sendMessage.mockRejectedValue(
    new ApiError('Network error', 500)
  );
  
  // Execute: Trigger action
  await userEvent.click(sendButton);
  
  // Verify: Error appears
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

## Data Models

### Test Priority Model

```typescript
interface TestPriority {
  file: string;
  priority: 'high' | 'medium' | 'low';
  impact: 'critical' | 'important' | 'nice-to-have';
  effort: 'easy' | 'medium' | 'hard';
  currentStatus: 'passing' | 'failing';
}
```

**Priority Calculation**:

- High Priority: Critical impact + Easy/Medium effort + Currently failing
- Medium Priority: Important impact + Any effort + Currently failing
- Low Priority: Nice-to-have impact OR Currently passing

### Migration Status Model

```typescript
interface MigrationStatus {
  totalTests: number;
  migratedTests: number;
  passingTests: number;
  failingTests: number;
  passRate: number;
  targetPassRate: number;
  remainingWork: number;
}
```

## Error Handling

### Migration Errors

**Scenario**: Migrated test fails after conversion

**Handling**:

1. Capture error details
2. Revert test to original state
3. Document failure reason
4. Mark test for manual review
5. Continue with next test

### API Mock Errors

**Scenario**: Mock doesn't match actual API signature

**Handling**:

1. Compare mock with actual API client
2. Update mock to match signature
3. Add TypeScript types to prevent future mismatches
4. Document API changes

### Component Rendering Errors

**Scenario**: Component fails to render with API mocks

**Handling**:

1. Check for missing API mock implementations
2. Verify localStorage/sessionStorage setup
3. Check for missing context providers
4. Add required mocks
5. Document component dependencies

## Testing Strategy

### Phase 1: Proof of Concept (1 hour)

**Objective**: Validate API-level mocking works for each component type

**Tests to Create**:

1. ChatInterface - Basic rendering
2. ChatInterface - Loading states
3. ChatInterface - Error handling
4. ProductBrowser - Basic rendering
5. ProductBrowser - Search functionality

**Success Criteria**:

- All 5 proof-of-concept tests pass
- Components render correctly
- State updates trigger re-renders
- Loading indicators work

### Phase 2: High-Priority Migration (2-3 hours)

**Objective**: Fix tests with highest impact and easiest effort

**Target Tests**:

1. Component rendering tests (easy wins)
2. Error handling tests (high impact)
3. Loading state tests (medium effort)

**Success Criteria**:

- Pass rate reaches 55%+
- No regressions in passing tests
- Clear patterns established

### Phase 3: Medium-Priority Migration (1-2 hours)

**Objective**: Continue migration to reach 60% target

**Target Tests**:

1. Integration tests
2. User interaction tests
3. State management tests

**Success Criteria**:

- Pass rate reaches 60%+
- All migrated tests stable
- Documentation updated

### Phase 4: Documentation (1 hour)

**Objective**: Update all documentation with correct patterns

**Documents to Update**:

1. Test migration guide
2. API mocking examples
3. Anti-pattern warnings
4. Troubleshooting guide

**Success Criteria**:

- Clear examples for all patterns
- Anti-patterns documented
- Migration guide complete

## Migration Workflow

### Step-by-Step Process

1. **Identify Test**
   - Select next test from priority list
   - Read current implementation
   - Identify hook mocks to replace

2. **Create API Mocks**
   - Identify which API methods the component uses
   - Create mock implementations
   - Set up default responses

3. **Remove Hook Mocks**
   - Delete `vi.mock('@/hooks/...')` statements
   - Add `vi.mock('@/lib/api-client')` instead
   - Import and setup API mocks

4. **Update Test Logic**
   - Replace hook mock updates with API mock responses
   - Update assertions to wait for real state changes
   - Add proper async/await handling

5. **Verify Test**
   - Run test in isolation
   - Verify it passes
   - Check for flakiness (run 3 times)

6. **Update Documentation**
   - Add test to migration log
   - Document any issues encountered
   - Update patterns if new approach found

## Performance Considerations

### Optimization Strategies

1. **Reuse Mock Setup**
   - Create shared mock setup functions
   - Avoid recreating mocks in each test
   - Use beforeEach for common setup

2. **Minimize Delays**
   - Use shortest possible delays for loading tests
   - Default to 50-100ms for simulated loading
   - Only increase if test is flaky

3. **Parallel Execution**
   - Ensure tests are isolated
   - Allow Vitest to run tests in parallel
   - Use existing performance infrastructure

4. **Lazy Loading**
   - Don't import unnecessary modules
   - Use dynamic imports where appropriate
   - Leverage existing lazy mock system

## Rollback Strategy

If migration causes issues:

1. **Immediate Rollback**
   - Git revert to last stable state
   - Document what went wrong
   - Analyze root cause

2. **Partial Rollback**
   - Keep successfully migrated tests
   - Revert problematic tests
   - Continue with remaining tests

3. **Full Abort**
   - If approach fundamentally flawed
   - Document findings
   - Propose alternative solution

## Success Metrics

### Primary Metrics

- **Pass Rate**: 60%+ (33+ passing tests)
- **Execution Time**: <90 seconds (maintain current ~7s)
- **Migration Coverage**: 100% of failing tests attempted

### Secondary Metrics

- **Test Stability**: <5% flakiness rate
- **Documentation Quality**: All patterns documented
- **Developer Satisfaction**: Clear, easy-to-follow patterns

## Dependencies

### External Dependencies

- Vitest test framework
- React Testing Library
- @testing-library/user-event
- Existing test infrastructure

### Internal Dependencies

- `apps/frontend/src/lib/api-client.ts` - API client to mock
- `apps/frontend/src/test/test-utils.tsx` - Existing test utilities
- Research findings in `apps/frontend/src/test/RESEARCH-FINDINGS.md`

## Risks and Mitigation

### Risk 1: API Mocks Don't Match Real API

**Mitigation**:

- Use TypeScript to enforce type safety
- Create shared mock factory
- Regular validation against actual API

### Risk 2: Tests Still Fail After Migration

**Mitigation**:

- Start with proof of concept
- Validate approach before full migration
- Have rollback plan ready

### Risk 3: Migration Takes Longer Than Estimated

**Mitigation**:

- Prioritize high-impact tests
- Stop at 60% target (don't aim for 100%)
- Document remaining work for future

### Risk 4: New Patterns Introduce Different Issues

**Mitigation**:

- Thorough testing of proof of concept
- Incremental migration with validation
- Continuous monitoring of pass rate

## Future Enhancements

After reaching 60% pass rate:

1. **Complete Migration**: Migrate remaining 40% of tests
2. **Add Coverage**: Write tests for untested functionality
3. **Refactor Patterns**: Consolidate common patterns into utilities
4. **Automate Validation**: Add linting rules to prevent hook mocking
5. **Performance Tuning**: Optimize slow tests further
