# Implementation Plan

- [ ] 1. Fix ChatInput component integration (High Impact - ~80 tests)
  - Update ChatInterface prop passing to combine loading and error states into disabled prop
  - Add form wrapper to ChatInput component for proper form submission handling
  - Add FormEvent import to ChatInput component
  - Update ChatInput to use disabled prop directly for input and button control
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 1.1 Update ChatInterface prop passing logic
  - Modify ChatInterface.tsx line 165 to pass combined disabled state
  - Change from separate isLoading and disabled props to unified disabled prop
  - Maintain isLoading prop for spinner display purposes
  - _Requirements: 1.1, 1.3_

- [ ] 1.2 Add form wrapper to ChatInput component
  - Wrap ChatInput return JSX in form element with onSubmit handler
  - Add handleFormSubmit function to prevent default form behavior
  - Change Button type to "submit" for proper form submission
  - Add FormEvent import to React imports
  - _Requirements: 1.2, 1.4_

- [ ] 1.3 Update ChatInput disabled state handling
  - Modify Textarea and Button to use disabled prop directly
  - Remove redundant disabled || isLoading logic in favor of single disabled prop
  - Ensure proper disabled styling and behavior
  - _Requirements: 1.3, 1.4_

- [ ] 2. Fix ProductBrowser loading state management (Medium Impact - ~25 tests)
  - Implement conditional rendering to show only one state at a time
  - Add ApiErrorDisplay integration with retry functionality
  - Fix ProductFilters clear functionality to pass empty object
  - Add required imports for LoadingState and ApiErrorDisplay
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2.1 Implement conditional rendering in ProductBrowser
  - Replace always-rendered ProductList with conditional rendering logic
  - Show error state when productsError exists
  - Show loading state when productsLoading is true and no products exist
  - Show product list only when no error and not in initial loading state
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2.2 Add ApiErrorDisplay integration
  - Import ApiErrorDisplay and LoadingState components
  - Add error display with retry functionality that calls searchProducts
  - Add loading state display with appropriate test IDs
  - Pass null error to ProductList when error is handled above
  - _Requirements: 2.2, 2.3_

- [ ] 2.3 Fix ProductFilters clear functionality
  - Update handleFiltersChange to accept clearing flag parameter
  - Modify clearFilters to call handleFiltersChange with clearing flag
  - Ensure empty object {} is passed when clearing instead of default values
  - _Requirements: 2.4_

- [ ] 3. Fix ApiErrorDisplay button text consistency (Low Impact - ~3 tests)
  - Update retry button text from "Try Again" to "Retry"
  - Ensure consistent button text across all error display modes
  - Verify InlineApiError already uses correct "Retry" text
  - _Requirements: 3.1, 3.2_

- [ ] 3.1 Update ApiErrorDisplay retry button text
  - Change button text from "Try Again" to "Retry" in main error display
  - Maintain existing button functionality and styling
  - Keep RefreshCw icon and data-testid attributes unchanged
  - _Requirements: 3.1_

- [ ] 4. Resolve test ID conflicts (Low Impact - ~3 tests)
  - Add testId prop to LoadingSpinner component
  - Update LoadingState to pass testId through to LoadingSpinner
  - Use context-specific test IDs in ProductBrowser and other components
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4.1 Add configurable test IDs to LoadingSpinner
  - Add optional testId prop to LoadingSpinnerProps interface
  - Update LoadingSpinner to use testId prop or default to "loading-spinner"
  - Maintain backward compatibility for existing usage
  - _Requirements: 4.1, 4.2_

- [ ] 4.2 Update LoadingState to support custom test IDs
  - Add optional testId prop to LoadingStateProps interface
  - Pass testId through to LoadingSpinner component
  - Update ProductBrowser to use "product-loading-spinner" test ID
  - _Requirements: 4.2, 4.3_

- [ ] 5. Validate and test implementation
  - Run integration tests after each phase to verify improvements
  - Ensure test stability is maintained (zero flaky tests)
  - Verify final pass rate meets ≥95% target (248+ passing tests)
  - Document final test results and improvements achieved
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5.1 Phase-by-phase validation testing
  - Run chat flow tests after Phase 1 completion
  - Run product search tests after Phase 2 completion
  - Run API error tests after Phase 3 completion
  - Run full integration suite after Phase 4 completion
  - _Requirements: 5.3_

- [ ] 5.2 Write comprehensive unit tests for fixed components
  - Create unit tests for ChatInput form submission behavior
  - Write unit tests for ProductBrowser conditional rendering logic
  - Add unit tests for ApiErrorDisplay button text consistency
  - Create unit tests for LoadingSpinner test ID functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 4.2_

- [ ] 5.3 Create integration test coverage for new functionality
  - Write integration tests for ChatInput and ChatInterface interaction
  - Create integration tests for ProductBrowser state management
  - Add integration tests for error handling with retry functionality
  - Write integration tests for test ID uniqueness validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3_

- [ ] 5.4 Final test suite validation and performance testing
  - Execute full integration test suite 5 times consecutively
  - Verify pass rate improvement from 54.4% to ≥95%
  - Confirm zero flaky tests maintained throughout implementation
  - Run performance tests to ensure no regression in test execution time
  - Document before/after metrics and improvement summary
  - _Requirements: 5.1, 5.2, 5.4_
