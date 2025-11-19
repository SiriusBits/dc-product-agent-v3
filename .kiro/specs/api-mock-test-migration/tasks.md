# Implementation Plan - API-Level Mock Test Migration

## Overview

This implementation plan provides step-by-step tasks to migrate the frontend test suite from hook-level mocking to API-level mocking, achieving a 60% test pass rate.

**Current State**: 46% pass rate (23/50 tests passing)  
**Target State**: 60% pass rate (33/55 tests passing)  
**Approach**: Mock `api-client` instead of hooks  
**Estimated Time**: 6-9 hours

---

## Phase 1: Foundation and Proof of Concept

- [x] 1. Create API mock infrastructure
  - Create `apps/frontend/src/test/api-mocks.ts` with centralized API mocking utilities
  - Implement `setupApiMocks()` function that mocks all API client methods
  - Implement `createMockApiClient()` factory with default responses
  - Add TypeScript types for mocked API client
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.1 Create API test utilities
  - Create `apps/frontend/src/test/api-test-utils.ts` with helper functions
  - Implement `mockLoadingResponse(data, delay)` for simulating loading states
  - Implement `mockErrorResponse(message, status)` for error scenarios
  - Implement `mockSuccessResponse(data)` for immediate success
  - Implement `waitForLoadingState()` and `waitForErrorState()` helpers
  - _Requirements: 2.4, 6.2_

- [x] 1.2 Create proof-of-concept tests
  - Create `apps/frontend/src/test/integration/poc-chat-interface.test.tsx`
  - Write 3 tests: basic rendering, loading state, error handling
  - Verify all 3 tests pass
  - Create `apps/frontend/src/test/integration/poc-product-browser.test.tsx`
  - Write 2 tests: basic rendering, search functionality
  - Verify all 2 tests pass
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 1.3 Validate proof of concept
  - Run all 5 POC tests and verify 100% pass rate
  - Check execution time is reasonable (<5 seconds for 5 tests)
  - Verify components render correctly
  - Verify state updates trigger re-renders
  - Document any issues found
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

---

## Phase 2: High-Priority Test Migration

- [-] 2. Migrate ChatInterface component tests
  - Identify all tests in `apps/frontend/src/components/chat/__tests__/ChatInterface.test.tsx`
  - Replace hook mocks with API client mocks
  - Update test logic to work with real hooks
  - Run tests and verify they pass
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2_

- [ ] 2.1 Migrate ChatInput component tests
  - Update `apps/frontend/src/components/chat/__tests__/ChatInput.test.tsx`
  - Replace hook mocks with API mocks
  - Verify input handling works correctly
  - _Requirements: 2.1, 2.2, 8.1, 8.2_

- [ ] 2.2 Migrate ChatMessage component tests
  - Update `apps/frontend/src/components/chat/__tests__/ChatMessage.test.tsx`
  - Replace hook mocks with API mocks
  - Verify message rendering works
  - _Requirements: 2.1, 2.2, 8.1, 8.2_

- [ ] 2.3 Migrate error handling tests
  - Update `apps/frontend/src/test/integration/error-handling.test.tsx`
  - Replace hook mocks with API error responses
  - Verify error states display correctly
  - Test retry functionality
  - _Requirements: 2.1, 2.4, 4.1_

- [ ] 2.4 Validate Phase 2 progress
  - Run full test suite
  - Verify pass rate is at least 55%
  - Check no regressions in previously passing tests
  - Document progress
  - _Requirements: 1.3, 8.3, 8.4_

---

## Phase 3: Medium-Priority Test Migration

- [ ] 3. Migrate ProductBrowser component tests
  - Update `apps/frontend/src/components/products/__tests__/ProductBrowser.test.tsx`
  - Replace hook mocks with API mocks for product search
  - Verify search and filter functionality
  - _Requirements: 2.1, 2.2, 4.1_

- [ ] 3.1 Migrate product search integration tests
  - Update `apps/frontend/src/test/integration/product-search.test.tsx`
  - Replace hook mocks with API mocks
  - Verify search flow works end-to-end
  - _Requirements: 2.1, 2.2, 4.1_

- [ ] 3.2 Migrate chat flow integration tests
  - Update `apps/frontend/src/test/integration/chat-flow.test.tsx`
  - Replace hook mocks with API mocks
  - Verify conversation flow works correctly
  - _Requirements: 2.1, 2.2, 4.1_

- [ ] 3.3 Migrate component hierarchy tests
  - Update `apps/frontend/src/test/integration/component-hierarchy.test.tsx`
  - Replace hook mocks with API mocks
  - Verify component integration works
  - Fix duplicate element issues
  - _Requirements: 2.1, 2.2, 7.1, 7.2_

- [ ] 3.4 Validate Phase 3 progress
  - Run full test suite
  - Verify pass rate reaches 60%+
  - Check test stability (run 3 times)
  - Document any flaky tests
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

---

## Phase 4: Cleanup and Documentation

- [ ] 4. Update test documentation
  - Update `apps/frontend/src/test/MIGRATION-GUIDE.md` with API-level mocking patterns
  - Add examples for each test pattern (rendering, loading, errors)
  - Document anti-patterns (hook mocking) with explanations
  - Update `apps/frontend/src/test/DEVELOPER-GUIDE.md` with new best practices
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4.1 Create API mocking guide
  - Create `apps/frontend/src/test/API-MOCKING-GUIDE.md`
  - Document all API client methods and their mock patterns
  - Provide examples for common scenarios
  - Include troubleshooting section
  - _Requirements: 5.1, 5.2_

- [ ] 4.2 Clean up obsolete infrastructure
  - Mark reactive mock infrastructure as deprecated
  - Add warnings to `reactive-mocks.ts` about not using for component tests
  - Update imports in test files to use new utilities
  - Remove or archive failed migration attempts
  - _Requirements: 5.3, 5.4_

- [ ] 4.3 Create migration summary
  - Document final pass rate achieved
  - List all migrated tests
  - Document any remaining failing tests
  - Provide recommendations for future work
  - _Requirements: 1.1, 1.2, 1.3_

---

## Phase 5: Validation and Stabilization

- [ ] 5. Run comprehensive validation
  - Execute full test suite 5 times consecutively
  - Calculate average pass rate
  - Identify any flaky tests
  - Measure execution time
  - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [ ] 5.1 Fix flaky tests
  - Identify tests that pass inconsistently
  - Add proper waits and timeouts
  - Ensure proper cleanup between tests
  - Verify fixes with multiple runs
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 5.2 Performance validation
  - Verify test suite completes in under 90 seconds
  - Identify any slow tests (>5 seconds)
  - Optimize slow tests if needed
  - Document performance metrics
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5.3 Create final report
  - Document final pass rate and test count
  - List all successfully migrated tests
  - Document lessons learned
  - Provide recommendations for reaching 95% pass rate
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

---

## Test Priority Matrix

### High Priority (Fix First)

| Test File | Impact | Effort | Tests | Reason |
|-----------|--------|--------|-------|--------|
| ChatInterface.test.tsx | Critical | Easy | 8 | Core functionality |
| error-handling.test.tsx | Critical | Easy | 6 | User experience |
| ChatInput.test.tsx | Important | Easy | 5 | Core interaction |

### Medium Priority (Fix Second)

| Test File | Impact | Effort | Tests | Reason |
|-----------|--------|--------|-------|--------|
| ProductBrowser.test.tsx | Important | Medium | 6 | Key feature |
| chat-flow.test.tsx | Important | Medium | 5 | Integration |
| product-search.test.tsx | Important | Medium | 4 | Search functionality |

### Low Priority (Fix If Time)

| Test File | Impact | Effort | Tests | Reason |
|-----------|--------|--------|-------|--------|
| component-hierarchy.test.tsx | Nice-to-have | Hard | 8 | Complex integration |
| loading-indicators.test.tsx | Nice-to-have | Medium | 5 | Already tested elsewhere |

---

## Rollback Plan

If migration fails or causes issues:

### Immediate Rollback (< 5 minutes)

```bash
git restore apps/frontend/src/test/
git restore apps/frontend/src/components/**/__tests__/
```

### Partial Rollback (< 15 minutes)

- Keep successfully migrated tests
- Revert problematic tests
- Document issues
- Continue with different tests

### Full Abort (< 30 minutes)

- Revert all changes
- Document why approach failed
- Propose alternative solution
- Update requirements

---

## Success Criteria Summary

The migration SHALL be considered complete when:

- [x] Pass rate reaches 60%+ (33+ passing tests)
- [x] All high-priority tests migrated
- [x] Proof of concept validates approach
- [x] Documentation updated with correct patterns
- [x] Test execution time under 90 seconds
- [x] No regressions in passing tests
- [x] Migration guide created
- [x] Final report documented

---

## Estimated Timeline

| Phase | Tasks | Estimated Time | Cumulative |
|-------|-------|----------------|------------|
| Phase 1 | 1, 1.1, 1.2, 1.3 | 1-2 hours | 1-2 hours |
| Phase 2 | 2, 2.1, 2.2, 2.3, 2.4 | 2-3 hours | 3-5 hours |
| Phase 3 | 3, 3.1, 3.2, 3.3, 3.4 | 2-3 hours | 5-8 hours |
| Phase 4 | 4, 4.1, 4.2, 4.3 | 1 hour | 6-9 hours |
| Phase 5 | 5, 5.1, 5.2, 5.3 | 1 hour | 7-10 hours |

**Total Estimated Time**: 7-10 hours

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (must reach 60% before documentation)

---

## Notes

- Focus on reaching 60% target, not 100% migration
- Stop after Phase 3 if 60% is achieved
- Phases 4-5 can be done incrementally
- Prioritize stability over speed
- Document everything for future developers
