# Requirements Document - API-Level Mock Test Migration

## Introduction

This spec defines the requirements for migrating the frontend test suite from hook-level mocking to API-level mocking to achieve a 60% test pass rate. Based on extensive research (documented in `apps/frontend/src/test/RESEARCH-FINDINGS.md`), we've identified that mocking hooks breaks React's rendering cycle, while mocking the API client allows real hooks to function properly.

## Glossary

- **API Client**: The `apiClient` object in `@/lib/api-client` that makes HTTP requests to the backend
- **Hook-Level Mocking**: Using `vi.mock('@/hooks/useChat')` to mock entire React hooks (BROKEN APPROACH)
- **API-Level Mocking**: Using `vi.mock('@/lib/api-client')` to mock API responses while letting real hooks run (CORRECT APPROACH)
- **Test Pass Rate**: Percentage of tests that pass successfully (currently 46%, target 60%)
- **Component Test**: Test that renders a React component and verifies its behavior
- **Integration Test**: Test that verifies multiple components working together
- **Real Hook**: An unmocked React hook that maintains actual React state

## Requirements

### Requirement 1: Achieve 60% Test Pass Rate

**User Story:** As a developer, I want the test suite to have at least 60% pass rate, so that I can trust the tests and catch regressions.

#### Acceptance Criteria

1. WHEN THE test suite runs, THE Test System SHALL achieve a pass rate of at least 60%
2. WHEN THE test suite completes, THE Test System SHALL report at least 33 passing tests out of 55 total tests
3. WHEN THE test results are measured, THE Test System SHALL show improvement from the current 46% baseline
4. WHERE THE pass rate is calculated, THE Test System SHALL use the formula (passing tests / total tests) * 100

### Requirement 2: Migrate to API-Level Mocking

**User Story:** As a test engineer, I want tests to mock the API client instead of hooks, so that React components render and update correctly.

#### Acceptance Criteria

1. WHEN A component test is written, THE Test SHALL mock the `@/lib/api-client` module
2. WHEN A component test runs, THE Test SHALL allow real hooks to execute with mocked API responses
3. WHEN THE API client is mocked, THE Test SHALL provide mock implementations for all required API methods
4. IF A test needs to simulate loading states, THEN THE Test SHALL use delayed Promise resolution in API mocks
5. WHILE A component is rendering, THE Test SHALL allow real React state management to function

### Requirement 3: Validate Migration Approach

**User Story:** As a quality engineer, I want to validate that API-level mocking works correctly, so that we don't waste time on another broken approach.

#### Acceptance Criteria

1. WHEN THE migration begins, THE Test System SHALL create proof-of-concept tests for each component type
2. WHEN A proof-of-concept test runs, THE Test System SHALL verify that components render successfully
3. WHEN STATE updates occur, THE Test System SHALL verify that components re-render correctly
4. WHERE LOADING states are tested, THE Test System SHALL verify that loading indicators appear and disappear
5. IF THE proof-of-concept fails, THEN THE Test System SHALL halt migration and report issues

### Requirement 4: Prioritize High-Impact Tests

**User Story:** As a project manager, I want to fix the most important tests first, so that we reach 60% pass rate efficiently.

#### Acceptance Criteria

1. WHEN TESTS are prioritized, THE Test System SHALL identify tests that cover core functionality
2. WHEN MIGRATION order is determined, THE Test System SHALL prioritize tests with highest user impact
3. WHEN RESOURCES are allocated, THE Test System SHALL focus on tests that are easiest to fix first
4. WHERE MULTIPLE tests fail for the same reason, THE Test System SHALL fix them as a batch

### Requirement 5: Update Documentation

**User Story:** As a future developer, I want clear documentation on API-level mocking patterns, so that I can write tests correctly.

#### Acceptance Criteria

1. WHEN THE migration completes, THE Documentation SHALL include API-level mocking examples
2. WHEN A developer writes a new test, THE Documentation SHALL provide clear patterns to follow
3. WHEN ANTI-PATTERNS are identified, THE Documentation SHALL explicitly warn against them
4. WHERE MIGRATION guides exist, THE Documentation SHALL update them with correct approaches
5. IF A developer uses hook-level mocking, THEN THE Documentation SHALL explain why it fails

### Requirement 6: Maintain Test Performance

**User Story:** As a developer, I want tests to run quickly, so that I get fast feedback during development.

#### Acceptance Criteria

1. WHEN THE test suite runs, THE Test System SHALL complete in under 90 seconds
2. WHEN PERFORMANCE is measured, THE Test System SHALL maintain current execution time of ~7 seconds
3. IF TEST execution time increases, THEN THE Test System SHALL identify and optimize slow tests
4. WHILE TESTS run, THE Test System SHALL use existing performance optimization infrastructure

### Requirement 7: Ensure Test Isolation

**User Story:** As a test engineer, I want tests to be isolated from each other, so that failures don't cascade.

#### Acceptance Criteria

1. WHEN TESTS run in sequence, THE Test System SHALL reset all mocks between tests
2. WHEN A test completes, THE Test System SHALL clean up all DOM elements
3. WHEN LOCALSTORAGE is used, THE Test System SHALL clear it between tests
4. WHERE TESTS share mocks, THE Test System SHALL ensure proper isolation
5. IF A test fails, THEN THE Test System SHALL not affect subsequent tests

### Requirement 8: Preserve Existing Passing Tests

**User Story:** As a developer, I want to keep tests that already pass, so that we don't lose working functionality.

#### Acceptance Criteria

1. WHEN MIGRATION occurs, THE Test System SHALL identify currently passing tests
2. WHEN A passing test is migrated, THE Test System SHALL verify it still passes
3. IF A passing test breaks during migration, THEN THE Test System SHALL revert changes
4. WHERE TESTS already use API-level mocking, THE Test System SHALL leave them unchanged

## Success Criteria

The migration SHALL be considered successful when:

1. Test pass rate reaches or exceeds 60% (33+ passing tests)
2. All migrated tests use API-level mocking
3. Components render and update correctly in tests
4. Documentation is updated with correct patterns
5. Test execution time remains under 90 seconds
6. No currently passing tests are broken

## Out of Scope

The following are explicitly out of scope for this migration:

1. Fixing backend tests (Python)
2. Adding new test coverage
3. Refactoring component implementation
4. Changing test framework (staying with Vitest)
5. E2E test implementation
6. Performance optimization beyond maintaining current speed
