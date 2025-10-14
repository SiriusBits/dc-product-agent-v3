# Integration Test Fix Plan

## Overview

This plan addresses the failing integration test requirements by systematically fixing the root causes of test failures across chat-flow, product-search, API interaction, and component integration tests.

## Problem Analysis

### Current State

- **Chat Flow Tests**: 9 failed, 16 passed (64% pass rate)
- **Product Search Tests**: Multiple failures in component rendering
- **API Interaction Tests**: 18 failed, 1 passed (5% pass rate)
- **Component Integration**: Broken mock infrastructure

### Root Causes

1. **Mock Infrastructure Issues**: Hook mocks not providing expected data structures
2. **Component State Management**: Components not properly consuming mocked data
3. **Test Setup Problems**: Async operations and lifecycle management issues
4. **Data Structure Mismatches**: Mock data doesn't match component expectations

## Implementation Plan

### Phase 1: Fix Mock Infrastructure (Priority: Critical)

#### Task 1.1: Standardize Hook Mock Data Structures

**Requirement**: 4.1, 4.2, 4.3, 4.4
**Files to Fix**:

- `apps/frontend/src/test/test-utils.tsx`
- `apps/frontend/src/test/enhanced-hook-mocks.ts`
- `apps/frontend/src/test/fixed-loading-mocks.ts`

**Actions**:

1. Create standardized mock data factories for all hook return values
2. Ensure mock data matches actual hook interfaces exactly
3. Fix `useChat` mock to return proper message arrays and state
4. Fix `useProducts` mock to return searchable product data
5. Fix `useConversations` mock to return conversation list with proper structure

```typescript
// Example standardized mock structure
const createMockUseChatReturn = (overrides = {}) => ({
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
  retryLastMessage: vi.fn(),
  ...overrides
});
```

#### Task 1.2: Fix API Client Mocks

**Requirement**: 4.4
**Files to Fix**:

- `apps/frontend/src/test/test-utils.tsx`
- `apps/frontend/src/lib/api-client.ts` (mock setup)

**Actions**:

1. Ensure all API client methods are properly mocked
2. Fix response data structures to match actual API contracts
3. Add proper error simulation for error handling tests
4. Fix async operation handling in mocks

### Phase 2: Fix Component Integration (Priority: High)

#### Task 2.1: Fix ChatInterface Integration

**Requirement**: 4.1
**Files to Fix**:

- `apps/frontend/src/test/integration/chat-flow.test.tsx`
- `apps/frontend/src/components/chat/ChatInterface.tsx`

**Actions**:

1. Ensure ChatInterface properly renders messages from hook state
2. Fix message display logic to work with mocked data
3. Add proper data-testid attributes for test queries
4. Fix loading state management in component
5. Ensure proper error state display

#### Task 2.2: Fix ProductBrowser Integration  

**Requirement**: 4.2
**Files to Fix**:

- `apps/frontend/src/test/integration/product-search.test.tsx`
- `apps/frontend/src/components/products/ProductBrowser.tsx`

**Actions**:

1. Fix product list rendering with mocked data
2. Ensure search input is properly accessible
3. Fix filter controls rendering and interaction
4. Add proper loading states for product operations
5. Fix product selection and comparison features

#### Task 2.3: Fix API Error Handling Integration

**Requirement**: 4.4
**Files to Fix**:

- `apps/frontend/src/test/integration/api-interaction.test.tsx`
- `apps/frontend/src/components/error/ApiErrorDisplay.tsx`

**Actions**:

1. Fix error message display in UI components
2. Ensure retry buttons appear for retryable errors
3. Fix loading state management during API calls
4. Add proper error boundary integration
5. Fix network error handling and display

### Phase 3: Fix Test Infrastructure (Priority: Medium)

#### Task 3.1: Improve Test Setup and Cleanup

**Requirement**: 4.1, 4.2, 4.3, 4.4
**Files to Fix**:

- `apps/frontend/src/test/enhanced-test-setup.ts`
- `apps/frontend/src/test/test-utils.tsx`

**Actions**:

1. Fix async operation handling in test setup
2. Ensure proper mock reset between tests
3. Add better error handling for test failures
4. Fix component lifecycle management in tests
5. Add proper cleanup for DOM elements and event listeners

#### Task 3.2: Standardize Test Queries and Assertions

**Requirement**: 4.1, 4.2, 4.3, 4.4
**Files to Fix**:

- All integration test files

**Actions**:

1. Use consistent query methods (getBy, findBy, queryBy)
2. Add proper wait conditions for async operations
3. Fix assertion methods to match actual component output
4. Add better error messages for failed assertions
5. Use data-testid attributes consistently

### Phase 4: Create Focused Integration Tests (Priority: Medium)

#### Task 4.1: Create Minimal Chat Flow Test

**Requirement**: 4.1
**File to Create**: `apps/frontend/src/test/integration/minimal-chat-flow.test.tsx`

**Actions**:

1. Create simple test that renders ChatInterface
2. Test basic message sending functionality
3. Verify message display in chat history
4. Test error handling for failed messages
5. Ensure loading states work correctly

#### Task 4.2: Create Minimal Product Search Test

**Requirement**: 4.2
**File to Create**: `apps/frontend/src/test/integration/minimal-product-search.test.tsx`

**Actions**:

1. Create simple test that renders ProductBrowser
2. Test basic product list display
3. Verify search input functionality
4. Test filter application
5. Ensure loading states work correctly

#### Task 4.3: Create API Integration Test

**Requirement**: 4.4
**File to Create**: `apps/frontend/src/test/integration/minimal-api-integration.test.tsx`

**Actions**:

1. Test basic API call functionality
2. Verify error handling and display
3. Test retry functionality
4. Verify loading state management
5. Test request cancellation

## Implementation Order

### Week 1: Foundation

1. **Day 1-2**: Task 1.1 - Standardize Hook Mock Data Structures
2. **Day 3-4**: Task 1.2 - Fix API Client Mocks
3. **Day 5**: Task 3.1 - Improve Test Setup and Cleanup

### Week 2: Component Integration

1. **Day 1-2**: Task 2.1 - Fix ChatInterface Integration
2. **Day 3-4**: Task 2.2 - Fix ProductBrowser Integration
3. **Day 5**: Task 2.3 - Fix API Error Handling Integration

### Week 3: Testing and Refinement

1. **Day 1-2**: Task 3.2 - Standardize Test Queries and Assertions
2. **Day 3**: Task 4.1 - Create Minimal Chat Flow Test
3. **Day 4**: Task 4.2 - Create Minimal Product Search Test
4. **Day 5**: Task 4.3 - Create API Integration Test

## Success Criteria

### Requirement 4.1: Chat-flow tests passing

- ✅ ChatInterface renders with mocked messages
- ✅ Message sending functionality works
- ✅ Loading states display correctly
- ✅ Error handling works properly

### Requirement 4.2: Product-search tests passing

- ✅ ProductBrowser renders product list
- ✅ Search functionality works
- ✅ Filter controls are accessible
- ✅ Loading states work correctly

### Requirement 4.3: Component integration working

- ✅ Components properly consume hook data
- ✅ State management works across boundaries
- ✅ Mock data flows correctly through components
- ✅ Component lifecycle works in tests

### Requirement 4.4: API interaction tests passing

- ✅ Error messages display correctly
- ✅ Retry functionality works
- ✅ Loading states are managed properly
- ✅ Network errors are handled correctly

## Risk Mitigation

### High Risk: Mock Data Structure Changes

- **Mitigation**: Create comprehensive type checking for mock data
- **Fallback**: Revert to simpler mock structures if needed

### Medium Risk: Component State Management Issues

- **Mitigation**: Add debugging utilities to trace state changes
- **Fallback**: Simplify component logic if integration proves too complex

### Low Risk: Test Infrastructure Instability

- **Mitigation**: Add comprehensive cleanup and error handling
- **Fallback**: Use more conservative test patterns

## Monitoring and Validation

### Daily Checks

- Run integration test suite and track pass/fail rates
- Monitor for new test failures introduced by changes
- Verify mock data consistency across test files

### Weekly Reviews

- Review test coverage and identify gaps
- Assess component integration stability
- Plan next phase improvements

### Success Metrics

- **Target**: 95%+ integration test pass rate
- **Minimum**: All 4 requirements (4.1-4.4) passing
- **Stretch**: Zero flaky tests, consistent performance
