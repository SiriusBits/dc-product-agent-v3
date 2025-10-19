/**
 * Test Performance Profiler
 * Advanced profiling and bottleneck identification for test performance optimization
 */

import { vi } from 'vitest';
import { performance } from 'perf_hooks';

export interface TestProfileData {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  operations: {
    domOperations: number;
    mockCalls: number;
    rerenders: number;
    asyncOperations: number;
    timerOperations: number;
  };
  bottlenecks: BottleneckInfo[];
  slowOperations: SlowOperationInfo[];
}

export interface BottleneckInfo {
  operation: string;
  duration: number;
  percentage: number;
  stackTrace?: string;
  suggestions: string[];
}

export interface SlowOperationInfo {
  operation: string;
  duration: number;
  threshold: number;
  impact: 'low' | 'medium' | 'high';
  optimization: string;
}

export interface ProfilerConfig {
  enableProfiling: boolean;
  trackMemory: boolean;
  trackOperations: boolean;
  slowOperationThreshold: number;
  bottleneckThreshold: number;
  maxProfileEntries: number;
  enableStackTraces: boolean;
}

const DEFAULT_PROFILER_CONFIG: ProfilerConfig = {
  enableProfiling: process.env.NODE_ENV !== 'production',
  trackMemory: true,
  trackOperations: true,
  slowOperationThreshold: 100, // 100ms
  bottleneckThreshold: 0.1, // 10% of total test time
  maxProfileEntries: 1000,
  enableStackTraces: false, // Expensive, only enable for debugging
};

export class TestPerformanceProfiler {
  private config: ProfilerConfig;
  private profiles: Map<string, TestProfileData> = new Map();
  private currentTest: string | null = null;
  private operationTimers: Map<string, number> = new Map();
  private operationCounts: Map<string, number> = new Map();

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
  }

  /**
   * Start profiling a test
   */
  startTest(testName: string): void {
    if (!this.config.enableProfiling) return;

    this.currentTest = testName;
    const startTime = performance.now();

    const profile: TestProfileData = {
      testName,
      startTime,
      endTime: 0,
      duration: 0,
      memoryUsage: this.getMemoryUsage(),
      operations: {
        domOperations: 0,
        mockCalls: 0,
        rerenders: 0,
        asyncOperations: 0,
        timerOperations: 0,
      },
      bottlenecks: [],
      slowOperations: [],
    };

    this.profiles.set(testName, profile);
    this.operationTimers.clear();
    this.operationCounts.clear();
  }

  /**
   * End profiling a test
   */
  endTest(testName: string): TestProfileData | null {
    if (!this.config.enableProfiling || !this.profiles.has(testName)) {
      return null;
    }

    const profile = this.profiles.get(testName)!;
    const endTime = performance.now();

    profile.endTime = endTime;
    profile.duration = endTime - profile.startTime;
    profile.memoryUsage = this.getMemoryUsage();

    // Analyze bottlenecks and slow operations
    profile.bottlenecks = this.identifyBottlenecks(profile);
    profile.slowOperations = this.identifySlowOperations(profile);

    this.currentTest = null;

    // Limit profile entries to prevent memory leaks
    if (this.profiles.size > this.config.maxProfileEntries) {
      const oldestKey = this.profiles.keys().next().value;
      this.profiles.delete(oldestKey);
    }

    return profile;
  }

  /**
   * Track an operation
   */
  trackOperation(
    operationType: keyof TestProfileData['operations'],
    operationName: string
  ): void {
    if (
      !this.config.enableProfiling ||
      !this.config.trackOperations ||
      !this.currentTest
    ) {
      return;
    }

    const profile = this.profiles.get(this.currentTest);
    if (!profile) return;

    // Increment operation count
    profile.operations[operationType]++;

    // Track individual operation timing
    const operationKey = `${operationType}:${operationName}`;
    this.operationCounts.set(
      operationKey,
      (this.operationCounts.get(operationKey) || 0) + 1
    );
  }

  /**
   * Start timing an operation
   */
  startOperation(operationName: string): void {
    if (!this.config.enableProfiling || !this.currentTest) return;

    this.operationTimers.set(operationName, performance.now());
  }

  /**
   * End timing an operation
   */
  endOperation(operationName: string): number {
    if (!this.config.enableProfiling || !this.currentTest) return 0;

    const startTime = this.operationTimers.get(operationName);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.operationTimers.delete(operationName);

    // Check if this is a slow operation
    if (duration > this.config.slowOperationThreshold) {
      this.recordSlowOperation(operationName, duration);
    }

    return duration;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage() {
    if (
      !this.config.trackMemory ||
      typeof process === 'undefined' ||
      !process.memoryUsage
    ) {
      return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
    }

    return process.memoryUsage();
  }

  /**
   * Record a slow operation
   */
  private recordSlowOperation(operationName: string, duration: number): void {
    if (!this.currentTest) return;

    const profile = this.profiles.get(this.currentTest);
    if (!profile) return;

    const impact = this.calculateImpact(duration, profile.duration);
    const optimization = this.suggestOptimization(operationName, duration);

    profile.slowOperations.push({
      operation: operationName,
      duration,
      threshold: this.config.slowOperationThreshold,
      impact,
      optimization,
    });
  }

  /**
   * Calculate impact of slow operation
   */
  private calculateImpact(
    operationDuration: number,
    totalDuration: number
  ): 'low' | 'medium' | 'high' {
    if (totalDuration === 0) return 'low';

    const percentage = (operationDuration / totalDuration) * 100;

    if (percentage > 25) return 'high';
    if (percentage > 10) return 'medium';
    return 'low';
  }

  /**
   * Suggest optimization for slow operation
   */
  private suggestOptimization(operationName: string, duration: number): string {
    const lowerName = operationName.toLowerCase();

    if (lowerName.includes('render')) {
      return 'Consider reducing component complexity or using React.memo()';
    }

    if (lowerName.includes('mock')) {
      return 'Optimize mock implementation or use lazy initialization';
    }

    if (lowerName.includes('dom')) {
      return 'Reduce DOM queries or use more specific selectors';
    }

    if (lowerName.includes('wait')) {
      return 'Reduce wait times or use more efficient waiting strategies';
    }

    if (lowerName.includes('async')) {
      return 'Optimize async operations or use parallel execution';
    }

    return 'Consider caching or optimizing this operation';
  }

  /**
   * Identify bottlenecks in test execution
   */
  private identifyBottlenecks(profile: TestProfileData): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];
    const threshold = profile.duration * this.config.bottleneckThreshold;

    // Analyze operation counts and suggest optimizations
    for (const [operation, count] of this.operationCounts.entries()) {
      if (count > 10) {
        // More than 10 operations of same type
        const estimatedDuration = count * 10; // Rough estimate

        if (estimatedDuration > threshold) {
          bottlenecks.push({
            operation,
            duration: estimatedDuration,
            percentage: (estimatedDuration / profile.duration) * 100,
            suggestions: this.generateBottleneckSuggestions(operation, count),
          });
        }
      }
    }

    return bottlenecks.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Generate suggestions for bottlenecks
   */
  private generateBottleneckSuggestions(
    operation: string,
    count: number
  ): string[] {
    const suggestions: string[] = [];
    const [type, name] = operation.split(':');

    switch (type) {
      case 'domOperations':
        suggestions.push(
          `${count} DOM operations detected. Consider batching or reducing queries.`
        );
        suggestions.push('Use more specific selectors to reduce search time.');
        break;

      case 'mockCalls':
        suggestions.push(
          `${count} mock calls detected. Consider optimizing mock implementation.`
        );
        suggestions.push('Use lazy initialization for expensive mocks.');
        break;

      case 'rerenders':
        suggestions.push(
          `${count} re-renders detected. Consider using React.memo() or useMemo().`
        );
        suggestions.push(
          'Check for unnecessary prop changes causing re-renders.'
        );
        break;

      case 'asyncOperations':
        suggestions.push(
          `${count} async operations detected. Consider parallel execution.`
        );
        suggestions.push('Reduce async operation complexity or use caching.');
        break;

      case 'timerOperations':
        suggestions.push(
          `${count} timer operations detected. Consider using fake timers.`
        );
        suggestions.push('Reduce timer delays or batch timer operations.');
        break;
    }

    return suggestions;
  }

  /**
   * Identify slow operations
   */
  private identifySlowOperations(
    profile: TestProfileData
  ): SlowOperationInfo[] {
    return profile.slowOperations.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: {
      totalTests: number;
      averageDuration: number;
      slowTests: number;
      totalBottlenecks: number;
      memoryLeaks: number;
    };
    slowestTests: TestProfileData[];
    commonBottlenecks: {
      operation: string;
      frequency: number;
      suggestions: string[];
    }[];
    recommendations: string[];
  } {
    const profiles = Array.from(this.profiles.values());
    const totalTests = profiles.length;
    const averageDuration =
      totalTests > 0
        ? profiles.reduce((sum, p) => sum + p.duration, 0) / totalTests
        : 0;

    const slowTests = profiles.filter((p) => p.duration > 5000); // > 5 seconds
    const totalBottlenecks = profiles.reduce(
      (sum, p) => sum + p.bottlenecks.length,
      0
    );

    // Detect potential memory leaks
    const memoryLeaks = profiles.filter((p) => {
      const memDiff = p.memoryUsage.heapUsed;
      return memDiff > 50 * 1024 * 1024; // > 50MB
    }).length;

    const slowestTests = profiles
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Analyze common bottlenecks
    const bottleneckMap = new Map<
      string,
      { frequency: number; suggestions: Set<string> }
    >();

    profiles.forEach((profile) => {
      profile.bottlenecks.forEach((bottleneck) => {
        const existing = bottleneckMap.get(bottleneck.operation) || {
          frequency: 0,
          suggestions: new Set(),
        };

        existing.frequency++;
        bottleneck.suggestions.forEach((s) => existing.suggestions.add(s));
        bottleneckMap.set(bottleneck.operation, existing);
      });
    });

    const commonBottlenecks = Array.from(bottleneckMap.entries())
      .map(([operation, data]) => ({
        operation,
        frequency: data.frequency,
        suggestions: Array.from(data.suggestions),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const recommendations = this.generateRecommendations({
      totalTests,
      averageDuration,
      slowTests: slowTests.length,
      commonBottlenecks,
      memoryLeaks,
    });

    return {
      summary: {
        totalTests,
        averageDuration,
        slowTests: slowTests.length,
        totalBottlenecks,
        memoryLeaks,
      },
      slowestTests,
      commonBottlenecks,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(data: {
    totalTests: number;
    averageDuration: number;
    slowTests: number;
    commonBottlenecks: any[];
    memoryLeaks: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.averageDuration > 3000) {
      recommendations.push(
        `Average test duration is ${data.averageDuration.toFixed(0)}ms. Target: <1000ms for optimal performance.`
      );
    }

    if (data.slowTests > 0) {
      const percentage = (data.slowTests / data.totalTests) * 100;
      recommendations.push(
        `${percentage.toFixed(1)}% of tests are slow (>5s). Focus on optimizing the slowest tests first.`
      );
    }

    if (data.commonBottlenecks.length > 0) {
      const topBottleneck = data.commonBottlenecks[0];
      recommendations.push(
        `Most common bottleneck: ${topBottleneck.operation} (${topBottleneck.frequency} occurrences). ${topBottleneck.suggestions[0] || 'Consider optimization.'}`
      );
    }

    if (data.memoryLeaks > 0) {
      recommendations.push(
        `${data.memoryLeaks} tests show high memory usage. Check for memory leaks and improve cleanup.`
      );
    }

    // Parallel execution recommendation
    if (data.totalTests > 10 && data.averageDuration > 1000) {
      recommendations.push(
        'Consider enabling parallel test execution to improve overall performance.'
      );
    }

    // Mock optimization recommendation
    if (data.commonBottlenecks.some((b) => b.operation.includes('mock'))) {
      recommendations.push(
        'Mock operations are a common bottleneck. Consider lazy initialization and mock pooling.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        '✅ Test performance looks good! All metrics are within acceptable ranges.'
      );
    }

    return recommendations;
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
    this.operationTimers.clear();
    this.operationCounts.clear();
    this.currentTest = null;
  }

  /**
   * Get profile for specific test
   */
  getProfile(testName: string): TestProfileData | undefined {
    return this.profiles.get(testName);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): TestProfileData[] {
    return Array.from(this.profiles.values());
  }
}

// Global profiler instance
export const testProfiler = new TestPerformanceProfiler();

// Helper functions for easy profiling
export const profileTest = (testName: string) => {
  testProfiler.startTest(testName);

  return {
    end: () => testProfiler.endTest(testName),
    trackOperation: (type: keyof TestProfileData['operations'], name: string) =>
      testProfiler.trackOperation(type, name),
    startOperation: (name: string) => testProfiler.startOperation(name),
    endOperation: (name: string) => testProfiler.endOperation(name),
  };
};

// Decorator for automatic test profiling
export const withProfiling = <T extends (...args: any[]) => any>(
  testFn: T,
  testName: string
): T => {
  return ((...args: any[]) => {
    const profile = profileTest(testName);

    try {
      const result = testFn(...args);

      if (result instanceof Promise) {
        return result.finally(() => profile.end());
      } else {
        profile.end();
        return result;
      }
    } catch (error) {
      profile.end();
      throw error;
    }
  }) as T;
};

// Performance-aware test utilities
export const performanceUtils = {
  // Measure operation duration
  measureOperation: async <T>(
    operationName: string,
    operation: () => T | Promise<T>
  ): Promise<{ result: T; duration: number }> => {
    testProfiler.startOperation(operationName);

    try {
      const result = await Promise.resolve(operation());
      const duration = testProfiler.endOperation(operationName);
      return { result, duration };
    } catch (error) {
      testProfiler.endOperation(operationName);
      throw error;
    }
  },

  // Track DOM operations
  trackDOMOperation: (operationName: string) => {
    testProfiler.trackOperation('domOperations', operationName);
  },

  // Track mock calls
  trackMockCall: (mockName: string) => {
    testProfiler.trackOperation('mockCalls', mockName);
  },

  // Track re-renders
  trackRerender: (componentName: string) => {
    testProfiler.trackOperation('rerenders', componentName);
  },

  // Track async operations
  trackAsyncOperation: (operationName: string) => {
    testProfiler.trackOperation('asyncOperations', operationName);
  },

  // Track timer operations
  trackTimerOperation: (operationName: string) => {
    testProfiler.trackOperation('timerOperations', operationName);
  },
};
