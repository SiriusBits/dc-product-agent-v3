/**
 * Test Performance Monitor
 * Monitors and reports test performance metrics
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface TestMetrics {
  testName: string;
  duration: number;
  timestamp: number;
  status: 'passed' | 'failed' | 'skipped';
  operations: Record<string, number>;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface PerformanceReport {
  totalTests: number;
  totalDuration: number;
  averageDuration: number;
  slowTests: TestMetrics[];
  fastTests: TestMetrics[];
  failedTests: TestMetrics[];
  performanceThresholds: {
    fast: number;
    normal: number;
    slow: number;
  };
  recommendations: string[];
}

export class TestPerformanceMonitor {
  private metrics: TestMetrics[] = [];
  private thresholds = {
    fast: 1000, // < 1 second
    normal: 3000, // < 3 seconds
    slow: 5000, // < 5 seconds
  };
  private reportPath: string;

  constructor(reportPath = './test-performance-report.json') {
    this.reportPath = reportPath;
    this.loadExistingMetrics();
  }

  /**
   * Load existing metrics from previous runs
   */
  private loadExistingMetrics(): void {
    try {
      if (existsSync(this.reportPath)) {
        const data = readFileSync(this.reportPath, 'utf-8');
        const report = JSON.parse(data) as PerformanceReport;
        // Keep only recent metrics (last 100 runs)
        this.metrics = report.slowTests
          .concat(report.fastTests, report.failedTests)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100);
      }
    } catch (error) {
      console.warn('Could not load existing performance metrics:', error);
      this.metrics = [];
    }
  }

  /**
   * Record test metrics
   */
  recordTest(metrics: TestMetrics): void {
    this.metrics.push(metrics);

    // Log slow tests immediately
    if (metrics.duration > this.thresholds.normal) {
      console.warn(
        `⚠️  Slow test detected: ${metrics.testName} (${metrics.duration}ms)`
      );
    }

    // Log failed tests
    if (metrics.status === 'failed') {
      console.error(
        `❌ Test failed: ${metrics.testName} (${metrics.duration}ms)`
      );
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const recentMetrics = this.metrics
      .filter((m) => Date.now() - m.timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
      .filter((m) => m.status !== 'skipped');

    const totalTests = recentMetrics.length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

    const slowTests = recentMetrics
      .filter((m) => m.duration > this.thresholds.normal)
      .sort((a, b) => b.duration - a.duration);

    const fastTests = recentMetrics
      .filter((m) => m.duration <= this.thresholds.fast)
      .sort((a, b) => a.duration - b.duration);

    const failedTests = recentMetrics
      .filter((m) => m.status === 'failed')
      .sort((a, b) => b.duration - a.duration);

    const recommendations = this.generateRecommendations(recentMetrics);

    return {
      totalTests,
      totalDuration,
      averageDuration,
      slowTests,
      fastTests,
      failedTests,
      performanceThresholds: this.thresholds,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: TestMetrics[]): string[] {
    const recommendations: string[] = [];

    const slowTestCount = metrics.filter(
      (m) => m.duration > this.thresholds.normal
    ).length;
    const slowTestPercentage = (slowTestCount / metrics.length) * 100;

    if (slowTestPercentage > 20) {
      recommendations.push(
        `${slowTestPercentage.toFixed(1)}% of tests are slow (>${this.thresholds.normal}ms). Consider optimizing test setup and mocks.`
      );
    }

    const failedTestCount = metrics.filter((m) => m.status === 'failed').length;
    const failureRate = (failedTestCount / metrics.length) * 100;

    if (failureRate > 5) {
      recommendations.push(
        `${failureRate.toFixed(1)}% test failure rate detected. Check for flaky tests and improve test isolation.`
      );
    }

    const averageDuration =
      metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    if (averageDuration > this.thresholds.fast) {
      recommendations.push(
        `Average test duration is ${averageDuration.toFixed(0)}ms. Target: <${this.thresholds.fast}ms for optimal performance.`
      );
    }

    // Check for tests with many operations
    const operationHeavyTests = metrics.filter(
      (m) =>
        Object.values(m.operations).reduce((sum, count) => sum + count, 0) > 10
    );

    if (operationHeavyTests.length > 0) {
      recommendations.push(
        `${operationHeavyTests.length} tests have high operation counts. Consider batching operations or reducing test complexity.`
      );
    }

    // Memory usage recommendations
    const highMemoryTests = metrics.filter(
      (m) => m.memoryUsage && m.memoryUsage.heapUsed > 50 * 1024 * 1024 // 50MB
    );

    if (highMemoryTests.length > 0) {
      recommendations.push(
        `${highMemoryTests.length} tests have high memory usage. Check for memory leaks and improve cleanup.`
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
   * Save performance report to file
   */
  saveReport(): void {
    const report = this.generateReport();

    try {
      writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
      if (process.env.VERBOSE_TESTS) {
        console.log(`📊 Performance report saved to ${this.reportPath}`);
      }
    } catch (error) {
      console.error('Failed to save performance report:', error);
    }
  }

  /**
   * Print performance summary to console
   */
  printSummary(): void {
    const report = this.generateReport();

    // Only show detailed performance summary if requested
    if (process.env.PERF_MONITORING || process.env.VERBOSE_TESTS) {
      console.log('\n📊 Test Performance Summary');
      console.log('================================');
      console.log(`Total Tests: ${report.totalTests}`);
      console.log(
        `Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`
      );
      console.log(`Average Duration: ${report.averageDuration.toFixed(0)}ms`);
      console.log(
        `Slow Tests (>${this.thresholds.normal}ms): ${report.slowTests.length}`
      );
      console.log(
        `Fast Tests (<${this.thresholds.fast}ms): ${report.fastTests.length}`
      );
      console.log(`Failed Tests: ${report.failedTests.length}`);

      if (report.slowTests.length > 0) {
        console.log('\n🐌 Slowest Tests:');
        report.slowTests.slice(0, 5).forEach((test, index) => {
          console.log(`  ${index + 1}. ${test.testName}: ${test.duration}ms`);
        });
      }

      if (report.fastTests.length > 0) {
        console.log('\n⚡ Fastest Tests:');
        report.fastTests.slice(0, 5).forEach((test, index) => {
          console.log(`  ${index + 1}. ${test.testName}: ${test.duration}ms`);
        });
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('================================\n');
  }

  /**
   * Get performance trends
   */
  getTrends(): {
    improving: boolean;
    averageTrend: number;
    recentAverage: number;
    historicalAverage: number;
  } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const recentTests = this.metrics.filter(
      (m) => m.timestamp > oneDayAgo && m.status !== 'skipped'
    );
    const historicalTests = this.metrics.filter(
      (m) =>
        m.timestamp > threeDaysAgo &&
        m.timestamp <= oneDayAgo &&
        m.status !== 'skipped'
    );

    const recentAverage =
      recentTests.length > 0
        ? recentTests.reduce((sum, m) => sum + m.duration, 0) /
          recentTests.length
        : 0;

    const historicalAverage =
      historicalTests.length > 0
        ? historicalTests.reduce((sum, m) => sum + m.duration, 0) /
          historicalTests.length
        : recentAverage;

    const averageTrend = recentAverage - historicalAverage;
    const improving = averageTrend < 0; // Negative trend means faster tests

    return {
      improving,
      averageTrend,
      recentAverage,
      historicalAverage,
    };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(daysToKeep = 7): void {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter((m) => m.timestamp > cutoffTime);
    console.log(`🧹 Cleared metrics older than ${daysToKeep} days`);
  }
}

// Global performance monitor instance
export const testPerformanceMonitor = new TestPerformanceMonitor();

// Helper function to record test metrics
export const recordTestMetrics = (
  testName: string,
  duration: number,
  status: 'passed' | 'failed' | 'skipped',
  operations: Record<string, number> = {}
): void => {
  const memoryUsage = process.memoryUsage
    ? {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      }
    : undefined;

  testPerformanceMonitor.recordTest({
    testName,
    duration,
    timestamp: Date.now(),
    status,
    operations,
    memoryUsage,
  });
};

// Helper function to wrap tests with performance monitoring
export const withPerformanceMonitoring = <T>(
  testName: string,
  testFn: () => T | Promise<T>
): Promise<T> => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage ? process.memoryUsage() : null;

  return Promise.resolve(testFn())
    .then((result) => {
      const duration = Date.now() - startTime;
      recordTestMetrics(testName, duration, 'passed');
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      recordTestMetrics(testName, duration, 'failed');
      throw error;
    });
};
