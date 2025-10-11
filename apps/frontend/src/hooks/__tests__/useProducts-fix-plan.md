# useProducts Test Fix Plan

## Issues Identified

1. **Cache Persistence**: The `searchCache` Map persists between tests
2. **Mock Reset**: Mocks are not properly isolated between tests  
3. **Async Timing**: Tests don't properly wait for async operations
4. **State Isolation**: Hook state persists between test runs

## Fixes Required

### 1. Clear Cache Between Tests

- Clear the searchCache Map in beforeEach
- Ensure each test starts with clean state

### 2. Fix Mock Configuration

- Properly reset mocks in beforeEach
- Ensure mock responses match expected API structure

### 3. Fix Async Test Patterns

- Use proper waitFor patterns for async operations
- Ensure loading states are tested correctly

### 4. Fix Test Expectations

- Update test expectations to match actual hook behavior
- Fix parameter expectations to match API client interface

## Implementation Steps

1. Add cache clearing to beforeEach
2. Fix mock reset patterns
3. Update test expectations for API parameters
4. Fix async test patterns
5. Update mock responses to match API structure
