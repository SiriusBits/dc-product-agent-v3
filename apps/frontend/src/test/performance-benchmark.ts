/**
 * Performance Benchmark Utility
 * Provides benchmarking capabilities for test performance measurement and comparison
 */

import { vi } from 'vitest';
import { performance } from 'perf_hooks';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  operations: {
    mockCreations: number;
    domQueries: number;
    rerenders: number;
    asyncOperations: number;
  };
  timestamp: number;
  metadata: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
    totalMemory: number;
  };
}

export interface BenchmarkComparison {
  current: BenchmarkResult;
  baseline?: BenchmarkResult;
  improvement: {
    duration: number; // Percentage improvement (negative = regression)
    memoryUsage: number;
    operations: Record<string, number>;
  };
  status: 'improved' | 'regressed' | 'stable' | 'no-baseline';
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkResult[];
  summary: {
    totalDuration: number;
    averageDuration: number;
    fastestTest: string;
    slowestTest: string;
    memoryEfficient: string;
    memoryHeavy: string;
  };
}

export class PerformanceBenchmark {
  private benchmarks = new Map<string, BenchmarkResult[]>();
  private currentBenchmark: {
    name: string;
    startTime: number;
    startMemory: NodeJS.MemoryUsage;
    operations: BenchmarkResult['operations'];
  } | null = null;

  private baselineFile = './test-performance-baseline.json';
  private resultsFile = './test-performance-results.json';

  /**
   * Start benchmarking a test or operation
   */
  start(name: string): void {
    if (this.currentBenchmark) {
      console.warn(
        `Benchmark ${this.currentBenchmark.name} was not properly ended before starting ${name}`
      );
      this.end();
    }

    this.currentBenchmark = {
      name,
      startTime: performance.now(),
      startMemory: this.getMemoryUsage(),
      operations: {
        mockCreations: 0,
        domQueries: 0,
        rerenders: 0,
        asyncOperations: 0,
      },
    };
  }

  /**
   * Record an operation during benchmarking
   */
  recordOperation(type: keyof BenchmarkResult['operations'], count = 1): void {
    if (!this.currentBenchmark) return;
    this.currentBenchmark.operations[type] += count;
  }

  /**
   * End benchmarking and record result
   */
  end(): BenchmarkResult | null {
    if (!this.currentBenchmark) {
      console.warn('No active benchmark to end');
      return null;
    }

    const duration = performance.now() - this.currentBenchmark.startTime;
    const currentMemory = this.getMemoryUsage();

    const result: BenchmarkResult = {
      name: this.currentBenchmark.name,
      duration,
      memoryUsage: {
        heapUsed:
          currentMemory.heapUsed - this.currentBenchmark.startMemory.heapUsed,
        heapTotal: currentMemory.heapTotal,
        external:
          currentMemory.external - this.currentBenchmark.startMemory.external,
        rss: currentMemory.rss - this.currentBenchmark.startMemory.rss,
      },
      operations: { ...this.currentBenchmark.operations },
      timestamp: Date.now(),
      metadata: this.getSystemMetadata(),
    };

    // Store result
    const existing = this.benchmarks.get(result.name) || [];
    existing.push(result);
    this.benchmarks.set(result.name, existing);

    this.currentBenchmark = null;
    return result;
  }

  /**
   * Benchmark a function execution
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    iterations = 1
  ): Promise<{
    result: T;
    benchmark: BenchmarkResult;
    iterations: BenchmarkResult[];
  }> {
    const iterationResults: BenchmarkResult[] = [];
    let lastResult: T;

    for (let i = 0; i < iterations; i++) {
      this.start(`${name}-iteration-${i + 1}`);

      try {
        lastResult = await Promise.resolve(fn());
      } catch (error) {
        this.end();
        throw error;
      }

      const iterationResult = this.end()!;
      iterationResults.push(iterationResult);
    }

    // Calculate average benchmark
    const avgBenchmark: BenchmarkResult = {
      name,
      duration:
        iterationResults.reduce((sum, r) => sum + r.duration, 0) / iterations,
      memoryUsage: {
        heapUsed:
          iterationResults.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0) /
          iterations,
        heapTotal:
          iterationResults[iterationResults.length - 1].memoryUsage.heapTotal,
        external:
          iterationResults.reduce((sum, r) => sum + r.memoryUsage.external, 0) /
          iterations,
        rss:
          iterationResults.reduce((sum, r) => sum + r.memoryUsage.rss, 0) /
          iterations,
      },
      operations: {
        mockCreations: Math.round(
          iterationResults.reduce(
            (sum, r) => sum + r.operations.mockCreations,
            0
          ) / iterations
        ),
        domQueries: Math.round(
          iterationResults.reduce(
            (sum, r) => sum + r.operations.domQueries,
            0
          ) / iterations
        ),
        rerenders: Math.round(
          iterationResults.reduce((sum, r) => sum + r.operations.rerenders, 0) /
            iterations
        ),
        asyncOperations: Math.round(
          iterationResults.reduce(
            (sum, r) => sum + r.operations.asyncOperations,
            0
          ) / iterations
        ),
      },
      timestamp: Date.now(),
      metadata: this.getSystemMetadata(),
    };

    // Store average result
    const existing = this.benchmarks.get(name) || [];
    existing.push(avgBenchmark);
    this.benchmarks.set(name, existing);

    return {
      result: lastResult!,
      benchmark: avgBenchmark,
      iterations: iterationResults,
    };
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline(): BenchmarkComparison[] {
    const baseline = this.loadBaseline();
    const comparisons: BenchmarkComparison[] = [];

    for (const [name, results] of this.benchmarks.entries()) {
      const current = results[results.length - 1]; // Latest result
      const baselineResult = baseline.get(name)?.[0]; // Use first baseline result

      const comparison: BenchmarkComparison = {
        current,
        baseline: baselineResult,
        improvement: this.calculateImprovement(current, baselineResult),
        status: this.determineStatus(current, baselineResult),
      };

      comparisons.push(comparison);
    }

    return comparisons;
  }

  /**
   * Calculate improvement percentage
   */
  private calculateImprovement(
    current: BenchmarkResult,
    baseline?: BenchmarkResult
  ): BenchmarkComparison['improvement'] {
    if (!baseline) {
      return {
        duration: 0,
        memoryUsage: 0,
        operations: {},
      };
    }

    const durationImprovement =
      baseline.duration > 0
        ? ((baseline.duration - current.duration) / baseline.duration) * 100
        : 0;

    const memoryImprovement =
      baseline.memoryUsage.heapUsed > 0
        ? ((baseline.memoryUsage.heapUsed - current.memoryUsage.heapUsed) /
            baseline.memoryUsage.heapUsed) *
          100
        : 0;

    const operationImprovements: Record<string, number> = {};
    for (const [key, currentValue] of Object.entries(current.operations)) {
      const baselineValue =
        baseline.operations[key as keyof BenchmarkResult['operations']];
      if (baselineValue > 0) {
        operationImprovements[key] =
          ((baselineValue - currentValue) / baselineValue) * 100;
      }
    }

    return {
      duration: durationImprovement,
      memoryUsage: memoryImprovement,
      operations: operationImprovements,
    };
  }

  /**
   * Determine performance status
   */
  private determineStatus(
    current: BenchmarkResult,
    baseline?: BenchmarkResult
  ): BenchmarkComparison['status'] {
    if (!baseline) return 'no-baseline';

    const durationChange =
      ((current.duration - baseline.duration) / baseline.duration) * 100;
    const memoryChange =
      ((current.memoryUsage.heapUsed - baseline.memoryUsage.heapUsed) /
        baseline.memoryUsage.heapUsed) *
      100;

    // Consider it a regression if duration increased by >10% or memory by >20%
    if (durationChange > 10 || memoryChange > 20) {
      return 'regressed';
    }

    // Consider it an improvement if duration decreased by >5% or memory by >10%
    if (durationChange < -5 || memoryChange < -10) {
      return 'improved';
    }

    return 'stable';
  }

  /**
   * Generate benchmark suite summary
   */
  generateSuite(name: string): BenchmarkSuite {
    const allResults = Array.from(this.benchmarks.values()).flat();

    if (allResults.length === 0) {
      return {
        name,
        benchmarks: [],
        summary: {
          totalDuration: 0,
          averageDuration: 0,
          fastestTest: '',
          slowestTest: '',
          memoryEfficient: '',
          memoryHeavy: '',
        },
      };
    }

    const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalDuration / allResults.length;

    const sortedByDuration = [...allResults].sort(
      (a, b) => a.duration - b.duration
    );
    const sortedByMemory = [...allResults].sort(
      (a, b) => a.memoryUsage.heapUsed - b.memoryUsage.heapUsed
    );

    return {
      name,
      benchmarks: allResults,
      summary: {
        totalDuration,
        averageDuration,
        fastestTest: sortedByDuration[0]?.name || '',
        slowestTest: sortedByDuration[sortedByDuration.length - 1]?.name || '',
        memoryEfficient: sortedByMemory[0]?.name || '',
        memoryHeavy: sortedByMemory[sortedByMemory.length - 1]?.name || '',
      },
    };
  }

  /**
   * Save current results as baseline
   */
  saveBaseline(): void {
    const data = Object.fromEntries(this.benchmarks.entries());

    try {
      writeFileSync(this.baselineFile, JSON.stringify(data, null, 2));
      console.log(`📊 Baseline saved to ${this.baselineFile}`);
    } catch (error) {
      console.error('Failed to save baseline:', error);
    }
  }

  /**
   * Load baseline results
   */
  private loadBaseline(): Map<string, BenchmarkResult[]> {
    try {
      if (!existsSync(this.baselineFile)) {
        return new Map();
      }

      const data = JSON.parse(readFileSync(this.baselineFile, 'utf-8'));
      return new Map(Object.entries(data));
    } catch (error) {
      console.warn('Could not load baseline:', error);
      return new Map();
    }
  }

  /**
   * Save current results
   */
  saveResults(): void {
    const suite = this.generateSuite('Test Suite');
    const comparisons = this.compareWithBaseline();

    const report = {
      suite,
      comparisons,
      timestamp: new Date().toISOString(),
      metadata: this.getSystemMetadata(),
    };

    try {
      writeFileSync(this.resultsFile, JSON.stringify(report, null, 2));
      console.log(`📊 Results saved to ${this.resultsFile}`);
    } catch (error) {
      console.error('Failed to save results:', error);
    }
  }

  /**
   * Print benchmark report
   */
  printReport(): void {
    const suite = this.generateSuite('Test Suite');
    const comparisons = this.compareWithBaseline();

    console.log('\n🏁 Performance Benchmark Report');
    console.log('================================');
    console.log(`Total Tests: ${suite.benchmarks.length}`);
    console.log(
      `Total Duration: ${(suite.summary.totalDuration / 1000).toFixed(2)}s`
    );
    console.log(
      `Average Duration: ${suite.summary.averageDuration.toFixed(0)}ms`
    );
    console.log(`Fastest Test: ${suite.summary.fastestTest}`);
    console.log(`Slowest Test: ${suite.summary.slowestTest}`);

    // Performance status summary
    const improved = comparisons.filter((c) => c.status === 'improved').length;
    const regressed = comparisons.filter(
      (c) => c.status === 'regressed'
    ).length;
    const stable = comparisons.filter((c) => c.status === 'stable').length;
    const noBaseline = comparisons.filter(
      (c) => c.status === 'no-baseline'
    ).length;

    console.log('\n📈 Performance Changes:');
    console.log(`  Improved: ${improved}`);
    console.log(`  Regressed: ${regressed}`);
    console.log(`  Stable: ${stable}`);
    console.log(`  No Baseline: ${noBaseline}`);

    // Show significant changes
    const significantChanges = comparisons.filter(
      (c) => c.status === 'improved' || c.status === 'regressed'
    );

    if (significantChanges.length > 0) {
      console.log('\n🔍 Significant Changes:');
      significantChanges.slice(0, 5).forEach((change) => {
        const symbol = change.status === 'improved' ? '✅' : '❌';
        const durationChange = change.improvement.duration.toFixed(1);
        console.log(
          `  ${symbol} ${change.current.name}: ${durationChange}% duration change`
        );
      });
    }

    console.log('================================\n');
  }

  /**
   * Get system metadata
   */
  private getSystemMetadata() {
    const os = require('os');
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
    };
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): NodeJS.MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  }

  /**
   * Clear all benchmarks
   */
  clear(): void {
    this.benchmarks.clear();
    this.currentBenchmark = null;
  }

  /**
   * Get all benchmark results
   */
  getResults(): Map<string, BenchmarkResult[]> {
    return new Map(this.benchmarks);
  }
}

// Global benchmark instance
export const performanceBenchmark = new PerformanceBenchmark();

// Helper functions
export const benchmark = (name: string) => {
  performanceBenchmark.start(name);
  return {
    end: () => performanceBenchmark.end(),
    recordOperation: (
      type: keyof BenchmarkResult['operations'],
      count?: number
    ) => performanceBenchmark.recordOperation(type, count),
  };
};

export const measureFunction = async <T>(
  name: string,
  fn: () => T | Promise<T>,
  iterations = 1
) => {
  return performanceBenchmark.measure(name, fn, iterations);
};

// Decorator for automatic benchmarking
export const withBenchmark = <T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T => {
  return ((...args: any[]) => {
    const bench = benchmark(name);

    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.finally(() => bench.end());
      } else {
        bench.end();
        return result;
      }
    } catch (error) {
      bench.end();
      throw error;
    }
  }) as T;
};
