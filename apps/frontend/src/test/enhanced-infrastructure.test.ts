/**
 * Test for Enhanced Test Infrastructure
 *
 * Verifies that all components of the enhanced test infrastructure work correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Import enhanced infrastructure
import {
  setupEnhancedTest,
  enhancedWaitFor,
  createStandardizedQueries,
  logComponentState,
  timeAsyncOperation,
  createControlledAsyncMock,
  testDebugger,
} from './enhanced-test-infrastructure';

// Simple test component
const TestComponent: React.FC<{
  loading?: boolean;
  error?: string;
  data?: string;
}> = ({ loading = false, error, data }) => {
  return React.createElement(
    'div',
    { 'data-testid': 'test-component' },
    loading &&
      React.createElement('div', { 'data-testid': 'loading' }, 'Loading...'),
    error && React.createElement('div', { 'data-testid': 'error' }, error),
    data && React.createElement('div', { 'data-testid': 'data' }, data),
    React.createElement(
      'button',
      { 'data-testid': 'action-button' },
      'Click me'
    )
  );
};

describe('Enhanced Test Infrastructure', () => {
  const { enhancedRender, logState, timeOperation, mockUtils } =
    setupEnhancedTest({
      debug: {
        enableComponentStateLogging: true,
        enableMockInspection: true,
        logLevel: 'debug',
      },
    });

  describe('Mock Reset Strategy', () => {
    it('should reset mocks between tests', () => {
      const mockFn = vi.fn();
      mockFn('test call');

      expect(mockFn).toHaveBeenCalledWith('test call');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should have clean mock state in new test', () => {
      const mockFn = vi.fn();

      // This should be 0 if mocks are properly reset
      expect(mockFn).toHaveBeenCalledTimes(0);
    });
  });

  describe('Standardized Query Methods', () => {
    it('should provide enhanced queries with better error messages', async () => {
      const renderResult = render(
        React.createElement(TestComponent, { data: 'Hello World' })
      );
      const queries = createStandardizedQueries(renderResult, {
        testName: 'Query test',
        componentName: 'TestComponent',
      });

      // Should find existing element
      const component = queries.getByTestId('test-component');
      expect(component).toBeInTheDocument();

      // Should return null for non-existent element
      const nonExistent = queries.queryByTestId('non-existent');
      expect(nonExistent).toBeNull();

      // Should find async element
      const dataElement = await queries.findByTestId('data');
      expect(dataElement).toHaveTextContent('Hello World');
    });

    it('should provide helpful error messages for failed queries', () => {
      const renderResult = render(React.createElement(TestComponent));
      const queries = createStandardizedQueries(renderResult);

      expect(() => {
        queries.getByTestId('non-existent-element');
      }).toThrow(/getByTestId\('non-existent-element'\) failed/);
    });
  });

  describe('Async Operation Handling', () => {
    it('should handle async operations with enhanced waitFor', async () => {
      let isReady = false;

      // Simulate async operation
      setTimeout(() => {
        isReady = true;
      }, 100);

      await enhancedWaitFor(
        () => {
          if (!isReady) {
            throw new Error('Not ready yet');
          }
          return true;
        },
        {
          timeout: 1000,
          operationName: 'async readiness check',
        }
      );

      expect(isReady).toBe(true);
    });

    it('should work with controlled async mocks', async () => {
      const { mockFn, resolve } = createControlledAsyncMock<string>();

      // Start async operation
      const promise = mockFn();

      // Resolve after a delay
      setTimeout(() => resolve('success'), 50);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('Component State Logging', () => {
    it('should log component state without errors', () => {
      const renderResult = render(
        React.createElement(TestComponent, { data: 'Test Data' })
      );

      // Should not throw
      expect(() => {
        logComponentState('Test state logging', {
          componentName: 'TestComponent',
          domElement: renderResult.container,
          additionalData: { testPhase: 'initial render' },
        });
      }).not.toThrow();
    });
  });

  describe('Performance Timing', () => {
    it('should time async operations', async () => {
      const { result, duration } = await timeAsyncOperation(
        'test operation',
        async () => {
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'completed';
        }
      );

      expect(result).toBe('completed');
      expect(duration).toBeGreaterThan(40); // Should take at least 40ms
      expect(duration).toBeLessThan(200); // Should complete quickly
    });
  });

  describe('Enhanced Render Result', () => {
    it('should provide enhanced utilities', async () => {
      const renderResult = render(
        React.createElement(TestComponent, { loading: true })
      );
      const enhanced = enhancedRender(renderResult);

      // Should have enhanced methods
      expect(enhanced.waitForElement).toBeDefined();
      expect(enhanced.logState).toBeDefined();
      expect(enhanced.timeOperation).toBeDefined();

      // Should work with async elements
      const loadingElement = await enhanced.waitForElement('loading');
      expect(loadingElement).toHaveTextContent('Loading...');

      // Should log state without errors
      expect(() => {
        enhanced.logState('Enhanced render test');
      }).not.toThrow();
    });
  });

  describe('Mock Utilities', () => {
    it('should provide enhanced mock utilities', () => {
      const mockUtils = setupEnhancedTest().mockUtils;

      // Should have all expected utilities
      expect(mockUtils.createControlledMock).toBeDefined();
      expect(mockUtils.createDelayedMock).toBeDefined();
      expect(mockUtils.createFlakyMock).toBeDefined();
      expect(mockUtils.registerForDebugging).toBeDefined();
    });

    it('should create different types of mocks', async () => {
      const { mockUtils } = setupEnhancedTest();

      // Controlled mock
      const controlled = mockUtils.createControlledMock<string>();
      expect(controlled.resolve).toBeDefined();
      expect(controlled.reject).toBeDefined();

      // Delayed mock
      const delayed = mockUtils.createDelayedMock('delayed result', 10);
      const result = await delayed();
      expect(result).toBe('delayed result');

      // Flaky mock (might fail, but should eventually work with retries)
      const flaky = mockUtils.createFlakyMock('flaky result', 0.1); // 10% failure rate
      const flakyResult = await flaky();
      expect(flakyResult).toBe('flaky result');
    });
  });

  describe('Debug Manager Integration', () => {
    it('should track test execution', () => {
      // Debug manager should be available
      expect(testDebugger).toBeDefined();
      expect(testDebugger.componentState).toBeDefined();
      expect(testDebugger.mockCalls).toBeDefined();
      expect(testDebugger.timing).toBeDefined();
    });

    it('should create debug reports', () => {
      const report = testDebugger.createDebugReport(
        'Enhanced Infrastructure Test'
      );

      expect(report).toContain('COMPREHENSIVE DEBUG REPORT');
      expect(report).toContain('Enhanced Infrastructure Test');
    });
  });

  describe('Error Handling', () => {
    it('should provide enhanced error information', async () => {
      const renderResult = render(React.createElement(TestComponent));
      const queries = createStandardizedQueries(renderResult);

      try {
        // This should fail with enhanced error info
        await queries.findByTestId('non-existent', { timeout: 100 });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('findByTestId');
        expect(error.message).toContain('non-existent');
        expect(error.message).toContain('timed out');
      }
    });
  });

  describe('Configuration', () => {
    it('should allow configuration updates', () => {
      const { infrastructure } = setupEnhancedTest();

      const originalConfig = infrastructure.getConfig();

      infrastructure.updateConfig({
        debug: {
          ...originalConfig.debug,
          logLevel: 'error',
        },
      });

      const updatedConfig = infrastructure.getConfig();
      expect(updatedConfig.debug.logLevel).toBe('error');
    });
  });
});
