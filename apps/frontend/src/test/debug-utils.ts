/**
 * Test Debugging Utilities
 *
 * Provides comprehensive debugging utilities for test failures including
 * component state logging, mock call history inspection, and async operation timing.
 *
 * Requirements: 5.6
 */

import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { prettyDOM } from '@testing-library/react';

// ============================================================================
// Debug Configuration
// ============================================================================

export interface DebugConfig {
  // Logging configuration
  enableComponentStateLogging: boolean;
  enableMockInspection: boolean;
  enableTimingDebug: boolean;
  enableDOMInspection: boolean;
  enablePerformanceTracking: boolean;

  // Output configuration
  maxLogEntries: number;
  maxDOMDepth: number;
  maxCallHistoryEntries: number;

  // Formatting configuration
  enableColorOutput: boolean;
  enableTimestamps: boolean;
  enableStackTraces: boolean;

  // Performance thresholds
  slowOperationThreshold: number;
  verySlowOperationThreshold: number;
}

export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enableComponentStateLogging: process.env.NODE_ENV !== 'test',
  enableMockInspection: process.env.NODE_ENV !== 'test',
  enableTimingDebug: process.env.NODE_ENV !== 'test',
  enableDOMInspection: process.env.NODE_ENV !== 'test',
  enablePerformanceTracking: process.env.NODE_ENV !== 'test',

  maxLogEntries: 100,
  maxDOMDepth: 5,
  maxCallHistoryEntries: 50,

  enableColorOutput: true,
  enableTimestamps: true,
  enableStackTraces: false,

  slowOperationThreshold: 1000,
  verySlowOperationThreshold: 3000,
};

// ============================================================================
// Debug Data Types
// ============================================================================

export interface ComponentStateSnapshot {
  timestamp: number;
  testName: string;
  context: string;
  componentName?: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  hooks?: Record<string, any>;
  domSnapshot?: string;
  memoryUsage?: number;
}

export interface MockCallInfo {
  functionName: string;
  args: any[];
  returnValue?: any;
  error?: Error;
  timestamp: number;
  duration?: number;
  callIndex: number;
}

export interface TimingInfo {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  totalOperations: number;
  averageDuration: number;
  slowOperations: TimingInfo[];
  failedOperations: TimingInfo[];
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
}

// ============================================================================
// Component State Logger
// ============================================================================

export class ComponentStateLogger {
  private config: DebugConfig;
  private stateHistory: ComponentStateSnapshot[] = [];
  private currentTestName: string = '';

  constructor(config: DebugConfig = DEFAULT_DEBUG_CONFIG) {
    this.config = config;
  }

  /**
   * Set current test name for context
   */
  setTestName(testName: string): void {
    this.currentTestName = testName;
  }

  /**
   * Log component state at a specific point
   */
  logComponentState(
    context: string,
    options: {
      componentName?: string;
      props?: Record<string, any>;
      state?: Record<string, any>;
      hooks?: Record<string, any>;
      domElement?: HTMLElement;
      additionalData?: Record<string, any>;
    } = {}
  ): void {
    if (!this.config.enableComponentStateLogging) {
      return;
    }

    const snapshot: ComponentStateSnapshot = {
      timestamp: Date.now(),
      testName: this.currentTestName,
      context,
      componentName: options.componentName,
      props: this.sanitizeData(options.props),
      state: this.sanitizeData(options.state),
      hooks: this.sanitizeData(options.hooks),
      domSnapshot: options.domElement
        ? this.createDOMSnapshot(options.domElement)
        : undefined,
      memoryUsage: this.getMemoryUsage(),
    };

    this.stateHistory.push(snapshot);

    // Limit history size
    if (this.stateHistory.length > this.config.maxLogEntries) {
      this.stateHistory = this.stateHistory.slice(-this.config.maxLogEntries);
    }

    this.outputStateLog(snapshot, options.additionalData);
  }

  /**
   * Get component state history
   */
  getStateHistory(testName?: string): ComponentStateSnapshot[] {
    if (testName) {
      return this.stateHistory.filter(
        (snapshot) => snapshot.testName === testName
      );
    }
    return [...this.stateHistory];
  }

  /**
   * Get latest state snapshot
   */
  getLatestState(): ComponentStateSnapshot | null {
    return this.stateHistory[this.stateHistory.length - 1] || null;
  }

  /**
   * Clear state history
   */
  clearHistory(): void {
    this.stateHistory = [];
  }

  /**
   * Create formatted state report
   */
  createStateReport(testName?: string): string {
    const history = this.getStateHistory(testName);

    if (history.length === 0) {
      return 'No component state history available';
    }

    const report = [
      '='.repeat(60),
      `COMPONENT STATE REPORT${testName ? ` - ${testName}` : ''}`,
      '='.repeat(60),
      '',
    ];

    history.forEach((snapshot, index) => {
      report.push(
        `${index + 1}. ${snapshot.context} (${new Date(snapshot.timestamp).toISOString()})`
      );

      if (snapshot.componentName) {
        report.push(`   Component: ${snapshot.componentName}`);
      }

      if (snapshot.props && Object.keys(snapshot.props).length > 0) {
        report.push(`   Props: ${JSON.stringify(snapshot.props, null, 2)}`);
      }

      if (snapshot.state && Object.keys(snapshot.state).length > 0) {
        report.push(`   State: ${JSON.stringify(snapshot.state, null, 2)}`);
      }

      if (snapshot.hooks && Object.keys(snapshot.hooks).length > 0) {
        report.push(`   Hooks: ${JSON.stringify(snapshot.hooks, null, 2)}`);
      }

      if (snapshot.memoryUsage) {
        report.push(`   Memory: ${snapshot.memoryUsage}MB`);
      }

      report.push('');
    });

    return report.join('\n');
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    try {
      // Remove circular references and functions
      return JSON.parse(
        JSON.stringify(data, (key, value) => {
          if (typeof value === 'function') {
            return '[Function]';
          }
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack,
            };
          }
          return value;
        })
      );
    } catch (error) {
      return '[Unserializable Data]';
    }
  }

  private createDOMSnapshot(element: HTMLElement): string {
    if (!this.config.enableDOMInspection) {
      return '';
    }

    try {
      return prettyDOM(element, this.config.maxDOMDepth * 1000);
    } catch (error) {
      return `[DOM Snapshot Error: ${error}]`;
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }

  private outputStateLog(
    snapshot: ComponentStateSnapshot,
    additionalData?: Record<string, any>
  ): void {
    const timestamp = this.config.enableTimestamps
      ? `[${new Date(snapshot.timestamp).toISOString()}] `
      : '';

    const prefix = `${timestamp}[STATE] [${snapshot.testName}]`;

    console.debug(`${prefix} ${snapshot.context}`);

    if (snapshot.componentName) {
      console.debug(`${prefix}   Component: ${snapshot.componentName}`);
    }

    if (additionalData) {
      console.debug(`${prefix}   Additional:`, additionalData);
    }
  }
}

// ============================================================================
// Mock Call Inspector
// ============================================================================

export class MockCallInspector {
  private config: DebugConfig;
  private callHistory: Map<string, MockCallInfo[]> = new Map();
  private mockRegistry: Map<string, MockedFunction<any>> = new Map();

  constructor(config: DebugConfig = DEFAULT_DEBUG_CONFIG) {
    this.config = config;
  }

  /**
   * Register a mock function for tracking
   */
  registerMock(name: string, mockFn: MockedFunction<any>): void {
    if (!this.config.enableMockInspection) {
      return;
    }

    this.mockRegistry.set(name, mockFn);
    this.callHistory.set(name, []);

    // Wrap the mock to track calls
    const originalImplementation = mockFn.getMockImplementation();

    mockFn.mockImplementation((...args: any[]) => {
      const callInfo: MockCallInfo = {
        functionName: name,
        args: this.sanitizeArgs(args),
        timestamp: Date.now(),
        callIndex: this.getCallCount(name),
      };

      const startTime = Date.now();

      try {
        const result = originalImplementation
          ? originalImplementation(...args)
          : undefined;

        if (result instanceof Promise) {
          return result
            .then((value) => {
              callInfo.duration = Date.now() - startTime;
              callInfo.returnValue = this.sanitizeArgs([value])[0];
              this.recordCall(name, callInfo);
              return value;
            })
            .catch((error) => {
              callInfo.duration = Date.now() - startTime;
              callInfo.error = error;
              this.recordCall(name, callInfo);
              throw error;
            });
        } else {
          callInfo.duration = Date.now() - startTime;
          callInfo.returnValue = this.sanitizeArgs([result])[0];
          this.recordCall(name, callInfo);
          return result;
        }
      } catch (error) {
        callInfo.duration = Date.now() - startTime;
        callInfo.error = error as Error;
        this.recordCall(name, callInfo);
        throw error;
      }
    });
  }

  /**
   * Get call history for a specific mock
   */
  getCallHistory(mockName: string): MockCallInfo[] {
    return [...(this.callHistory.get(mockName) || [])];
  }

  /**
   * Get call history for all mocks
   */
  getAllCallHistory(): Record<string, MockCallInfo[]> {
    const history: Record<string, MockCallInfo[]> = {};
    this.callHistory.forEach((calls, name) => {
      history[name] = [...calls];
    });
    return history;
  }

  /**
   * Get call count for a specific mock
   */
  getCallCount(mockName: string): number {
    return this.callHistory.get(mockName)?.length || 0;
  }

  /**
   * Get last call for a specific mock
   */
  getLastCall(mockName: string): MockCallInfo | null {
    const calls = this.callHistory.get(mockName);
    return calls && calls.length > 0 ? calls[calls.length - 1] : null;
  }

  /**
   * Check if mock was called with specific arguments
   */
  wasCalledWith(mockName: string, expectedArgs: any[]): boolean {
    const calls = this.callHistory.get(mockName) || [];
    return calls.some((call) => this.deepEqual(call.args, expectedArgs));
  }

  /**
   * Get calls that match specific criteria
   */
  getCallsMatching(
    mockName: string,
    predicate: (call: MockCallInfo) => boolean
  ): MockCallInfo[] {
    const calls = this.callHistory.get(mockName) || [];
    return calls.filter(predicate);
  }

  /**
   * Clear call history
   */
  clearHistory(mockName?: string): void {
    if (mockName) {
      this.callHistory.set(mockName, []);
    } else {
      this.callHistory.clear();
    }
  }

  /**
   * Create formatted call report
   */
  createCallReport(mockName?: string): string {
    const report = [
      '='.repeat(60),
      `MOCK CALL REPORT${mockName ? ` - ${mockName}` : ''}`,
      '='.repeat(60),
      '',
    ];

    const mocksToReport = mockName
      ? [mockName]
      : Array.from(this.callHistory.keys());

    mocksToReport.forEach((name) => {
      const calls = this.callHistory.get(name) || [];

      report.push(`${name} (${calls.length} calls):`);

      if (calls.length === 0) {
        report.push('  No calls recorded');
      } else {
        calls.slice(-10).forEach((call, index) => {
          // Show last 10 calls
          const timestamp = new Date(call.timestamp).toISOString();
          const duration = call.duration ? ` (${call.duration}ms)` : '';
          const status = call.error ? ' [ERROR]' : ' [SUCCESS]';

          report.push(
            `  ${call.callIndex + 1}. ${timestamp}${duration}${status}`
          );
          report.push(`     Args: ${JSON.stringify(call.args)}`);

          if (call.returnValue !== undefined) {
            report.push(`     Return: ${JSON.stringify(call.returnValue)}`);
          }

          if (call.error) {
            report.push(`     Error: ${call.error.message}`);
          }
        });

        if (calls.length > 10) {
          report.push(`  ... and ${calls.length - 10} more calls`);
        }
      }

      report.push('');
    });

    return report.join('\n');
  }

  private recordCall(mockName: string, callInfo: MockCallInfo): void {
    const calls = this.callHistory.get(mockName) || [];
    calls.push(callInfo);

    // Limit history size
    if (calls.length > this.config.maxCallHistoryEntries) {
      calls.splice(0, calls.length - this.config.maxCallHistoryEntries);
    }

    this.callHistory.set(mockName, calls);
  }

  private sanitizeArgs(args: any[]): any[] {
    return args.map((arg) => {
      if (typeof arg === 'function') {
        return '[Function]';
      }
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
        };
      }
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return '[Unserializable]';
      }
    });
  }

  private deepEqual(a: any, b: any): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Async Operation Timer
// ============================================================================

export class AsyncOperationTimer {
  private config: DebugConfig;
  private activeOperations: Map<string, TimingInfo> = new Map();
  private completedOperations: TimingInfo[] = [];

  constructor(config: DebugConfig = DEFAULT_DEBUG_CONFIG) {
    this.config = config;
  }

  /**
   * Start timing an async operation
   */
  startOperation(
    operationName: string,
    metadata?: Record<string, any>
  ): string {
    if (!this.config.enableTimingDebug) {
      return operationName;
    }

    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const timingInfo: TimingInfo = {
      operationName,
      startTime: Date.now(),
      metadata,
    };

    this.activeOperations.set(operationId, timingInfo);

    console.debug(`[TIMING] Started: ${operationName} (${operationId})`);

    return operationId;
  }

  /**
   * End timing an async operation
   */
  endOperation(
    operationId: string,
    success: boolean = true,
    error?: Error
  ): number {
    if (!this.config.enableTimingDebug) {
      return 0;
    }

    const timingInfo = this.activeOperations.get(operationId);
    if (!timingInfo) {
      console.warn(`[TIMING] Unknown operation ID: ${operationId}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - timingInfo.startTime;

    timingInfo.endTime = endTime;
    timingInfo.duration = duration;
    timingInfo.success = success;
    timingInfo.error = error;

    this.activeOperations.delete(operationId);
    this.completedOperations.push(timingInfo);

    // Limit completed operations history
    if (this.completedOperations.length > this.config.maxLogEntries) {
      this.completedOperations = this.completedOperations.slice(
        -this.config.maxLogEntries
      );
    }

    this.logOperationCompletion(timingInfo);

    return duration;
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    operationName: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    const operationId = this.startOperation(operationName, metadata);

    try {
      const result = await Promise.resolve(fn());
      const duration = this.endOperation(operationId, true);
      return { result, duration };
    } catch (error) {
      const duration = this.endOperation(operationId, false, error as Error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const operations = this.completedOperations.filter(
      (op) => op.duration !== undefined
    );

    const totalOperations = operations.length;
    const averageDuration =
      totalOperations > 0
        ? operations.reduce((sum, op) => sum + (op.duration || 0), 0) /
          totalOperations
        : 0;

    const slowOperations = operations.filter(
      (op) => (op.duration || 0) > this.config.slowOperationThreshold
    );

    const failedOperations = operations.filter((op) => !op.success);

    return {
      totalOperations,
      averageDuration,
      slowOperations,
      failedOperations,
      memoryUsage: {
        initial: 0, // Would need to track this separately
        peak: 0, // Would need to track this separately
        final: this.getMemoryUsage(),
      },
    };
  }

  /**
   * Get active operations
   */
  getActiveOperations(): TimingInfo[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get completed operations
   */
  getCompletedOperations(operationName?: string): TimingInfo[] {
    if (operationName) {
      return this.completedOperations.filter(
        (op) => op.operationName === operationName
      );
    }
    return [...this.completedOperations];
  }

  /**
   * Clear timing history
   */
  clearHistory(): void {
    this.completedOperations = [];
    this.activeOperations.clear();
  }

  /**
   * Create timing report
   */
  createTimingReport(): string {
    const metrics = this.getPerformanceMetrics();

    const report = [
      '='.repeat(60),
      'ASYNC OPERATION TIMING REPORT',
      '='.repeat(60),
      '',
      `Total Operations: ${metrics.totalOperations}`,
      `Average Duration: ${metrics.averageDuration.toFixed(2)}ms`,
      `Slow Operations: ${metrics.slowOperations.length}`,
      `Failed Operations: ${metrics.failedOperations.length}`,
      '',
    ];

    if (metrics.slowOperations.length > 0) {
      report.push('Slow Operations:');
      metrics.slowOperations.forEach((op) => {
        report.push(`  ${op.operationName}: ${op.duration}ms`);
      });
      report.push('');
    }

    if (metrics.failedOperations.length > 0) {
      report.push('Failed Operations:');
      metrics.failedOperations.forEach((op) => {
        report.push(
          `  ${op.operationName}: ${op.error?.message || 'Unknown error'}`
        );
      });
      report.push('');
    }

    const activeOps = this.getActiveOperations();
    if (activeOps.length > 0) {
      report.push('Active Operations:');
      activeOps.forEach((op) => {
        const elapsed = Date.now() - op.startTime;
        report.push(`  ${op.operationName}: ${elapsed}ms elapsed`);
      });
    }

    return report.join('\n');
  }

  private logOperationCompletion(timingInfo: TimingInfo): void {
    const { operationName, duration, success, error } = timingInfo;
    const status = success ? 'SUCCESS' : 'FAILED';

    let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';

    if (!success) {
      logLevel = 'error';
    } else if ((duration || 0) > this.config.verySlowOperationThreshold) {
      logLevel = 'error';
    } else if ((duration || 0) > this.config.slowOperationThreshold) {
      logLevel = 'warn';
    }

    const message = `[TIMING] ${status}: ${operationName} (${duration}ms)`;

    console[logLevel](message);

    if (error) {
      console.error(`[TIMING] Error details:`, error);
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }
}

// ============================================================================
// Integrated Debug Manager
// ============================================================================

export class TestDebugManager {
  private config: DebugConfig;
  private stateLogger: ComponentStateLogger;
  private mockInspector: MockCallInspector;
  private operationTimer: AsyncOperationTimer;

  constructor(config: DebugConfig = DEFAULT_DEBUG_CONFIG) {
    this.config = config;
    this.stateLogger = new ComponentStateLogger(config);
    this.mockInspector = new MockCallInspector(config);
    this.operationTimer = new AsyncOperationTimer(config);
  }

  /**
   * Set current test name for all debug components
   */
  setTestName(testName: string): void {
    this.stateLogger.setTestName(testName);
  }

  /**
   * Get component state logger
   */
  get componentState(): ComponentStateLogger {
    return this.stateLogger;
  }

  /**
   * Get mock call inspector
   */
  get mockCalls(): MockCallInspector {
    return this.mockInspector;
  }

  /**
   * Get async operation timer
   */
  get timing(): AsyncOperationTimer {
    return this.operationTimer;
  }

  /**
   * Create comprehensive debug report
   */
  createDebugReport(testName?: string): string {
    const report = [
      '='.repeat(80),
      `COMPREHENSIVE DEBUG REPORT${testName ? ` - ${testName}` : ''}`,
      '='.repeat(80),
      '',
      this.stateLogger.createStateReport(testName),
      '',
      this.mockInspector.createCallReport(),
      '',
      this.operationTimer.createTimingReport(),
      '',
      '='.repeat(80),
    ];

    return report.join('\n');
  }

  /**
   * Clear all debug history
   */
  clearAll(): void {
    this.stateLogger.clearHistory();
    this.mockInspector.clearHistory();
    this.operationTimer.clearHistory();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// Global Debug Instance
// ============================================================================

export const testDebugger = new TestDebugManager();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Log component state (convenience function)
 */
export function logComponentState(
  context: string,
  options?: Parameters<ComponentStateLogger['logComponentState']>[1]
): void {
  testDebugger.componentState.logComponentState(context, options);
}

/**
 * Register mock for inspection (convenience function)
 */
export function registerMock(name: string, mockFn: MockedFunction<any>): void {
  testDebugger.mockCalls.registerMock(name, mockFn);
}

/**
 * Time async operation (convenience function)
 */
export async function timeAsyncOperation<T>(
  operationName: string,
  fn: () => Promise<T> | T,
  metadata?: Record<string, any>
): Promise<{ result: T; duration: number }> {
  return testDebugger.timing.timeFunction(operationName, fn, metadata);
}

/**
 * Create debug snapshot for test failure
 */
export function createFailureSnapshot(
  testName: string,
  error: Error,
  additionalContext?: Record<string, any>
): string {
  const report = [
    '='.repeat(80),
    `TEST FAILURE DEBUG SNAPSHOT - ${testName}`,
    '='.repeat(80),
    '',
    `Error: ${error.name}`,
    `Message: ${error.message}`,
    '',
    'Stack Trace:',
    error.stack || 'No stack trace available',
    '',
  ];

  if (additionalContext) {
    report.push('Additional Context:');
    report.push(JSON.stringify(additionalContext, null, 2));
    report.push('');
  }

  report.push(testDebugger.createDebugReport(testName));

  return report.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

// Classes and interfaces are already exported above
