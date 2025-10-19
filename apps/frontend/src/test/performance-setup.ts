/**
 * Performance Setup
 * Integrates all performance optimization systems for comprehensive test performance monitoring
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { testProfiler, profileTest } from './performance-profiler';
import { lazyMockSystem } from './lazy-mock-system';
import {
  parallelOptimizer,
  registerTestMetadata,
} from './parallel-test-optimizer';
import { domOptimizer } from './dom-optimizer';
import {
  testPerformanceMonitor,
  recordTestMetrics,
} from './performance-monitor';
import { testPerformanceManager } from './performance-manager';

export interface PerformanceSetupConfig {
  enableProfiling: boolean;
  enableLazyMocks: boolean;
  enableParallelOptimization: boolean;
  enableDOMOptimization: boolean;
  enablePerformanceMonitoring: boolean;
  enablePerformanceManager: boolean;
  generateReports: boolean;
  autoOptimize: boolean;
  trackMemoryUsage: boolean;
  warnThresholds: {
    testDuration: number;
    mockCreation: number;
    domQuery: number;
    memoryUsage: number;
  };
}

const DEFAULT_PERFORMANCE_CONFIG: PerformanceSetupConfig = {
  enableProfiling: process.env.NODE_ENV !== 'production',
  enableLazyMocks: true,
  enableParallelOptimization: true,
  enableDOMOptimization: true,
  enablePerformanceMonitoring: true,
  enablePerformanceManager: true,
  generateReports:
    process.env.CI === 'true' || process.env.GENERATE_PERF_REPORTS === 'true',
  autoOptimize: true,
  trackMemoryUsage: true,
  warnThresholds: {
    testDuration: 5000, // 5 seconds
    mockCreation: 100, // 100ms
    domQuery: 50, // 50ms
    memoryUsage: 50 * 1024 * 1024, // 50MB
  },
};

export class PerformanceSetup {
  private config: PerformanceSetupConfig;
  private currentTestName: string | null = null;
  private testStartTime: number = 0;
  private testStartMemory: NodeJS.MemoryUsage | null = null;
  private performanceData = new Map<string, any>();

  constructor(config: Partial<PerformanceSetupConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.initializePerformanceSystems();
  }

  /**
   * Initialize all performance systems
   */
  private initializePerformanceSystems(): void {
    if (this.config.enableProfiling) {
      console.log('🔧 Performance profiling enabled');
    }

    if (this.config.enableLazyMocks) {
      console.log('🚀 Lazy mock system enabled');
    }

    if (this.config.enableParallelOptimization) {
      console.log('⚡ Parallel optimization enabled');
    }

    if (this.config.enableDOMOptimization) {
      console.log('🎯 DOM optimization enabled');
    }

    if (this.config.enablePerformanceMonitoring) {
      console.log('📊 Performance monitoring enabled');
    }
  }

  /**
   * Setup performance monitoring for a test
   */
  setupTest(testName: string): {
    profile: ReturnType<typeof profileTest>;
    cleanup: () => void;
  } {
    this.currentTestName = testName;
    this.testStartTime = performance.now();

    if (
      this.config.trackMemoryUsage &&
      typeof process !== 'undefined' &&
      process.memoryUsage
    ) {
      this.testStartMemory = process.memoryUsage();
    }

    // Start profiling
    const profile = this.config.enableProfiling ? profileTest(testName) : null;

    // Register test metadata for parallel optimization
    if (this.config.enableParallelOptimization) {
      this.registerTestForOptimization(testName);
    }

    // Start performance manager tracking
    if (this.config.enablePerformanceManager) {
      testPerformanceManager.startTimer(`test-${testName}`);
    }

    const cleanup = () => {
      this.cleanupTest(testName, profile);
    };

    return { profile: profile!, cleanup };
  }

  /**
   * Register test for parallel optimization
   */
  private registerTestForOptimization(testName: string): void {
    // Analyze test name to determine characteristics
    const metadata = this.analyzeTestCharacteristics(testName);
    registerTestMetadata(metadata);
  }

  /**
   * Analyze test characteristics for optimization
   */
  private analyzeTestCharacteristics(testName: string) {
    const lowerName = testName.toLowerCase();

    // Estimate resource usage based on test name patterns
    const resourceUsage = {
      memory: this.estimateMemoryUsage(lowerName),
      cpu: this.estimateCPUUsage(lowerName),
      io: this.estimateIOUsage(lowerName),
    };

    // Determine isolation requirements
    const isolationRequirements = {
      requiresCleanDOM:
        lowerName.includes('render') || lowerName.includes('component'),
      requiresCleanMocks:
        lowerName.includes('mock') || lowerName.includes('hook'),
      requiresCleanStorage:
        lowerName.includes('storage') || lowerName.includes('persist'),
      requiresCleanTimers:
        lowerName.includes('timer') ||
        lowerName.includes('debounce') ||
        lowerName.includes('delay'),
    };

    // Extract tags from test name
    const tags = this.extractTestTags(lowerName);

    return {
      name: testName,
      estimatedDuration: this.estimateTestDuration(lowerName),
      dependencies: [],
      resourceUsage,
      isolationRequirements,
      tags,
    };
  }

  /**
   * Estimate memory usage based on test patterns
   */
  private estimateMemoryUsage(testName: string): 'low' | 'medium' | 'high' {
    if (
      testName.includes('integration') ||
      testName.includes('e2e') ||
      testName.includes('large')
    ) {
      return 'high';
    }
    if (
      testName.includes('component') ||
      testName.includes('render') ||
      testName.includes('multiple')
    ) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Estimate CPU usage based on test patterns
   */
  private estimateCPUUsage(testName: string): 'low' | 'medium' | 'high' {
    if (
      testName.includes('performance') ||
      testName.includes('stress') ||
      testName.includes('concurrent')
    ) {
      return 'high';
    }
    if (
      testName.includes('async') ||
      testName.includes('complex') ||
      testName.includes('calculation')
    ) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Estimate IO usage based on test patterns
   */
  private estimateIOUsage(testName: string): 'low' | 'medium' | 'high' {
    if (
      testName.includes('api') ||
      testName.includes('network') ||
      testName.includes('fetch')
    ) {
      return 'high';
    }
    if (
      testName.includes('storage') ||
      testName.includes('file') ||
      testName.includes('data')
    ) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Estimate test duration based on patterns
   */
  private estimateTestDuration(testName: string): number {
    if (testName.includes('integration') || testName.includes('e2e')) {
      return 10000; // 10 seconds
    }
    if (
      testName.includes('async') ||
      testName.includes('wait') ||
      testName.includes('debounce')
    ) {
      return 3000; // 3 seconds
    }
    if (testName.includes('component') || testName.includes('render')) {
      return 1500; // 1.5 seconds
    }
    return 1000; // 1 second default
  }

  /**
   * Extract tags from test name
   */
  private extractTestTags(testName: string): string[] {
    const tags: string[] = [];

    if (testName.includes('unit')) tags.push('unit');
    if (testName.includes('integration')) tags.push('integration');
    if (testName.includes('e2e')) tags.push('e2e');
    if (testName.includes('component')) tags.push('component');
    if (testName.includes('hook')) tags.push('hook');
    if (testName.includes('api')) tags.push('api');
    if (testName.includes('async')) tags.push('async');
    if (testName.includes('performance')) tags.push('performance');
    if (testName.includes('accessibility')) tags.push('a11y');

    return tags;
  }

  /**
   * Cleanup test performance tracking
   */
  private cleanupTest(testName: string, profile: any): void {
    const duration = performance.now() - this.testStartTime;

    // End profiling
    if (profile) {
      profile.end();
    }

    // End performance manager tracking
    if (this.config.enablePerformanceManager) {
      testPerformanceManager.endTimer(`test-${testName}`);
    }

    // Record test metrics
    if (this.config.enablePerformanceMonitoring) {
      const memoryUsage = this.calculateMemoryUsage();
      const operations = this.collectOperationCounts();

      recordTestMetrics(testName, duration, 'passed', operations);
    }

    // Record for parallel optimization
    if (this.config.enableParallelOptimization) {
      parallelOptimizer.recordTestExecution(testName, duration);
    }

    // Check thresholds and warn if necessary
    this.checkPerformanceThresholds(testName, duration);

    // Store performance data
    this.performanceData.set(testName, {
      duration,
      memoryUsage: this.calculateMemoryUsage(),
      operations: this.collectOperationCounts(),
      timestamp: Date.now(),
    });

    this.currentTestName = null;
  }

  /**
   * Calculate memory usage delta
   */
  private calculateMemoryUsage(): number {
    if (
      !this.config.trackMemoryUsage ||
      !this.testStartMemory ||
      typeof process === 'undefined'
    ) {
      return 0;
    }

    const currentMemory = process.memoryUsage();
    return currentMemory.heapUsed - this.testStartMemory.heapUsed;
  }

  /**
   * Collect operation counts from various systems
   */
  private collectOperationCounts(): Record<string, number> {
    const operations: Record<string, number> = {};

    // Get DOM operation stats
    if (this.config.enableDOMOptimization) {
      const domStats = domOptimizer.getStats();
      operations.domQueries = domStats.mostUsedQueries.reduce(
        (sum, q) => sum + q.callCount,
        0
      );
    }

    // Get mock operation stats
    if (this.config.enableLazyMocks) {
      const mockStats = lazyMockSystem.getUsageStats();
      operations.mockCreations = mockStats.reduce(
        (sum, s) => sum + s.totalCreated,
        0
      );
      operations.mockReuses = mockStats.reduce(
        (sum, s) => sum + s.totalReused,
        0
      );
    }

    // Get performance manager stats
    if (this.config.enablePerformanceManager) {
      const perfStats = testPerformanceManager.getStats();
      operations.performanceOperations = Object.values(
        perfStats.operationCounts
      ).reduce((sum, count) => sum + count, 0);
    }

    return operations;
  }

  /**
   * Check performance thresholds and warn
   */
  private checkPerformanceThresholds(testName: string, duration: number): void {
    const { warnThresholds } = this.config;

    if (duration > warnThresholds.testDuration) {
      console.warn(
        `⚠️  Slow test: ${testName} took ${duration.toFixed(0)}ms (threshold: ${warnThresholds.testDuration}ms)`
      );
    }

    const memoryUsage = this.calculateMemoryUsage();
    if (memoryUsage > warnThresholds.memoryUsage) {
      console.warn(
        `⚠️  High memory usage: ${testName} used ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`
      );
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): {
    summary: {
      totalTests: number;
      averageDuration: number;
      totalDuration: number;
      slowTests: number;
      memoryLeaks: number;
    };
    profilerReport: any;
    mockSystemReport: any;
    parallelOptimizerReport: any;
    domOptimizerReport: any;
    recommendations: string[];
  } {
    const testData = Array.from(this.performanceData.values());
    const totalTests = testData.length;
    const totalDuration = testData.reduce(
      (sum, data) => sum + data.duration,
      0
    );
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;
    const slowTests = testData.filter(
      (data) => data.duration > this.config.warnThresholds.testDuration
    ).length;
    const memoryLeaks = testData.filter(
      (data) => data.memoryUsage > this.config.warnThresholds.memoryUsage
    ).length;

    const summary = {
      totalTests,
      averageDuration,
      totalDuration,
      slowTests,
      memoryLeaks,
    };

    // Get reports from all systems
    const profilerReport = this.config.enableProfiling
      ? testProfiler.generateReport()
      : null;
    const mockSystemReport = this.config.enableLazyMocks
      ? lazyMockSystem.getPerformanceReport()
      : null;
    const parallelOptimizerReport = this.config.enableParallelOptimization
      ? parallelOptimizer.generateReport()
      : null;
    const domOptimizerReport = this.config.enableDOMOptimization
      ? domOptimizer.getStats()
      : null;

    // Generate comprehensive recommendations
    const recommendations = this.generateComprehensiveRecommendations(
      summary,
      profilerReport,
      mockSystemReport,
      parallelOptimizerReport,
      domOptimizerReport
    );

    return {
      summary,
      profilerReport,
      mockSystemReport,
      parallelOptimizerReport,
      domOptimizerReport,
      recommendations,
    };
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(
    summary: any,
    profilerReport: any,
    mockSystemReport: any,
    parallelOptimizerReport: any,
    domOptimizerReport: any
  ): string[] {
    const recommendations: string[] = [];

    // Overall performance recommendations
    if (summary.averageDuration > 2000) {
      recommendations.push(
        `Average test duration is ${summary.averageDuration.toFixed(0)}ms. Target: <1000ms for optimal performance.`
      );
    }

    if (summary.slowTests > 0) {
      const percentage = (summary.slowTests / summary.totalTests) * 100;
      recommendations.push(
        `${percentage.toFixed(1)}% of tests are slow. Focus on optimizing the slowest tests first.`
      );
    }

    // Add recommendations from subsystems
    if (profilerReport?.recommendations) {
      recommendations.push(...profilerReport.recommendations);
    }

    if (mockSystemReport?.recommendations) {
      recommendations.push(...mockSystemReport.recommendations);
    }

    if (parallelOptimizerReport?.recommendations) {
      Object.values(parallelOptimizerReport.recommendations).forEach(
        (recs: any) => {
          if (Array.isArray(recs)) {
            recommendations.push(...recs);
          }
        }
      );
    }

    if (domOptimizerReport?.recommendations) {
      recommendations.push(...domOptimizerReport.recommendations);
    }

    // Memory recommendations
    if (summary.memoryLeaks > 0) {
      recommendations.push(
        `${summary.memoryLeaks} tests show high memory usage. Check for memory leaks and improve cleanup.`
      );
    }

    // Remove duplicates and limit to top 10
    const uniqueRecommendations = Array.from(new Set(recommendations));
    return uniqueRecommendations.slice(0, 10);
  }

  /**
   * Print performance summary
   */
  printSummary(): void {
    if (!this.config.generateReports) return;

    const report = this.generateReport();

    console.log('\n🚀 Performance Summary');
    console.log('======================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(
      `Average Duration: ${report.summary.averageDuration.toFixed(0)}ms`
    );
    console.log(
      `Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`
    );
    console.log(`Slow Tests: ${report.summary.slowTests}`);
    console.log(`Memory Issues: ${report.summary.memoryLeaks}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('======================\n');
  }

  /**
   * Reset all performance systems
   */
  reset(): void {
    this.performanceData.clear();
    this.currentTestName = null;
    this.testStartTime = 0;
    this.testStartMemory = null;

    if (this.config.enableProfiling) {
      testProfiler.clear();
    }

    if (this.config.enableLazyMocks) {
      lazyMockSystem.reset();
    }

    if (this.config.enableParallelOptimization) {
      parallelOptimizer.reset();
    }

    if (this.config.enableDOMOptimization) {
      domOptimizer.clear();
    }

    if (this.config.enablePerformanceManager) {
      testPerformanceManager.reset();
    }
  }
}

// Global performance setup instance
export const performanceSetup = new PerformanceSetup();

// Setup global hooks
beforeAll(() => {
  console.log('🚀 Initializing performance optimization systems...');
});

afterAll(() => {
  performanceSetup.printSummary();

  if (performanceSetup['config'].generateReports) {
    const report = performanceSetup.generateReport();

    // Save detailed report to file
    try {
      const fs = require('fs');
      fs.writeFileSync(
        './test-performance-detailed-report.json',
        JSON.stringify(report, null, 2)
      );
      console.log(
        '📊 Detailed performance report saved to test-performance-detailed-report.json'
      );
    } catch (error) {
      console.warn('Could not save detailed performance report:', error);
    }
  }
});

// Helper function for test setup
export const setupPerformanceTest = (testName: string) => {
  return performanceSetup.setupTest(testName);
};

// Export configuration for customization
export { DEFAULT_PERFORMANCE_CONFIG };
