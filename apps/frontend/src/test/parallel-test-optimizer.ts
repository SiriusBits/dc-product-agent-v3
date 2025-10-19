/**
 * Parallel Test Execution Optimizer
 * Optimizes test execution by enabling safe parallel execution and managing test isolation
 */

import { vi } from 'vitest';
import { testProfiler } from './performance-profiler';

export interface ParallelConfig {
  enableParallel: boolean;
  maxConcurrency: number;
  isolationLevel: 'none' | 'basic' | 'strict';
  sharedResourceManagement: boolean;
  enableTestBatching: boolean;
  batchSize: number;
  enableSmartScheduling: boolean;
}

export interface TestMetadata {
  name: string;
  estimatedDuration: number;
  dependencies: string[];
  resourceUsage: {
    memory: 'low' | 'medium' | 'high';
    cpu: 'low' | 'medium' | 'high';
    io: 'low' | 'medium' | 'high';
  };
  isolationRequirements: {
    requiresCleanDOM: boolean;
    requiresCleanMocks: boolean;
    requiresCleanStorage: boolean;
    requiresCleanTimers: boolean;
  };
  tags: string[];
}

export interface TestBatch {
  id: string;
  tests: TestMetadata[];
  estimatedDuration: number;
  maxConcurrency: number;
  isolationLevel: 'none' | 'basic' | 'strict';
}

export interface SharedResource {
  name: string;
  type: 'dom' | 'storage' | 'network' | 'timer' | 'mock';
  maxConcurrentUsers: number;
  currentUsers: Set<string>;
  cleanup: () => void;
}

const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  enableParallel: true,
  maxConcurrency: Math.max(
    1,
    Math.floor((require('os').cpus()?.length || 4) / 2)
  ),
  isolationLevel: 'basic',
  sharedResourceManagement: true,
  enableTestBatching: true,
  batchSize: 10,
  enableSmartScheduling: true,
};

export class ParallelTestOptimizer {
  private config: ParallelConfig;
  private testMetadata = new Map<string, TestMetadata>();
  private sharedResources = new Map<string, SharedResource>();
  private runningTests = new Set<string>();
  private testBatches: TestBatch[] = [];
  private executionHistory = new Map<string, number[]>(); // Test name -> duration history

  constructor(config: Partial<ParallelConfig> = {}) {
    this.config = { ...DEFAULT_PARALLEL_CONFIG, ...config };
    this.initializeSharedResources();
  }

  /**
   * Register test metadata for optimization
   */
  registerTest(metadata: TestMetadata): void {
    this.testMetadata.set(metadata.name, metadata);

    // Update estimated duration based on history
    const history = this.executionHistory.get(metadata.name);
    if (history && history.length > 0) {
      metadata.estimatedDuration = this.calculateAverageDuration(history);
    }
  }

  /**
   * Create optimized test batches
   */
  createTestBatches(testNames: string[]): TestBatch[] {
    if (!this.config.enableTestBatching) {
      // Create single batch with all tests
      return [
        {
          id: 'single-batch',
          tests: testNames
            .map((name) => this.testMetadata.get(name)!)
            .filter(Boolean),
          estimatedDuration: 0,
          maxConcurrency: this.config.maxConcurrency,
          isolationLevel: this.config.isolationLevel,
        },
      ];
    }

    const tests = testNames
      .map((name) => this.testMetadata.get(name))
      .filter((test): test is TestMetadata => test !== undefined);

    if (this.config.enableSmartScheduling) {
      return this.createSmartBatches(tests);
    } else {
      return this.createSimpleBatches(tests);
    }
  }

  /**
   * Create smart batches based on test characteristics
   */
  private createSmartBatches(tests: TestMetadata[]): TestBatch[] {
    const batches: TestBatch[] = [];

    // Group tests by resource requirements and isolation needs
    const testGroups = this.groupTestsByCharacteristics(tests);

    for (const [groupKey, groupTests] of testGroups.entries()) {
      const chunks = this.chunkTests(groupTests, this.config.batchSize);

      chunks.forEach((chunk, index) => {
        const batch: TestBatch = {
          id: `${groupKey}-batch-${index}`,
          tests: chunk,
          estimatedDuration: chunk.reduce(
            (sum, test) => sum + test.estimatedDuration,
            0
          ),
          maxConcurrency: this.calculateOptimalConcurrency(chunk),
          isolationLevel: this.determineIsolationLevel(chunk),
        };

        batches.push(batch);
      });
    }

    // Sort batches by estimated duration (longest first for better parallelization)
    return batches.sort((a, b) => b.estimatedDuration - a.estimatedDuration);
  }

  /**
   * Create simple batches without smart scheduling
   */
  private createSimpleBatches(tests: TestMetadata[]): TestBatch[] {
    const chunks = this.chunkTests(tests, this.config.batchSize);

    return chunks.map((chunk, index) => ({
      id: `batch-${index}`,
      tests: chunk,
      estimatedDuration: chunk.reduce(
        (sum, test) => sum + test.estimatedDuration,
        0
      ),
      maxConcurrency: this.config.maxConcurrency,
      isolationLevel: this.config.isolationLevel,
    }));
  }

  /**
   * Group tests by their characteristics for optimal batching
   */
  private groupTestsByCharacteristics(
    tests: TestMetadata[]
  ): Map<string, TestMetadata[]> {
    const groups = new Map<string, TestMetadata[]>();

    tests.forEach((test) => {
      // Create a key based on test characteristics
      const key = [
        test.resourceUsage.memory,
        test.resourceUsage.cpu,
        test.resourceUsage.io,
        test.isolationRequirements.requiresCleanDOM ? 'clean-dom' : '',
        test.isolationRequirements.requiresCleanMocks ? 'clean-mocks' : '',
        test.isolationRequirements.requiresCleanStorage ? 'clean-storage' : '',
        test.isolationRequirements.requiresCleanTimers ? 'clean-timers' : '',
        ...test.tags,
      ]
        .filter(Boolean)
        .join('-');

      const group = groups.get(key) || [];
      group.push(test);
      groups.set(key, group);
    });

    return groups;
  }

  /**
   * Calculate optimal concurrency for a batch of tests
   */
  private calculateOptimalConcurrency(tests: TestMetadata[]): number {
    // Start with configured max concurrency
    let concurrency = this.config.maxConcurrency;

    // Reduce concurrency for high-resource tests
    const highResourceTests = tests.filter(
      (test) =>
        test.resourceUsage.memory === 'high' ||
        test.resourceUsage.cpu === 'high' ||
        test.resourceUsage.io === 'high'
    );

    if (highResourceTests.length > 0) {
      const resourceFactor = highResourceTests.length / tests.length;
      concurrency = Math.max(
        1,
        Math.floor(concurrency * (1 - resourceFactor * 0.5))
      );
    }

    // Reduce concurrency for tests with strict isolation requirements
    const strictIsolationTests = tests.filter(
      (test) =>
        test.isolationRequirements.requiresCleanDOM ||
        test.isolationRequirements.requiresCleanMocks ||
        test.isolationRequirements.requiresCleanStorage ||
        test.isolationRequirements.requiresCleanTimers
    );

    if (strictIsolationTests.length > 0) {
      const isolationFactor = strictIsolationTests.length / tests.length;
      concurrency = Math.max(
        1,
        Math.floor(concurrency * (1 - isolationFactor * 0.3))
      );
    }

    return concurrency;
  }

  /**
   * Determine isolation level for a batch of tests
   */
  private determineIsolationLevel(
    tests: TestMetadata[]
  ): 'none' | 'basic' | 'strict' {
    const hasStrictRequirements = tests.some(
      (test) =>
        test.isolationRequirements.requiresCleanDOM ||
        test.isolationRequirements.requiresCleanMocks ||
        test.isolationRequirements.requiresCleanStorage ||
        test.isolationRequirements.requiresCleanTimers
    );

    if (hasStrictRequirements) {
      return 'strict';
    }

    const hasBasicRequirements = tests.some((test) =>
      Object.values(test.isolationRequirements).some(Boolean)
    );

    return hasBasicRequirements ? 'basic' : 'none';
  }

  /**
   * Chunk tests into smaller groups
   */
  private chunkTests<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Calculate average duration from history
   */
  private calculateAverageDuration(durations: number[]): number {
    if (durations.length === 0) return 1000; // Default 1 second

    // Use weighted average, giving more weight to recent executions
    const weights = durations.map((_, index) =>
      Math.pow(0.9, durations.length - index - 1)
    );
    const weightedSum = durations.reduce(
      (sum, duration, index) => sum + duration * weights[index],
      0
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return weightedSum / totalWeight;
  }

  /**
   * Initialize shared resources
   */
  private initializeSharedResources(): void {
    if (!this.config.sharedResourceManagement) return;

    const resources: Array<Omit<SharedResource, 'currentUsers'>> = [
      {
        name: 'dom',
        type: 'dom',
        maxConcurrentUsers: 4, // DOM operations can be somewhat parallel
        cleanup: () => {
          // Clean up DOM
          document.body.innerHTML = '';
          document.head
            .querySelectorAll('style, link[rel="stylesheet"]')
            .forEach((el) => el.remove());
        },
      },
      {
        name: 'localStorage',
        type: 'storage',
        maxConcurrentUsers: 2, // Storage operations should be limited
        cleanup: () => {
          if (typeof localStorage !== 'undefined') {
            localStorage.clear();
          }
        },
      },
      {
        name: 'sessionStorage',
        type: 'storage',
        maxConcurrentUsers: 2,
        cleanup: () => {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
          }
        },
      },
      {
        name: 'timers',
        type: 'timer',
        maxConcurrentUsers: 6, // Timers can be more parallel
        cleanup: () => {
          vi.clearAllTimers();
        },
      },
      {
        name: 'mocks',
        type: 'mock',
        maxConcurrentUsers: 8, // Mocks can be quite parallel
        cleanup: () => {
          vi.clearAllMocks();
        },
      },
    ];

    resources.forEach((resource) => {
      this.sharedResources.set(resource.name, {
        ...resource,
        currentUsers: new Set(),
      });
    });
  }

  /**
   * Acquire shared resource for test
   */
  async acquireResource(
    resourceName: string,
    testName: string
  ): Promise<boolean> {
    if (!this.config.sharedResourceManagement) return true;

    const resource = this.sharedResources.get(resourceName);
    if (!resource) return true;

    // Check if resource is available
    if (resource.currentUsers.size >= resource.maxConcurrentUsers) {
      return false; // Resource not available
    }

    resource.currentUsers.add(testName);
    testProfiler.trackOperation('asyncOperations', `acquire-${resourceName}`);
    return true;
  }

  /**
   * Release shared resource
   */
  releaseResource(resourceName: string, testName: string): void {
    if (!this.config.sharedResourceManagement) return;

    const resource = this.sharedResources.get(resourceName);
    if (!resource) return;

    resource.currentUsers.delete(testName);
    testProfiler.trackOperation('asyncOperations', `release-${resourceName}`);

    // Clean up resource if no more users
    if (resource.currentUsers.size === 0) {
      resource.cleanup();
    }
  }

  /**
   * Record test execution time for future optimization
   */
  recordTestExecution(testName: string, duration: number): void {
    const history = this.executionHistory.get(testName) || [];
    history.push(duration);

    // Keep only last 10 executions
    if (history.length > 10) {
      history.shift();
    }

    this.executionHistory.set(testName, history);

    // Update test metadata if it exists
    const metadata = this.testMetadata.get(testName);
    if (metadata) {
      metadata.estimatedDuration = this.calculateAverageDuration(history);
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): {
    parallelization: string[];
    batching: string[];
    isolation: string[];
    resources: string[];
  } {
    const recommendations = {
      parallelization: [] as string[],
      batching: [] as string[],
      isolation: [] as string[],
      resources: [] as string[],
    };

    // Analyze test metadata for recommendations
    const tests = Array.from(this.testMetadata.values());

    // Parallelization recommendations
    const slowTests = tests.filter((test) => test.estimatedDuration > 5000);
    if (slowTests.length > 0) {
      recommendations.parallelization.push(
        `${slowTests.length} slow tests detected. Consider breaking them into smaller, parallel tests.`
      );
    }

    const highResourceTests = tests.filter(
      (test) =>
        test.resourceUsage.memory === 'high' ||
        test.resourceUsage.cpu === 'high'
    );
    if (highResourceTests.length > 0) {
      recommendations.parallelization.push(
        `${highResourceTests.length} high-resource tests may benefit from reduced concurrency.`
      );
    }

    // Batching recommendations
    if (tests.length > 50 && !this.config.enableTestBatching) {
      recommendations.batching.push(
        'Consider enabling test batching for better organization and performance.'
      );
    }

    // Isolation recommendations
    const strictIsolationTests = tests.filter((test) =>
      Object.values(test.isolationRequirements).some(Boolean)
    );
    if (strictIsolationTests.length > tests.length * 0.5) {
      recommendations.isolation.push(
        'Many tests require strict isolation. Consider optimizing test setup/teardown.'
      );
    }

    // Resource recommendations
    const resourceUsage = this.analyzeResourceUsage();
    if (resourceUsage.domContention > 0.3) {
      recommendations.resources.push(
        'High DOM resource contention detected. Consider reducing DOM operations in tests.'
      );
    }

    return recommendations;
  }

  /**
   * Analyze resource usage patterns
   */
  private analyzeResourceUsage(): {
    domContention: number;
    storageContention: number;
    mockContention: number;
    timerContention: number;
  } {
    const tests = Array.from(this.testMetadata.values());
    const totalTests = tests.length;

    if (totalTests === 0) {
      return {
        domContention: 0,
        storageContention: 0,
        mockContention: 0,
        timerContention: 0,
      };
    }

    const domTests = tests.filter(
      (test) => test.isolationRequirements.requiresCleanDOM
    ).length;
    const storageTests = tests.filter(
      (test) => test.isolationRequirements.requiresCleanStorage
    ).length;
    const mockTests = tests.filter(
      (test) => test.isolationRequirements.requiresCleanMocks
    ).length;
    const timerTests = tests.filter(
      (test) => test.isolationRequirements.requiresCleanTimers
    ).length;

    return {
      domContention: domTests / totalTests,
      storageContention: storageTests / totalTests,
      mockContention: mockTests / totalTests,
      timerContention: timerTests / totalTests,
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    config: ParallelConfig;
    testCount: number;
    batchCount: number;
    averageBatchSize: number;
    estimatedSpeedup: number;
    resourceUtilization: Record<string, number>;
    recommendations: ReturnType<typeof this.getOptimizationRecommendations>;
  } {
    const testCount = this.testMetadata.size;
    const batchCount = this.testBatches.length;
    const averageBatchSize = batchCount > 0 ? testCount / batchCount : 0;

    // Estimate speedup from parallelization
    const sequentialTime = Array.from(this.testMetadata.values()).reduce(
      (sum, test) => sum + test.estimatedDuration,
      0
    );
    const parallelTime = Math.max(
      ...this.testBatches.map((batch) => batch.estimatedDuration)
    );
    const estimatedSpeedup =
      sequentialTime > 0 ? sequentialTime / parallelTime : 1;

    // Calculate resource utilization
    const resourceUtilization: Record<string, number> = {};
    for (const [name, resource] of this.sharedResources.entries()) {
      resourceUtilization[name] =
        resource.currentUsers.size / resource.maxConcurrentUsers;
    }

    return {
      config: this.config,
      testCount,
      batchCount,
      averageBatchSize,
      estimatedSpeedup,
      resourceUtilization,
      recommendations: this.getOptimizationRecommendations(),
    };
  }

  /**
   * Reset optimizer state
   */
  reset(): void {
    this.runningTests.clear();
    this.testBatches = [];

    // Clear shared resource users
    for (const resource of this.sharedResources.values()) {
      resource.currentUsers.clear();
      resource.cleanup();
    }
  }
}

// Global parallel optimizer
export const parallelOptimizer = new ParallelTestOptimizer();

// Helper functions for test registration
export const registerTestMetadata = (metadata: TestMetadata) => {
  parallelOptimizer.registerTest(metadata);
};

export const createOptimizedBatches = (testNames: string[]) => {
  return parallelOptimizer.createTestBatches(testNames);
};

export const recordTestDuration = (testName: string, duration: number) => {
  parallelOptimizer.recordTestExecution(testName, duration);
};

// Resource management helpers
export const withResourceManagement = async <T>(
  testName: string,
  resources: string[],
  testFn: () => Promise<T>
): Promise<T> => {
  // Acquire resources
  const acquiredResources: string[] = [];

  for (const resource of resources) {
    const acquired = await parallelOptimizer.acquireResource(
      resource,
      testName
    );
    if (acquired) {
      acquiredResources.push(resource);
    } else {
      // Release already acquired resources and wait
      acquiredResources.forEach((r) =>
        parallelOptimizer.releaseResource(r, testName)
      );
      throw new Error(`Could not acquire resource: ${resource}`);
    }
  }

  try {
    return await testFn();
  } finally {
    // Release all acquired resources
    acquiredResources.forEach((resource) =>
      parallelOptimizer.releaseResource(resource, testName)
    );
  }
};
