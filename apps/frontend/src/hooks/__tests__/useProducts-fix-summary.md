# useProducts Test Fix Summary

## Issues Fixed

### 1. Mock Configuration Issues

**Problem**: The original mock setup had hoisting issues with `vi.mock()` and variable references.

**Solution**:

- Moved mock function declarations inside the `vi.mock()` factory
- Used `vi.mocked()` to get typed mock functions after import
- Properly structured mock to avoid hoisting issues

### 2. Cache Persistence Between Tests

**Problem**: The `searchCache` Map persisted between tests, causing unexpected behavior.

**Solution**:

- Added `clearProductsCache()` export function to the hook
- Called `clearProductsCache()` in `beforeEach()` to ensure clean state
- Added cache clearing to individual tests where needed

### 3. API Response Structure Mismatches

**Problem**: Tests expected array responses but API returns `ProductSearchResponse` objects.

**Solution**:

- Updated all mock responses to match `ProductSearchResponse` structure:

  ```typescript
  {
    products: ProductSummary[],
    total_count: number,
    facets: SearchFacets,
    query_info?: QueryInfo
  }
  ```

### 4. Parameter Expectation Mismatches

**Problem**: Tests expected different parameter names than what the API client uses.

**Solution**:

- Updated test expectations to match actual API client interface
- Changed `families` to `family` where appropriate
- Added `limit` and `offset` parameters to match hook behavior

### 5. Async State Management Issues

**Problem**: Tests didn't properly handle async operations and loading states.

**Solution**:

- Added proper `waitFor()` patterns for async operations
- Ensured tests wait for initial load before performing actions
- Used `clearProductsCache()` to force fresh API calls when testing loading states

### 6. Mock Sequencing Issues

**Problem**: Tests didn't account for initial load API calls.

**Solution**:

- Updated mock sequences to include initial load calls
- Used `mockResolvedValueOnce()` chains to handle multiple API calls
- Adjusted test expectations to account for initial + search API calls

## Key Changes Made

### Hook Changes (`useProducts.ts`)

```typescript
// Added cache clearing function for testing
export function clearProductsCache(): void {
  searchCache.clear();
}
```

### Test Changes (`useProducts.test.ts`)

1. **Fixed mock setup**:

   ```typescript
   vi.mock('@/lib/api-client', () => ({
     apiClient: { searchProducts: vi.fn(), /* ... */ },
     ApiError: class MockApiError extends Error { /* ... */ }
   }));
   ```

2. **Added cache clearing**:

   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
     clearProductsCache();
     mockApiClient.searchProducts.mockResolvedValue(mockSearchResponse);
   });
   ```

3. **Updated response structures**:

   ```typescript
   const searchResults = {
     products: [mockProducts[0]],
     total_count: 1,
     facets: {},
   };
   ```

4. **Fixed async patterns**:

   ```typescript
   // Wait for initial load
   await waitFor(() => {
     expect(result.current.loading).toBe(false);
   });
   ```

## Test Results

- **Before**: 13 failed, 4 passed (17 total)
- **After**: 0 failed, 17 passed (17 total)
- **Execution time**: ~1.5s (reasonable performance)

## Lessons Learned

1. **Mock Hoisting**: Be careful with variable references in `vi.mock()` factories
2. **State Isolation**: Always clear shared state between tests
3. **API Contracts**: Ensure test mocks match actual API response structures
4. **Async Testing**: Properly handle async operations with `waitFor()` and `act()`
5. **Cache Management**: Consider cache behavior when testing stateful hooks

## Next Steps

The useProducts hook tests are now fully functional and can serve as a reference for fixing other hook tests (useChat, useConversations) that may have similar issues.
