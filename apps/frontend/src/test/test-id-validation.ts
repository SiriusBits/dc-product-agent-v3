/**
 * Test ID Validation Utilities
 *
 * Utilities to detect duplicate test IDs in rendered components
 * and ensure test ID uniqueness across component trees.
 */

import { RenderResult } from '@testing-library/react';

/**
 * Detects duplicate test IDs in a rendered component tree
 * @param container - The rendered component container
 * @returns Array of duplicate test IDs found
 */
export function detectDuplicateTestIds(container: HTMLElement): string[] {
  const testIdElements = container.querySelectorAll('[data-testid]');
  const testIdCounts = new Map<string, number>();
  const duplicates: string[] = [];

  // Count occurrences of each test ID
  testIdElements.forEach((element) => {
    const testId = element.getAttribute('data-testid');
    if (testId) {
      const count = testIdCounts.get(testId) || 0;
      testIdCounts.set(testId, count + 1);
    }
  });

  // Find duplicates
  testIdCounts.forEach((count, testId) => {
    if (count > 1) {
      duplicates.push(testId);
    }
  });

  return duplicates;
}

/**
 * Asserts that no duplicate test IDs exist in the rendered component
 * @param renderResult - The result from render()
 * @param context - Optional context for better error messages
 */
export function assertNoTestIdConflicts(
  renderResult: RenderResult,
  context?: string
): void {
  const duplicates = detectDuplicateTestIds(renderResult.container);

  if (duplicates.length > 0) {
    const contextMsg = context ? ` in ${context}` : '';
    const duplicateList = duplicates.join(', ');
    throw new Error(
      `Duplicate test IDs found${contextMsg}: ${duplicateList}. ` +
        'Each test ID should be unique within the component tree.'
    );
  }
}

/**
 * Gets all test IDs present in the rendered component
 * @param container - The rendered component container
 * @returns Array of all test IDs found
 */
export function getAllTestIds(container: HTMLElement): string[] {
  const testIdElements = container.querySelectorAll('[data-testid]');
  const testIds: string[] = [];

  testIdElements.forEach((element) => {
    const testId = element.getAttribute('data-testid');
    if (testId) {
      testIds.push(testId);
    }
  });

  return testIds;
}

/**
 * Validates that specific test IDs are present and unique
 * @param container - The rendered component container
 * @param expectedTestIds - Array of test IDs that should be present
 * @returns Object with validation results
 */
export function validateTestIdPresence(
  container: HTMLElement,
  expectedTestIds: string[]
): {
  present: string[];
  missing: string[];
  duplicates: string[];
} {
  const allTestIds = getAllTestIds(container);
  const duplicates = detectDuplicateTestIds(container);

  const present = expectedTestIds.filter((id) => allTestIds.includes(id));
  const missing = expectedTestIds.filter((id) => !allTestIds.includes(id));

  return {
    present,
    missing,
    duplicates,
  };
}
