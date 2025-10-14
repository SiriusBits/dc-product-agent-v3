# Implementation Plan: Frontend Test Fixes

## Milestone 1: Foundation - Test Infrastructure

- [x] 1. Update test utilities and mock helpers
  - Enhance `createMockChatMessage` to support all ChatMessage properties including sources
  - Add `createMockConversation` helper function
  - Add `createMockProductDetail` helper function
  - Ensure all mock API client methods return proper response structures
  - _Requirements: 5.1, 5.2_

- [x] 2. Fix global mock configurations
  - Update vitest setup to properly reset mocks between tests
  - Ensure clipboard API mock is properly configured
  - Add scrollIntoView mock for auto-scroll tests
  - _Requirements: 5.1, 5.2_

- [x] 3. Create centralized timestamp formatting utility
  - Create `formatTimestamp` function in `apps/frontend/src/lib/utils.ts`
  - Implement 12-hour format with AM/PM (e.g., "2:30 PM")
  - Export function for use in components and tests
  - _Requirements: 1.2_

- [x] 4. Verify test infrastructure
  - Run test suite to establish baseline
  - Document any remaining infrastructure issues
  - _Requirements: 5.1_

## Milestone 2: ChatMessage Component Fixes

- [x] 5. Add data-testid attributes to ChatMessage
  - Add `data-testid="message-container"` to main container div
  - Ensure attribute is present for both user and assistant messages
  - _Requirements: 1.1_

- [x] 6. Fix timestamp formatting in ChatMessage
  - Import and use centralized `formatTimestamp` utility
  - Replace any inline date formatting with utility function
  - Verify timestamp displays in 12-hour format
  - _Requirements: 1.2_

- [x] 7. Fix markdown rendering styles
  - Update markdown CSS to use `font-weight: bold` for strong tags
  - Add `.markdown-content strong { font-weight: bold; }` rule
  - Test that bold text renders with correct weight
  - _Requirements: 1.3_

- [x] 8. Fix confidence score rendering
  - Consolidate confidence score into single text node (e.g., "95%")
  - Update source card component to render score without splitting
  - Ensure score is accessible via `getByText('95%')`
  - _Requirements: 1.4_

- [x] 9. Ensure copy button accessibility
  - Verify copy button has proper aria-label or accessible name
  - Ensure button is queryable via `getByRole('button', { name: /copy/i })`
  - Test hover behavior shows copy button
  - _Requirements: 1.5_

- [x] 10. Add error styling classes
  - Add `border-red-200` class to error message containers
  - Ensure error messages have distinct visual styling
  - Verify error styling is applied correctly in tests
  - _Requirements: 1.6_

- [x] 11. Run ChatMessage tests
  - Execute ChatMessage test suite
  - Verify all 10 ChatMessage tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

## Milestone 3: ProductBrowser Component Fixes

- [x] 12. Fix useProducts hook mock configuration
  - Update mock to export both `useProducts` and `useProductDetail`
  - Use `importOriginal` pattern for partial mocking
  - Ensure mock returns complete hook interface
  - _Requirements: 2.1, 2.2_

- [x] 13. Implement useProductDetail hook
  - Create or verify `useProductDetail` hook exists in `useProducts.ts`
  - Implement product detail loading functionality
  - Export hook from module
  - _Requirements: 2.2_

- [x] 14. Fix ProductBrowser component structure
  - Ensure all expected UI elements are rendered
  - Add search input with proper placeholder text
  - Add filter controls (family, application)
  - Add "Clear Filters" button in ProductFilters component
  - Add sort dropdown with options (Name A-Z, etc.)
  - Add proper aria-labels for view mode buttons ("Grid View" / "List View")
  - _Requirements: 2.3_

- [x] 15. Implement product filtering
  - Wire up filter controls to state management
  - Call searchProducts with filter parameters
  - Update product list when filters change
  - _Requirements: 2.4_

- [x] 16. Implement search debouncing
  - Add debounce logic to search input (300-500ms)
  - Ensure only final search value triggers API call
  - Test debouncing behavior
  - _Requirements: 2.5_

- [x] 17. Implement product comparison feature
  - Add comparison checkboxes to product cards
  - Track selected products in state
  - Enable compare button when products are selected
  - _Requirements: 2.6_

- [x] 18. Add loading and error states
  - Show loading spinner when products are loading
  - Display error message when API call fails
  - Show empty state when no products found
  - _Requirements: 2.3_

- [x] 19. Add keyboard navigation support
  - Implement arrow key navigation for product list
  - Add Enter key handler for product selection
  - Ensure focus management works correctly
  - _Requirements: 2.3_

- [x] 20. Add product count display and pagination
  - Show total product count in UI
  - Update count when filters are applied
  - Format count appropriately (e.g., "Showing 5 of 50 products")
  - Add pagination controls with "Next Page" and "Previous Page" buttons
  - Update "Load More" button to "Next Page" for consistency
  - _Requirements: 2.3_

- [x] 21. Run ProductBrowser tests
  - Execute ProductBrowser test suite
  - Verify all 23 ProductBrowser tests pass
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 21.1 Fix ProductCard to display product benefits
  - Add benefits section to ProductCard component
  - Display benefits as badges or list items
  - Ensure benefits are visible in both grid and list views
  - _Requirements: 2.3_
3- [x] 21.2 Fix ProductCard to display enhanced properties
  - Ensure key_properties array is properly displayed
  - Format properties for readability
  - Add proper styling for property display
  - _Requirements: 2.3_

- [x] 21.3 Add URL state management for search params
  - Implement URL query parameter handling for search state
  - Preserve search query, family, and application filters in URL
  - Restore state from URL on component mount
  - Update URL when filters change
  - _Requirements: 2.5_

- [x] 21.4 Fix compare button label
  - Change "Compare Products" button label to "Compare"
  - Ensure button is properly labeled for accessibility
  - Update aria-label if needed
  - _Requirements: 2.6_

- [x] 21.5 Fix navigation to product detail
  - Ensure product card click properly navigates to detail view
  - Implement proper routing or tab switching
  - Test navigation flow
  - _Requirements: 2.2_

- [x] 21.6 Re-run ProductBrowser tests
  - Execute ProductBrowser test suite again
  - Verify all 23 tests now pass
  - Document any remaining issues
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

## Milestone 4: Hook Implementation Fixes

- [x] 22. Fix useChat hook implementation
  - Ensure proper error handling and state management
  - Implement retry logic for failed messages
  - Handle concurrent message sending
  - Clear error state when sending new message
  - _Requirements: 3.1, 3.4, 3.5_
- [x] 23. Fix useProducts hook implementation
  - Implement search with proper debouncing
  - Add filter support (family, applications)
  - Implement result caching
  - Handle empty search results
  - _Requirements: 3.2, 3.4, 3.5_

- [x] 24. Fix useConversations hook implementation
  - Implement conversation loading and management
  - Add conversation creation and deletion
  - Handle conversation title updates
  - Implement proper error handling
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 25. Ensure proper cleanup in hooks
  - Add cleanup functions to useEffect hooks
  - Cancel pending requests on unmount
  - Clear timers and intervals
  - _Requirements: 3.5_

- [x] 26. Run hook tests
  - Execute useChat test suite
  - Execute useProducts test suite
  - Execute useConversations test suite
  - Verify all hook tests pass
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

## Milestone 5: Integration Test Fixes

- [x] 27. Fix ChatInterface integration tests
  - Ensure ChatInterface properly integrates useChat and useConversations
  - Fix message sending flow
  - Fix conversation switching flow
  - Fix keyboard shortcuts
  - _Requirements: 4.1, 4.3_

- [x] 28. Fix chat flow integration tests
  - Verify complete conversation flow works end-to-end
  - Test message sending, receiving, and display
  - Test source attribution display
  - Test error handling and retry
  - _Requirements: 4.1, 4.4_

- [x] 29. Fix product search integration tests
  - Verify search and filter combinations work correctly
  - Test product detail navigation
  - Test comparison feature
  - Test pagination
  - _Requirements: 4.2, 4.3_

- [x] 30. Fix API interaction tests
  - Ensure proper API call mocking
  - Test error handling and retry logic
  - Verify loading states during API calls
  - _Requirements: 4.4_

- [x] 31. Run full integration test suite
  - Execute all integration tests
  - Verify chat-flow tests pass
  - Verify product-search tests pass
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

## Milestone 6: Final Verification and Cleanup

- [ ] 32. Run complete test suite
  - Execute all tests with verbose output
  - Verify 0 failures, 132 passing
  - Check for console warnings or errors
  - _Requirements: 5.5_

- [ ] 33. Verify test performance
  - Ensure test execution time is reasonable (<60s)
  - Identify and optimize slow tests if needed
  - _Requirements: 5.4_

- [ ] 34. Update test documentation
  - Document any test patterns or conventions
  - Add comments for complex test setups
  - Update README with testing guidelines
  - _Requirements: 5.5_

- [ ] 35. Code review and cleanup
  - Remove any debug code or console logs
  - Ensure consistent code style
  - Verify no unused imports or variables
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
