# Implementation Plan

- [x] 1. Create standardized mock infrastructure
  - Create centralized mock factory system with type-safe builders for all hook return values
  - Implement mock data builders for messages, products, conversations, and errors
  - Ensure all mock structures exactly match actual hook interfaces
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 1.1 Create mock factory file with hook return value factories
  - Write `createMockUseChatReturn` factory with all useChat return properties
  - Write `createMockUseProductsReturn` factory with all useProducts return properties
  - Write `createMockUseConversationsReturn` factory with all useConversations return properties
  - Write `createMockUseApiReturn` factory for API hook mocking
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.2 Create mock data builder functions
  - Write `createMockMessage` builder for chat messages
  - Write `createMockProduct` builder for product data
  - Write `createMockConversation` builder for conversation data
  - Write `createMockApiError` builder for error objects
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.3 Update test utilities to use standardized mocks
  - Update `test-utils.tsx` to import and use mock factories
  - Implement `setupMocks` function for consistent mock initialization
  - Add `updateMockHook` helper for dynamic mock updates during tests
  - Ensure proper mock reset between tests
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Fix ChatInterface component integration
  - Update ChatInterface to properly handle all hook states (loading, error, empty, populated)
  - Add defensive null/undefined checks for hook data
  - Add data-testid attributes for reliable test queries
  - Ensure proper rendering of messages, loading states, and errors
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2.1 Add defensive programming to ChatInterface
  - Add null coalescing for messages array (`messages ?? []`)
  - Add conditional rendering for empty message state
  - Add proper error boundary integration
  - Ensure loading state displays correctly
  - _Requirements: 1.2, 1.4, 1.5_

- [x] 2.2 Add test identifiers to ChatInterface
  - Add `data-testid="chat-interface"` to main container
  - Add `data-testid="chat-messages"` to message display area
  - Add `data-testid="loading-spinner"` to loading indicator
  - Add `data-testid="chat-error"` to error display
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 2.3 Update ChatInterface to render messages from hook state
  - Ensure ChatHistory component receives messages prop correctly
  - Verify message rendering with different message counts (0, 1, many)
  - Test message display with various content types
  - _Requirements: 1.2, 1.6, 1.7_

- [x] 3. Fix ProductBrowser component integration
  - Update ProductBrowser to properly handle all hook states
  - Add defensive null/undefined checks for product data
  - Add data-testid attributes and accessibility labels
  - Ensure proper rendering of products, search, filters, and states
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3.1 Add defensive programming to ProductBrowser
  - Add null coalescing for products array (`products ?? []`)
  - Add conditional rendering for empty product state
  - Add proper error display integration
  - Ensure loading state displays correctly
  - _Requirements: 2.2, 2.5, 2.6_

- [x] 3.2 Add test identifiers and accessibility to ProductBrowser
  - Add `data-testid="product-browser"` to main container
  - Add `data-testid="product-search-input"` and `aria-label` to search input
  - Add `data-testid="product-list"` to product list container
  - Add `data-testid="product-loading"` and `data-testid="product-error"` for states
  - Add `data-testid="product-empty-state"` for empty results
  - _Requirements: 2.2, 2.3, 2.5, 2.6_

- [x] 3.3 Update ProductBrowser to integrate with search and filter hooks
  - Ensure search input calls setSearchTerm on change
  - Verify filter controls update filters state
  - Test product list updates when search/filter changes
  - _Requirements: 2.3, 2.4, 2.7_

- [x] 4. Fix API error handling integration
  - Update error display components to show error messages correctly
  - Add retry button functionality for retryable errors
  - Ensure loading states are managed during API operations
  - Verify error boundaries catch and display errors properly
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4.1 Update ApiErrorDisplay component
  - Ensure error message is displayed from error object
  - Add retry button for errors with status >= 500
  - Add proper styling and accessibility for error display
  - Add `data-testid="error-message"` and `data-testid="retry-button"`
  - _Requirements: 3.2, 3.3, 3.6_

- [x] 4.2 Fix loading state management in components
  - Ensure loading indicators appear when isLoading is true
  - Ensure loading indicators disappear when operations complete
  - Verify loading states don't persist after errors
  - Test loading state transitions in all components
  - _Requirements: 3.4, 3.5_

- [x] 4.3 Verify error boundary integration
  - Ensure ErrorBoundary catches component errors
  - Verify error boundary displays fallback UI
  - Test error boundary reset functionality
  - _Requirements: 3.1, 3.6_

- [x] 5. Update chat flow integration tests
  - Rewrite chat flow tests to use standardized mocks
  - Add tests for all chat states (empty, loading, error, populated)
  - Ensure tests use proper async handling and queries
  - Verify message sending and display functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 5.1 Create focused chat rendering test
  - Test ChatInterface renders with empty messages
  - Test ChatInterface renders with multiple messages
  - Test messages display correct content and metadata
  - _Requirements: 1.2, 1.6_

- [x] 5.2 Create chat interaction test
  - Test sending a message calls sendMessage function
  - Test message input clears after sending
  - Test send button is disabled during loading
  - _Requirements: 1.3, 1.4_

- [x] 5.3 Create chat error handling test
  - Test error message displays when error occurs
  - Test retry button appears for retryable errors
  - Test retry button calls retryLastMessage
  - _Requirements: 1.5_

- [x] 5.4 Create chat loading state test
  - Test loading indicator appears when isLoading is true
  - Test loading indicator disappears when loading completes
  - Test input is disabled during loading
  - _Requirements: 1.4_

- [x] 6. Update product search integration tests
  - Rewrite product search tests to use standardized mocks
  - Add tests for all product states (empty, loading, error, populated)
  - Ensure tests verify search and filter functionality
  - Test product list rendering and interaction
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 6.1 Create focused product rendering test
  - Test ProductBrowser renders with empty products
  - Test ProductBrowser renders with multiple products
  - Test product count displays correctly
  - _Requirements: 2.2, 2.6_

- [x] 6.2 Create product search test
  - Test search input is accessible and functional
  - Test typing in search calls setSearchTerm
  - Test search term updates trigger product filtering
  - _Requirements: 2.3_

- [x] 6.3 Create product filter test
  - Test filter controls are accessible
  - Test applying filters calls setFilters
  - Test product list updates with filtered results
  - _Requirements: 2.4_

- [x] 6.4 Create product loading and error test
  - Test loading indicator appears when products are loading
  - Test error message displays when error occurs
  - Test empty state displays when no products match
  - _Requirements: 2.5, 2.6_

- [x] 7. Update API interaction integration tests
  - Rewrite API interaction tests to use standardized mocks
  - Add comprehensive error handling tests
  - Test loading state management during API calls
  - Verify retry functionality for failed operations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7.1 Create API error display test
  - Test error messages display correctly in UI
  - Test different error types (network, server, client)
  - Test error details are accessible
  - _Requirements: 3.1, 3.6_

- [x] 7.2 Create API retry functionality test
  - Test retry button appears for retryable errors (5xx)
  - Test retry button does not appear for non-retryable errors (4xx)
  - Test clicking retry button calls retry function
  - _Requirements: 3.2, 3.7_

- [x] 7.3 Create API loading state test
  - Test loading state activates during API calls
  - Test loading state clears on success
  - Test loading state clears on error
  - _Requirements: 3.4, 3.5_

- [ ] 8. Improve test infrastructure reliability
  - Implement consistent mock reset strategy
  - Add proper async operation handling
  - Standardize query methods and assertions
  - Add debugging utilities for test failures
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 8.1 Implement test setup and cleanup
  - Add beforeEach hook to reset all mocks
  - Add afterEach hook to cleanup DOM and timers
  - Ensure proper mock isolation between tests
  - _Requirements: 5.1, 5.3_

- [ ] 8.2 Standardize async operation handling
  - Use `waitFor` for async state updates
  - Use `findBy` queries for elements that appear asynchronously
  - Add appropriate timeouts for slow operations
  - _Requirements: 5.4_

- [ ] 8.3 Standardize query methods
  - Use `getBy` for elements that should exist
  - Use `queryBy` for elements that may not exist
  - Use `findBy` for elements that appear asynchronously
  - Add clear error messages for failed queries
  - _Requirements: 5.5, 5.6_

- [ ] 8.4 Add test debugging utilities
  - Add helper to log component state during tests
  - Add helper to inspect mock call history
  - Add helper to debug async operation timing
  - _Requirements: 5.6_

- [ ] 9. Verify component integration across boundaries
  - Test state propagation between parent and child components
  - Verify hook data flows correctly through component tree
  - Test component lifecycle in test environment
  - Ensure proper cleanup on component unmount
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 9.1 Test ChatInterface component hierarchy
  - Verify ChatHistory receives messages from ChatInterface
  - Test ChatInput sends messages through ChatInterface
  - Verify ConversationSidebar integrates with chat state
  - _Requirements: 4.1, 4.2, 4.5_

- [ ] 9.2 Test ProductBrowser component hierarchy
  - Verify ProductList receives products from ProductBrowser
  - Test ProductFilters updates filter state
  - Verify ProductDetail displays selected product
  - _Requirements: 4.1, 4.2, 4.5_

- [ ] 9.3 Test component lifecycle and cleanup
  - Verify components mount correctly with mocked data
  - Test components unmount without errors
  - Ensure event listeners are cleaned up
  - Verify no memory leaks from component state
  - _Requirements: 4.6, 4.7_

- [ ] 10. Run full integration test suite and validate
  - Execute complete integration test suite
  - Verify all tests pass with ≥95% pass rate
  - Check for flaky tests by running multiple times
  - Document any remaining issues or edge cases
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [ ] 10.1 Run chat flow tests
  - Execute all chat flow integration tests
  - Verify ≥95% pass rate
  - Document any failures with root cause analysis
  - _Requirements: 1.1_

- [ ] 10.2 Run product search tests
  - Execute all product search integration tests
  - Verify ≥95% pass rate
  - Document any failures with root cause analysis
  - _Requirements: 2.1_

- [ ] 10.3 Run API interaction tests
  - Execute all API interaction integration tests
  - Verify ≥95% pass rate
  - Document any failures with root cause analysis
  - _Requirements: 3.1_

- [ ] 10.4 Verify test stability
  - Run full test suite 5 times consecutively
  - Verify consistent results across all runs
  - Identify and fix any flaky tests
  - _Requirements: 5.1_

- [ ] 10.5 Document test results and coverage
  - Create summary of test pass rates by category
  - Document test coverage metrics
  - Create troubleshooting guide for common test failures
  - Document best practices for writing new integration tests
  - _Requirements: 5.6, 5.7_
