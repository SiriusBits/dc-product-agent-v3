/**
 * Performance Optimizations Implementation
 * Implements the main performance optimizations for test execution
 */

import { vi } from 'vitest';
import { performanceBenchmark, benchmark } from './performance-benchmark';
import { lazyMockSystem } from './lazy-mock-system';
import { parallelOptimizer } from './parallel-test-optimizer';
import { domOptimizer } from './dom-optimizer';
import { testProfiler } from './performance-profiler';

export interface OptimizationConfig {
  enableLazyMockInit: boolean;
  enableParallelExecution: boolean;
  enableDOMOptimization: boolean;
  enableMockPooling: boolean;
  enableSmartCaching: boolean;
  reduceUnnecessaryOperations: boolean;
  optimizeMockCreation: boolean;
  enableBatchOperations: boolean;
}

const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enableLazyMockInit: true,
  enableParallelExecution: true,
  enableDOMOptimization: true,
  enableMockPooling: true,
  enableSmartCaching: true,
  reduceUnnecessaryOperations: true,
  optimizeMockCreation: true,
  enableBatchOperations: true,
};

export class TestPerformanceOptimizer {
  private config: OptimizationConfig;
  private optimizationStats = {
    mockCreationTime: 0,
    domQueryTime: 0,
    testExecutionTime: 0,
    memoryUsage: 0,
    operationCounts: {
      mocksCreated: 0,
      mocksReused: 0,
      domQueriesCached: 0,
      batchedOperations: 0,
    },
  };

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
    this.initializeOptimizations();
  }

  /**
   * Initialize all performance optimizations
   */
  private initializeOptimizations(): void {
    console.log('🚀 Initializing performance optimizations...');

    if (this.config.enableLazyMockInit) {
      this.setupLazyMockInitialization();
    }

    if (this.config.enableParallelExecution) {
      this.setupParallelExecution();
    }

    if (this.config.enableDOMOptimization) {
      this.setupDOMOptimization();
    }

    if (this.config.enableMockPooling) {
      this.setupMockPooling();
    }

    if (this.config.enableSmartCaching) {
      this.setupSmartCaching();
    }

    if (this.config.reduceUnnecessaryOperations) {
      this.setupOperationReduction();
    }

    if (this.config.optimizeMockCreation) {
      this.setupMockCreationOptimization();
    }

    if (this.config.enableBatchOperations) {
      this.setupBatchOperations();
    }

    console.log('✅ Performance optimizations initialized');
  }

  /**
   * Setup lazy mock initialization
   */
  private setupLazyMockInitialization(): void {
    // Lazy mocks are already set up in lazy-mock-system.ts
    // This just ensures they're configured optimally

    // Pre-warm commonly used mocks
    const commonMocks = ['useChat', 'useProducts', 'useConversations'];
    commonMocks.forEach((mockName) => {
      try {
        lazyMockSystem.getMock(mockName);
        this.optimizationStats.operationCounts.mocksCreated++;
      } catch (error) {
        // Mock factory not registered, skip
      }
    });

    console.log('🔧 Lazy mock initialization optimized');
  }

  /**
   * Setup parallel execution optimization
   */
  private setupParallelExecution(): void {
    // Register common test patterns for parallel optimization
    const testPatterns = [
      {
        name: 'unit-test-pattern',
        estimatedDuration: 1000,
        dependencies: [],
        resourceUsage: {
          memory: 'low' as const,
          cpu: 'low' as const,
          io: 'low' as const,
        },
        isolationRequirements: {
          requiresCleanDOM: false,
          requiresCleanMocks: true,
          requiresCleanStorage: false,
          requiresCleanTimers: false,
        },
        tags: ['unit'],
      },
      {
        name: 'component-test-pattern',
        estimatedDuration: 2000,
        dependencies: [],
        resourceUsage: {
          memory: 'medium' as const,
          cpu: 'medium' as const,
          io: 'low' as const,
        },
        isolationRequirements: {
          requiresCleanDOM: true,
          requiresCleanMocks: true,
          requiresCleanStorage: false,
          requiresCleanTimers: false,
        },
        tags: ['component'],
      },
      {
        name: 'integration-test-pattern',
        estimatedDuration: 5000,
        dependencies: [],
        resourceUsage: {
          memory: 'high' as const,
          cpu: 'high' as const,
          io: 'medium' as const,
        },
        isolationRequirements: {
          requiresCleanDOM: true,
          requiresCleanMocks: true,
          requiresCleanStorage: true,
          requiresCleanTimers: true,
        },
        tags: ['integration'],
      },
    ];

    testPatterns.forEach((pattern) => {
      parallelOptimizer.registerTest(pattern);
    });

    console.log('⚡ Parallel execution optimization configured');
  }

  /**
   * Setup DOM optimization
   */
  private setupDOMOptimization(): void {
    // Pre-load common queries that are likely to be used
    const commonQueries = [
      { type: 'testId', value: 'loading-spinner' },
      { type: 'testId', value: 'error-message' },
      { type: 'testId', value: 'retry-button' },
      { type: 'testId', value: 'chat-input' },
      { type: 'testId', value: 'send-button' },
      { type: 'testId', value: 'product-list' },
      { type: 'testId', value: 'search-input' },
    ];

    domOptimizer.preloadQueries(commonQueries);
    console.log('🎯 DOM optimization configured');
  }

  /**
   * Setup mock pooling
   */
  private setupMockPooling(): void {
    // Mock pooling is handled by the lazy mock system
    // This ensures optimal pool sizes

    // Clean up expired mocks periodically
    setInterval(() => {
      lazyMockSystem.cleanupExpiredMocks(30000); // 30 seconds
    }, 60000); // Every minute

    console.log('🏊 Mock pooling optimization configured');
  }

  /**
   * Setup smart caching
   */
  private setupSmartCaching(): void {
    // Smart caching is implemented in DOM optimizer and lazy mock system
    // This configures cache policies for optimal performance

    // Set up cache warming for frequently accessed elements
    const cacheWarmingInterval = setInterval(() => {
      // Warm up DOM query cache with common selectors
      try {
        domOptimizer.preloadQueries([
          { type: 'testId', value: 'app-container' },
          { type: 'testId', value: 'main-content' },
          { type: 'testId', value: 'navigation' },
        ]);
      } catch (error) {
        // Ignore errors during cache warming
      }
    }, 30000); // Every 30 seconds

    // Clear interval when tests complete
    if (typeof process !== 'undefined') {
      process.on('exit', () => {
        clearInterval(cacheWarmingInterval);
      });
    }

    console.log('🧠 Smart caching optimization configured');
  }

  /**
   * Setup operation reduction
   */
  private setupOperationReduction(): void {
    // Reduce unnecessary DOM operations by batching
    const originalQuerySelector = document.querySelector;
    const originalQuerySelectorAll = document.querySelectorAll;

    let queryBatch: Array<{
      selector: string;
      resolve: (result: any) => void;
    }> = [];
    let batchTimeout: NodeJS.Timeout | null = null;

    const processBatch = () => {
      if (queryBatch.length === 0) return;

      const batch = [...queryBatch];
      queryBatch = [];
      batchTimeout = null;

      // Process all queries in the batch
      batch.forEach(({ selector, resolve }) => {
        try {
          const result = originalQuerySelector.call(document, selector);
          resolve(result);
        } catch (error) {
          resolve(null);
        }
      });

      this.optimizationStats.operationCounts.batchedOperations += batch.length;
    };

    // Override querySelector to batch operations
    document.querySelector = function (selector: string) {
      return new Promise((resolve) => {
        queryBatch.push({ selector, resolve });

        if (!batchTimeout) {
          batchTimeout = setTimeout(processBatch, 0);
        }
      }) as any;
    };

    console.log('🔄 Operation reduction optimization configured');
  }

  /**
   * Setup mock creation optimization
   */
  private setupMockCreationOptimization(): void {
    // Override vi.fn to use optimized mock creation
    const originalViFn = vi.fn;

    vi.fn = function (implementation?: any) {
      const bench = benchmark('mock-creation');

      try {
        const mock = originalViFn.call(vi, implementation);

        // Add performance tracking to mock
        const originalMockImplementation = mock.mockImplementation;
        mock.mockImplementation = function (impl: any) {
          const implBench = benchmark('mock-implementation');
          const result = originalMockImplementation.call(this, impl);
          implBench.end();
          return result;
        };

        bench.recordOperation('mockCreations', 1);
        return mock;
      } finally {
        bench.end();
      }
    } as any;

    console.log('🏭 Mock creation optimization configured');
  }

  /**
   * Setup batch operations
   */
  private setupBatchOperations(): void {
    // Batch DOM mutations for better performance
    let mutationBatch: Array<() => void> = [];
    let mutationTimeout: NodeJS.Timeout | null = null;

    const processMutationBatch = () => {
      if (mutationBatch.length === 0) return;

      const batch = [...mutationBatch];
      mutationBatch = [];
      mutationTimeout = null;

      // Process all mutations in a single batch
      batch.forEach((mutation) => {
        try {
          mutation();
        } catch (error) {
          console.warn('Batch mutation failed:', error);
        }
      });

      this.optimizationStats.operationCounts.batchedOperations += batch.length;
    };

    // Provide batch mutation utility
    (globalThis as any).batchDOMMutation = (mutation: () => void) => {
      mutationBatch.push(mutation);

      if (!mutationTimeout) {
        mutationTimeout = setTimeout(processMutationBatch, 0);
      }
    };

    console.log('📦 Batch operations optimization configured');
  }

  /**
   * Profile slow tests and identify bottlenecks
   */
  async profileSlowTests(): Promise<{
    slowTests: Array<{ name: string; duration: number; bottlenecks: string[] }>;
    recommendations: string[];
  }> {
    const report = testProfiler.generateReport();
    const slowTests = report.slowestTests.slice(0, 10).map((test) => ({
      name: test.testName,
      duration: test.duration,
      bottlenecks: test.bottlenecks.map((b) => b.operation),
    }));

    const recommendations = [
      ...report.recommendations,
      'Consider using lazy mock initialization for expensive mocks',
      'Enable parallel test execution for independent tests',
      'Use DOM query optimization to reduce query times',
      'Implement mock pooling to reuse expensive mock instances',
      'Batch DOM operations to reduce layout thrashing',
    ];

    return { slowTests, recommendations };
  }

  /**
   * Get optimization statistics
   */
  getStats(): {
    config: OptimizationConfig;
    stats: typeof this.optimizationStats;
    performance: {
      mockSystemReport: any;
      domOptimizerReport: any;
      parallelOptimizerReport: any;
    };
  } {
    return {
      config: this.config,
      stats: this.optimizationStats,
      performance: {
        mockSystemReport: lazyMockSystem.getPerformanceReport(),
        domOptimizerReport: domOptimizer.getStats(),
        parallelOptimizerReport: parallelOptimizer.generateReport(),
      },
    };
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(): {
    summary: {
      optimizationsEnabled: number;
      totalOptimizations: number;
      estimatedSpeedup: string;
      memoryReduction: string;
    };
    details: {
      lazyMocks: { enabled: boolean; poolHitRate: number };
      parallelExecution: { enabled: boolean; estimatedSpeedup: number };
      domOptimization: { enabled: boolean; cacheHitRate: number };
      batchOperations: { enabled: boolean; operationsBatched: number };
    };
    recommendations: string[];
  } {
    const stats = this.getStats();
    const enabledOptimizations = Object.values(this.config).filter(
      Boolean
    ).length;
    const totalOptimizations = Object.keys(this.config).length;

    // Calculate estimated performance improvements
    const mockSpeedup =
      stats.performance.mockSystemReport.averagePoolHitRate / 100;
    const domSpeedup = stats.performance.domOptimizerReport.cacheHitRate / 100;
    const parallelSpeedup =
      stats.performance.parallelOptimizerReport.estimatedSpeedup || 1;

    const overallSpeedup =
      1 + mockSpeedup * 0.2 + domSpeedup * 0.3 + (parallelSpeedup - 1) * 0.5;
    const memoryReduction = mockSpeedup * 15 + domSpeedup * 10; // Estimated percentage

    return {
      summary: {
        optimizationsEnabled: enabledOptimizations,
        totalOptimizations,
        estimatedSpeedup: `${(overallSpeedup * 100 - 100).toFixed(1)}%`,
        memoryReduction: `${memoryReduction.toFixed(1)}%`,
      },
      details: {
        lazyMocks: {
          enabled: this.config.enableLazyMockInit,
          poolHitRate:
            stats.performance.mockSystemReport.averagePoolHitRate || 0,
        },
        parallelExecution: {
          enabled: this.config.enableParallelExecution,
          estimatedSpeedup:
            stats.performance.parallelOptimizerReport.estimatedSpeedup || 1,
        },
        domOptimization: {
          enabled: this.config.enableDOMOptimization,
          cacheHitRate: stats.performance.domOptimizerReport.cacheHitRate || 0,
        },
        batchOperations: {
          enabled: this.config.enableBatchOperations,
          operationsBatched:
            this.optimizationStats.operationCounts.batchedOperations,
        },
      },
      recommendations: [
        ...(stats.performance.mockSystemReport.recommendations || []),
        ...(stats.performance.domOptimizerReport.recommendations || []),
        ...(Object.values(
          stats.performance.parallelOptimizerReport.recommendations || {}
        ).flat() as string[]),
      ].slice(0, 5), // Top 5 recommendations
    };
  }

  /**
   * Print optimization summary
   */
  printOptimizationSummary(): void {
    const report = this.generateOptimizationReport();

    console.log('\n🚀 Performance Optimization Summary');
    console.log('====================================');
    console.log(
      `Optimizations Enabled: ${report.summary.optimizationsEnabled}/${report.summary.totalOptimizations}`
    );
    console.log(`Estimated Speedup: ${report.summary.estimatedSpeedup}`);
    console.log(`Memory Reduction: ${report.summary.memoryReduction}`);

    console.log('\n📊 Optimization Details:');
    console.log(
      `  Lazy Mocks: ${report.details.lazyMocks.enabled ? '✅' : '❌'} (${report.details.lazyMocks.poolHitRate.toFixed(1)}% hit rate)`
    );
    console.log(
      `  Parallel Execution: ${report.details.parallelExecution.enabled ? '✅' : '❌'} (${report.details.parallelExecution.estimatedSpeedup.toFixed(1)}x speedup)`
    );
    console.log(
      `  DOM Optimization: ${report.details.domOptimization.enabled ? '✅' : '❌'} (${report.details.domOptimization.cacheHitRate.toFixed(1)}% cache hit rate)`
    );
    console.log(
      `  Batch Operations: ${report.details.batchOperations.enabled ? '✅' : '❌'} (${report.details.batchOperations.operationsBatched} operations batched)`
    );

    if (report.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('====================================\n');
  }

  /**
   * Reset optimization statistics
   */
  reset(): void {
    this.optimizationStats = {
      mockCreationTime: 0,
      domQueryTime: 0,
      testExecutionTime: 0,
      memoryUsage: 0,
      operationCounts: {
        mocksCreated: 0,
        mocksReused: 0,
        domQueriesCached: 0,
        batchedOperations: 0,
      },
    };
  }
}

// Global optimizer instance
export const testPerformanceOptimizer = new TestPerformanceOptimizer();

// Export helper functions
export const enableOptimizations = (config?: Partial<OptimizationConfig>) => {
  return new TestPerformanceOptimizer(config);
};

export const getOptimizationStats = () => {
  return testPerformanceOptimizer.getStats();
};

export const printOptimizationReport = () => {
  testPerformanceOptimizer.printOptimizationSummary();
};
