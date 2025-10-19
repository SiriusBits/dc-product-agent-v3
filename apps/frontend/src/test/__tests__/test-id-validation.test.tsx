/**
 * Test ID Uniqueness Validation Tests
 *
 * Tests to verify that no duplicate test IDs exist in component trees
 * and that LoadingSpinner/LoadingState components support custom test IDs.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  LoadingSpinner,
  LoadingState,
  LoadingOverlay,
  ProgressiveLoading,
} from '../../components/ui/loading';
import {
  detectDuplicateTestIds,
  assertNoTestIdConflicts,
  getAllTestIds,
  validateTestIdPresence,
} from '../test-id-validation';

describe('Test ID Uniqueness Validation', () => {
  describe('detectDuplicateTestIds utility', () => {
    it('detects no duplicates when all test IDs are unique', () => {
      const { container } = render(
        <div>
          <div data-testid="unique-1">First</div>
          <div data-testid="unique-2">Second</div>
          <div data-testid="unique-3">Third</div>
        </div>
      );

      const duplicates = detectDuplicateTestIds(container);
      expect(duplicates).toEqual([]);
    });

    it('detects duplicate test IDs correctly', () => {
      const { container } = render(
        <div>
          <div data-testid="duplicate">First</div>
          <div data-testid="unique">Unique</div>
          <div data-testid="duplicate">Second</div>
          <div data-testid="another-duplicate">Third</div>
          <div data-testid="another-duplicate">Fourth</div>
        </div>
      );

      const duplicates = detectDuplicateTestIds(container);
      expect(duplicates).toContain('duplicate');
      expect(duplicates).toContain('another-duplicate');
      expect(duplicates).not.toContain('unique');
    });

    it('handles empty containers', () => {
      const { container } = render(<div></div>);

      const duplicates = detectDuplicateTestIds(container);
      expect(duplicates).toEqual([]);
    });
  });

  describe('assertNoTestIdConflicts utility', () => {
    it('passes when no conflicts exist', () => {
      const renderResult = render(
        <div>
          <div data-testid="test-1">First</div>
          <div data-testid="test-2">Second</div>
        </div>
      );

      expect(() => {
        assertNoTestIdConflicts(renderResult, 'test context');
      }).not.toThrow();
    });

    it('throws when conflicts exist', () => {
      const renderResult = render(
        <div>
          <div data-testid="conflict">First</div>
          <div data-testid="conflict">Second</div>
        </div>
      );

      expect(() => {
        assertNoTestIdConflicts(renderResult, 'test context');
      }).toThrow('Duplicate test IDs found in test context: conflict');
    });
  });

  describe('LoadingSpinner test ID uniqueness', () => {
    it('prevents conflicts when multiple LoadingSpinners use custom test IDs', () => {
      const renderResult = render(
        <div>
          <LoadingSpinner testId="spinner-1" />
          <LoadingSpinner testId="spinner-2" />
          <LoadingSpinner testId="spinner-3" />
        </div>
      );

      assertNoTestIdConflicts(renderResult, 'multiple LoadingSpinners');

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('spinner-1');
      expect(testIds).toContain('spinner-2');
      expect(testIds).toContain('spinner-3');
      expect(testIds).not.toContain('loading-spinner'); // No default IDs
    });

    it('detects conflicts when multiple LoadingSpinners use default test ID', () => {
      const renderResult = render(
        <div>
          <LoadingSpinner />
          <LoadingSpinner />
        </div>
      );

      const duplicates = detectDuplicateTestIds(renderResult.container);
      expect(duplicates).toContain('loading-spinner');
    });

    it('supports context-specific test IDs for different use cases', () => {
      const renderResult = render(
        <div>
          <LoadingSpinner testId="chat-loading-spinner" />
          <LoadingSpinner testId="product-loading-spinner" />
          <LoadingSpinner testId="search-loading-spinner" />
        </div>
      );

      const validation = validateTestIdPresence(renderResult.container, [
        'chat-loading-spinner',
        'product-loading-spinner',
        'search-loading-spinner',
      ]);

      expect(validation.missing).toEqual([]);
      expect(validation.duplicates).toEqual([]);
      expect(validation.present).toHaveLength(3);
    });
  });

  describe('LoadingState test ID uniqueness', () => {
    it('prevents conflicts when multiple LoadingStates use custom test IDs', () => {
      const renderResult = render(
        <div>
          <LoadingState testId="state-1" message="Loading state 1" />
          <LoadingState testId="state-2" message="Loading state 2" />
        </div>
      );

      assertNoTestIdConflicts(renderResult, 'multiple LoadingStates');

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('state-1');
      expect(testIds).toContain('state-2');
    });

    it('detects conflicts when multiple LoadingStates use default test ID', () => {
      const renderResult = render(
        <div>
          <LoadingState message="First" />
          <LoadingState message="Second" />
        </div>
      );

      const duplicates = detectDuplicateTestIds(renderResult.container);
      expect(duplicates).toContain('loading-spinner');
    });
  });

  describe('LoadingOverlay test ID uniqueness', () => {
    it('uses default context-specific test ID', () => {
      const renderResult = render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      );

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('loading-overlay-spinner');
      expect(testIds).not.toContain('loading-spinner'); // No generic default
    });

    it('supports custom test IDs', () => {
      const renderResult = render(
        <LoadingOverlay isLoading={true} testId="custom-overlay-spinner">
          <div>Content</div>
        </LoadingOverlay>
      );

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('custom-overlay-spinner');
      expect(testIds).not.toContain('loading-overlay-spinner');
    });

    it('prevents conflicts when multiple LoadingOverlays are used', () => {
      const renderResult = render(
        <div>
          <LoadingOverlay isLoading={true} testId="overlay-1">
            <div>Content 1</div>
          </LoadingOverlay>
          <LoadingOverlay isLoading={true} testId="overlay-2">
            <div>Content 2</div>
          </LoadingOverlay>
        </div>
      );

      assertNoTestIdConflicts(renderResult, 'multiple LoadingOverlays');
    });
  });

  describe('ProgressiveLoading test ID uniqueness', () => {
    const mockStages = [
      { message: 'Stage 1', completed: true },
      { message: 'Stage 2', completed: false },
      { message: 'Stage 3', completed: false },
    ];

    it('uses default context-specific test ID', () => {
      const renderResult = render(<ProgressiveLoading stages={mockStages} />);

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('progressive-loading-spinner-stage-1');
      expect(testIds).not.toContain('loading-spinner'); // No generic default
    });

    it('supports custom test IDs', () => {
      const renderResult = render(
        <ProgressiveLoading stages={mockStages} testId="custom-progress" />
      );

      const testIds = getAllTestIds(renderResult.container);
      expect(testIds).toContain('custom-progress-stage-1');
      expect(testIds).not.toContain('progressive-loading-spinner-stage-1');
    });

    it('prevents conflicts when multiple ProgressiveLoading components are used', () => {
      const renderResult = render(
        <div>
          <ProgressiveLoading stages={mockStages} testId="progress-1" />
          <ProgressiveLoading stages={mockStages} testId="progress-2" />
        </div>
      );

      assertNoTestIdConflicts(
        renderResult,
        'multiple ProgressiveLoading components'
      );
    });
  });

  describe('Complex component tree validation', () => {
    it('validates no conflicts in complex loading component combinations', () => {
      const stages = [
        { message: 'Loading...', completed: false },
        { message: 'Processing...', completed: false },
      ];

      const renderResult = render(
        <div>
          <LoadingSpinner testId="header-spinner" />
          <LoadingState testId="main-loading" message="Loading main content" />
          <LoadingOverlay isLoading={true} testId="overlay-spinner">
            <div>
              <LoadingSpinner testId="nested-spinner" size="sm" />
              <ProgressiveLoading stages={stages} testId="progress-loader" />
            </div>
          </LoadingOverlay>
        </div>
      );

      assertNoTestIdConflicts(renderResult, 'complex loading component tree');

      const expectedTestIds = [
        'header-spinner',
        'main-loading',
        'overlay-spinner',
        'nested-spinner',
        'progress-loader-stage-0',
      ];

      const validation = validateTestIdPresence(
        renderResult.container,
        expectedTestIds
      );
      expect(validation.missing).toEqual([]);
      expect(validation.duplicates).toEqual([]);
    });
  });
});
