# Implementation Plan: Comprehensive Frontend Test Suite Fix

## Phase 1: Reactive Mock Infrastructure

- [x] 1. Implement ReactiveHookMock class
  - Create `apps/frontend/src/test/reactive-mocks.ts` file
  - Implement `ReactiveHookMock<T>` class with constructor accepting initial value
  - Implement `updateValue()` method that wraps updates in React's `act()`
  - Implement `getMock()` method returning Vitest mock function
  - Implement `getCurrentValue()` method for reading state
  - Implement `reset()` method to restore initial value
  - Implement `subscribe()` method for debugging support
  - Add TypeScript interfaces for all public APIs
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.1 Add unit tests for ReactiveHookMock
  - Test that `updateValue()` triggers React re-renders via `act()`
  - Test that partial updates merge correctly with existing state
  - Test that `reset()` restores initial value
  - Test that multiple sequential updates work correctly
  - Test that subscription callbacks are called on updates
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement MockRegistry singleton
  - Create `MockRegistry` class in `apps/frontend/src/test/reactive-mocks.ts`
  - Implement `register()` method for adding mocks to registry
  - Implement `get()` method with type-safe retrieval
  - Implement `update()` method for updating mocks by name
  - Implement `resetAll()` method to reset all registered mocks
  - Implement `clearAll()` method for test cleanup
  - Implement `getRegisteredNames()` for debugging
  - Export singleton instance as `mockRegistry`
  - _Requirements: 1.4, 4.4_

- [x] 2.1 Add unit tests for MockRegistry
  - Test mock registration and retrieval
  - Test type-safe mock updates
  - Test `resetAll()` resets all mocks to initial values
  - Test `clearAll()` removes all mocks
  - Test registry isolation between test files
  - _Requirements: 1.4, 4.4, 7.3_

- [x] 3. Create enhanced setupTest function
  - Create `apps/frontend/src/test/enhanced-setup.ts` file (or update existing)
  - Implement `setupTest()` function accepting `SetupOptions`
  - Create reactive mocks for useChat, useProducts, useConversations
  - Register all mocks with MockRegistry
  - Return `TestContext` with mock instances and helper functions
  - Implement `updateChat()`, `updateProducts()`, `updateConversations()` helpers
  - Implement `renderComponent()` helper with automatic cleanup
  - Set up automatic cleanup in `afterEach` hook
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.3, 4.4_

- [x] 3.1 Add integration tests for setupTest
  - Test that setupTest creates all required mocks
  - Test that update helpers trigger component re-renders
  - Test that renderComponent provides enhanced utilities
  - Test that automatic cleanup works between tests
  - Test that custom options override defaults correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.3_

## Phase 2: User Input Utilities

- [x] 4. Implement typeIntoInput utility
  - Create `apps/frontend/src/test/input-utilities.ts` file
  - Implement `typeIntoInput()` function with clear-first behavior
  - Add `TypeOptions` interface with clearFirst, delay, skipClick options
  - Default clearFirst to true to prevent duplicate characters
  - Use userEvent.clear() before userEvent.type()
  - Add error handling for invalid elements
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 4.1 Add unit tests for typeIntoInput
  - Test that typing produces exact input text without duplication
  - Test that clearFirst option works correctly
  - Test that delay option is respected
  - Test that skipClick option prevents initial click
  - Test error handling for non-input elements
  - _Requirements: 2.1, 2.2_

- [x] 5. Implement submitForm utility
  - Add `submitForm()` function to `apps/frontend/src/test/input-utilities.ts`
  - Add `SubmitOptions` interface with viaEnterKey and viaButton options
  - Implement Enter key submission using userEvent.keyboard('{Enter}')
  - Implement button submission using userEvent.click()
  - Verify form onSubmit handler is called exactly once
  - Add error handling for missing form elements
  - _Requirements: 2.3_

- [x] 5.1 Add unit tests for submitForm
  - Test Enter key submission calls onSubmit once
  - Test button submission calls onSubmit once
  - Test that default form behavior is prevented
  - Test error handling for invalid form elements
  - _Requirements: 2.3_

- [x] 6. Implement waitForDebounce utility
  - Add `waitForDebounce()` function to `apps/frontend/src/test/input-utilities.ts`
  - Accept callback function and optional delay parameter
  - Use vi.advanceTimersByTime() to skip debounce period
  - Wait for callback completion using waitFor()
  - Default delay to 500ms to match common debounce values
  - _Requirements: 2.4, 5.3_

- [x] 6.1 Add unit tests for waitForDebounce
  - Test that debounce period is properly skipped
  - Test that callback is executed after delay
  - Test with custom delay values
  - Test with async callbacks
  - _Requirements: 2.4, 5.3_

## Phase 3: Component Integration Fixes

- [x] 7. Fix ChatInput disabled state handling
  - Update ChatInput component to properly handle disabled prop
  - Ensure textarea and button are disabled when disabled=true
  - Update ChatInterface to pass combined disabled state
  - Add form wrapper with onSubmit handler to ChatInput
  - Change button type to "submit" for proper form submission
  - _Requirements: 3.1, 3.4_

- [x] 7.1 Update ChatInput integration tests
  - Migrate tests to use new reactive mock infrastructure
  - Test that disabled state properly disables input and button
  - Test that form submission works via Enter key
  - Test that form submission works via button click
  - Test that loading state disables input correctly
  - _Requirements: 3.1, 3.4_

- [x] 8. Fix ProductBrowser conditional rendering
  - Update ProductBrowser to show only one state at a time
  - Show loading state when productsLoading=true and no products
  - Show error state when productsError exists
  - Show product list only when no error and not loading
  - Add ApiErrorDisplay with retry functionality
  - Fix ProductFilters to pass empty object {} when clearing
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 8.1 Update ProductBrowser integration tests
  - Migrate tests to use new reactive mock infrastructure
  - Test that only loading state shows when loading
  - Test that only error state shows when error exists
  - Test that retry button calls searchProducts
  - Test that clearing filters passes empty object
  - Test that product list shows when data loaded successfully
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 9. Fix ApiErrorDisplay button consistency
  - Update ApiErrorDisplay retry button text to "Retry"
  - Ensure consistent button text across all error modes
  - Verify InlineApiError uses "Retry" text
  - Update tests to expect "Retry" button text
  - _Requirements: 3.3_

- [x] 9.1 Update ApiErrorDisplay tests
  - Test that retry button displays "Retry" text
  - Test that retry button calls provided handler
  - Test that non-retryable errors don't show retry button
  - _Requirements: 3.3_

- [x] 10. Resolve test ID conflicts
  - Add optional testId prop to LoadingSpinner component
  - Update LoadingState to accept and pass through testId
  - Use context-specific test IDs in ProductBrowser
  - Use context-specific test IDs in ChatInterface
  - Ensure no duplicate test IDs exist in any component tree
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 10.1 Add test ID uniqueness validation
  - Create utility to detect duplicate test IDs in rendered components
  - Add tests that verify no duplicate test IDs exist
  - Test LoadingSpinner with custom test IDs
  - Test LoadingState with custom test IDs
  - _Requirements: 4.1, 4.2, 4.3_

## Phase 4: Test Suite Migration and Optimization

- [x] 11. Migrate high-impact integration tests
  - Migrate `apps/frontend/src/test/integration/chat-flow.test.tsx` to use reactive mocks
  - Migrate `apps/frontend/src/test/integration/product-search.test.tsx` to use reactive mocks
  - Migrate `apps/frontend/src/test/integration/api-interaction.test.tsx` to use reactive mocks
  - Update all tests to use new input utilities
  - Verify tests pass with new infrastructure
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 12. Migrate hook unit tests
  - Migrate `apps/frontend/src/hooks/__tests__/useChat.test.ts` to use reactive mocks
  - Migrate `apps/frontend/src/hooks/__tests__/useProducts.test.ts` to use reactive mocks
  - Migrate `apps/frontend/src/hooks/__tests__/useConversations.test.ts` to use reactive mocks
  - Update all async operation tests to use new utilities
  - Verify all hook tests pass
  - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3_

- [x] 13. Migrate component unit tests
  - Migrate `apps/frontend/src/components/chat/__tests__/ChatInterface.test.tsx`
  - Migrate `apps/frontend/src/components/chat/__tests__/ChatInput.test.tsx`
  - Migrate `apps/frontend/src/components/products/__tests__/ProductBrowser.test.tsx`
  - Migrate `apps/frontend/src/components/error/__tests__/ApiErrorDisplay.test.tsx`
  - Update all tests to use standardized mock factories
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

- [x] 14. Consolidate test utilities
  - Remove duplicate mock utilities from old test files
  - Update all imports to use new centralized utilities
  - Deprecate old utility functions with clear migration messages
  - Create migration guide document
  - Update test documentation with new patterns
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 15. Optimize test performance
  - Profile slow tests and identify bottlenecks
  - Implement lazy mock initialization where safe
  - Enable parallel test execution for independent test files
  - Reduce unnecessary DOM operations in tests
  - Optimize mock creation and cleanup overhead
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 15.1 Add performance monitoring
  - Create performance tracking utility for test execution
  - Add benchmarks for mock creation time
  - Add benchmarks for test file execution time
  - Generate performance report after test runs
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

## Phase 5: Validation and Stabilization

- [ ] 16. Run full test suite validation
  - Execute full test suite 10 consecutive times
  - Verify pass rate ≥95% (664+ passing tests)
  - Verify zero flaky tests across all runs
  - Verify execution time ≤90 seconds
  - Document any remaining failures with root cause analysis
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 16.1 Create test stability report
  - Document pass rate improvement from 66.7% to ≥95%
  - List all fixed test categories and counts
  - Provide before/after metrics for execution time
  - Document any edge cases or known limitations
  - _Requirements: 7.4, 7.5_

- [ ] 17. Fix any remaining test failures
  - Analyze root causes of any tests still failing
  - Apply targeted fixes using established patterns
  - Verify fixes don't introduce new failures
  - Re-run validation suite after each fix
  - _Requirements: 7.4, 7.5_

- [ ] 18. Create developer documentation
  - Write guide for using reactive mock infrastructure
  - Document input utility functions with examples
  - Create troubleshooting guide for common test issues
  - Add examples of migrating old tests to new infrastructure
  - Update project README with testing best practices
  - _Requirements: 4.5_

- [ ] 19. Clean up deprecated code
  - Remove old mock utility files after full migration
  - Remove deprecated function implementations
  - Clean up unused test helper functions
  - Remove debug code and console logs
  - Verify no unused imports remain
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 20. Final validation and sign-off
  - Run complete test suite one final time
  - Verify all success criteria are met
  - Generate final metrics report
  - Create summary document of improvements
  - Mark spec as complete
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
