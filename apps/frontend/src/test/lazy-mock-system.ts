/**
 * Lazy Mock System
 * Implements lazy initialization and pooling for test mocks to improve performance
 */

import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { testProfiler } from './performance-profiler';

export interface LazyMockConfig {
  enableLazyInit: boolean;
  enablePooling: boolean;
  maxPoolSize: number;
  preloadCommonMocks: boolean;
  enableMockReuse: boolean;
  trackUsage: boolean;
}

export interface MockFactory<T = any> {
  create: () => T;
  reset?: (mock: T) => void;
  validate?: (mock: T) => boolean;
  cleanup?: (mock: T) => void;
}

export interface MockPoolEntry<T = any> {
  mock: T;
  inUse: boolean;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
}

export interface MockUsageStats {
  mockName: string;
  totalCreated: number;
  totalReused: number;
  averageCreationTime: number;
  poolHitRate: number;
  memoryUsage: number;
}

const DEFAULT_LAZY_CONFIG: LazyMockConfig = {
  enableLazyInit: true,
  enablePooling: true,
  maxPoolSize: 10,
  preloadCommonMocks: true,
  enableMockReuse: true,
  trackUsage: process.env.NODE_ENV !== 'production',
};

export class LazyMockSystem {
  private config: LazyMockConfig;
  private mockFactories = new Map<string, MockFactory>();
  private mockPools = new Map<string, MockPoolEntry[]>();
  private lazyMocks = new Map<string, () => any>();
  private usageStats = new Map<string, MockUsageStats>();
  private preloadedMocks = new Set<string>();

  constructor(config: Partial<LazyMockConfig> = {}) {
    this.config = { ...DEFAULT_LAZY_CONFIG, ...config };

    if (this.config.preloadCommonMocks) {
      this.preloadCommonMocks();
    }
  }

  /**
   * Register a mock factory
   */
  registerFactory<T>(name: string, factory: MockFactory<T>): void {
    this.mockFactories.set(name, factory);

    if (this.config.trackUsage) {
      this.usageStats.set(name, {
        mockName: name,
        totalCreated: 0,
        totalReused: 0,
        averageCreationTime: 0,
        poolHitRate: 0,
        memoryUsage: 0,
      });
    }
  }

  /**
   * Create or get a mock from pool
   */
  getMock<T>(name: string): T {
    if (this.config.trackUsage) {
      testProfiler.trackOperation('mockCalls', name);
    }

    // Try to get from pool first
    if (this.config.enablePooling) {
      const pooledMock = this.getFromPool<T>(name);
      if (pooledMock) {
        this.updateUsageStats(name, 'reused');
        return pooledMock;
      }
    }

    // Create new mock
    const mock = this.createMock<T>(name);
    this.updateUsageStats(name, 'created');
    return mock;
  }

  /**
   * Return a mock to the pool
   */
  returnMock<T>(name: string, mock: T): void {
    if (!this.config.enablePooling) {
      this.cleanupMock(name, mock);
      return;
    }

    const pool = this.mockPools.get(name) || [];

    // Don't exceed pool size
    if (pool.length >= this.config.maxPoolSize) {
      this.cleanupMock(name, mock);
      return;
    }

    // Reset mock before returning to pool
    const factory = this.mockFactories.get(name);
    if (factory?.reset) {
      factory.reset(mock);
    }

    // Add to pool
    const entry: MockPoolEntry<T> = {
      mock,
      inUse: false,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    pool.push(entry);
    this.mockPools.set(name, pool);
  }

  /**
   * Create a lazy mock that's only initialized when first accessed
   */
  createLazyMock<T>(name: string, factory: () => T): () => T {
    if (!this.config.enableLazyInit) {
      return factory;
    }

    let mock: T | undefined;
    let initialized = false;

    const lazyMock = () => {
      if (!initialized) {
        const startTime = performance.now();
        testProfiler.startOperation(`lazy-init-${name}`);

        mock = factory();
        initialized = true;

        const duration = testProfiler.endOperation(`lazy-init-${name}`);
        this.updateCreationTime(name, duration);
      }

      return mock!;
    };

    this.lazyMocks.set(name, lazyMock);
    return lazyMock;
  }

  /**
   * Preload commonly used mocks
   */
  private preloadCommonMocks(): void {
    const commonMocks = [
      'useChat',
      'useProducts',
      'useConversations',
      'apiClient',
      'localStorage',
      'sessionStorage',
    ];

    commonMocks.forEach((mockName) => {
      if (this.mockFactories.has(mockName)) {
        // Create one instance and add to pool
        const mock = this.createMock(mockName);
        this.returnMock(mockName, mock);
        this.preloadedMocks.add(mockName);
      }
    });
  }

  /**
   * Get mock from pool
   */
  private getFromPool<T>(name: string): T | null {
    const pool = this.mockPools.get(name);
    if (!pool || pool.length === 0) {
      return null;
    }

    // Find available mock
    const availableEntry = pool.find((entry) => !entry.inUse);
    if (!availableEntry) {
      return null;
    }

    // Mark as in use
    availableEntry.inUse = true;
    availableEntry.lastUsed = Date.now();
    availableEntry.usageCount++;

    // Validate mock before returning
    const factory = this.mockFactories.get(name);
    if (factory?.validate && !factory.validate(availableEntry.mock)) {
      // Mock is invalid, remove from pool and create new one
      const index = pool.indexOf(availableEntry);
      pool.splice(index, 1);
      return null;
    }

    return availableEntry.mock as T;
  }

  /**
   * Create new mock instance
   */
  private createMock<T>(name: string): T {
    const factory = this.mockFactories.get(name);
    if (!factory) {
      throw new Error(`Mock factory not found: ${name}`);
    }

    const startTime = performance.now();
    testProfiler.startOperation(`create-mock-${name}`);

    const mock = factory.create();

    const duration = testProfiler.endOperation(`create-mock-${name}`);
    this.updateCreationTime(name, duration);

    return mock as T;
  }

  /**
   * Cleanup mock instance
   */
  private cleanupMock<T>(name: string, mock: T): void {
    const factory = this.mockFactories.get(name);
    if (factory?.cleanup) {
      factory.cleanup(mock);
    }
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(name: string, type: 'created' | 'reused'): void {
    if (!this.config.trackUsage) return;

    const stats = this.usageStats.get(name);
    if (!stats) return;

    if (type === 'created') {
      stats.totalCreated++;
    } else {
      stats.totalReused++;
    }

    // Update pool hit rate
    const total = stats.totalCreated + stats.totalReused;
    stats.poolHitRate = total > 0 ? (stats.totalReused / total) * 100 : 0;

    this.usageStats.set(name, stats);
  }

  /**
   * Update creation time statistics
   */
  private updateCreationTime(name: string, duration: number): void {
    if (!this.config.trackUsage) return;

    const stats = this.usageStats.get(name);
    if (!stats) return;

    // Calculate running average
    const totalOperations = stats.totalCreated + stats.totalReused;
    stats.averageCreationTime =
      (stats.averageCreationTime * (totalOperations - 1) + duration) /
      totalOperations;

    this.usageStats.set(name, stats);
  }

  /**
   * Clean up expired mocks from pools
   */
  cleanupExpiredMocks(maxAge = 60000): void {
    // 1 minute default
    const now = Date.now();

    for (const [name, pool] of this.mockPools.entries()) {
      const validEntries = pool.filter((entry) => {
        const age = now - entry.lastUsed;
        const expired = age > maxAge && !entry.inUse;

        if (expired) {
          this.cleanupMock(name, entry.mock);
        }

        return !expired;
      });

      this.mockPools.set(name, validEntries);
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): MockUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    totalMocks: number;
    pooledMocks: number;
    averageCreationTime: number;
    averagePoolHitRate: number;
    memoryUsage: number;
    recommendations: string[];
  } {
    const stats = this.getUsageStats();
    const totalMocks = stats.reduce(
      (sum, s) => sum + s.totalCreated + s.totalReused,
      0
    );
    const pooledMocks = Array.from(this.mockPools.values()).reduce(
      (sum, pool) => sum + pool.length,
      0
    );

    const averageCreationTime =
      stats.length > 0
        ? stats.reduce((sum, s) => sum + s.averageCreationTime, 0) /
          stats.length
        : 0;

    const averagePoolHitRate =
      stats.length > 0
        ? stats.reduce((sum, s) => sum + s.poolHitRate, 0) / stats.length
        : 0;

    const memoryUsage = stats.reduce((sum, s) => sum + s.memoryUsage, 0);

    const recommendations = this.generateRecommendations(stats, {
      totalMocks,
      pooledMocks,
      averageCreationTime,
      averagePoolHitRate,
    });

    return {
      totalMocks,
      pooledMocks,
      averageCreationTime,
      averagePoolHitRate,
      memoryUsage,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    stats: MockUsageStats[],
    summary: {
      totalMocks: number;
      pooledMocks: number;
      averageCreationTime: number;
      averagePoolHitRate: number;
    }
  ): string[] {
    const recommendations: string[] = [];

    // Check creation time
    if (summary.averageCreationTime > 50) {
      recommendations.push(
        `Average mock creation time is ${summary.averageCreationTime.toFixed(1)}ms. Consider optimizing mock factories.`
      );
    }

    // Check pool hit rate
    if (summary.averagePoolHitRate < 50 && this.config.enablePooling) {
      recommendations.push(
        `Pool hit rate is ${summary.averagePoolHitRate.toFixed(1)}%. Consider increasing pool size or improving mock reuse.`
      );
    }

    // Check for expensive mocks
    const expensiveMocks = stats.filter((s) => s.averageCreationTime > 100);
    if (expensiveMocks.length > 0) {
      recommendations.push(
        `${expensiveMocks.length} mocks have high creation time. Focus on optimizing: ${expensiveMocks.map((m) => m.mockName).join(', ')}`
      );
    }

    // Check for underutilized pools
    const underutilizedMocks = stats.filter(
      (s) => s.poolHitRate < 25 && s.totalCreated > 5
    );
    if (underutilizedMocks.length > 0) {
      recommendations.push(
        `${underutilizedMocks.length} mocks have low pool utilization. Consider disabling pooling for: ${underutilizedMocks.map((m) => m.mockName).join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Mock system performance looks good!');
    }

    return recommendations;
  }

  /**
   * Reset all mocks and pools
   */
  reset(): void {
    // Cleanup all pooled mocks
    for (const [name, pool] of this.mockPools.entries()) {
      pool.forEach((entry) => this.cleanupMock(name, entry.mock));
    }

    this.mockPools.clear();
    this.lazyMocks.clear();
    this.preloadedMocks.clear();

    // Reset usage stats
    for (const [name, stats] of this.usageStats.entries()) {
      stats.totalCreated = 0;
      stats.totalReused = 0;
      stats.averageCreationTime = 0;
      stats.poolHitRate = 0;
      stats.memoryUsage = 0;
    }

    // Preload common mocks again if enabled
    if (this.config.preloadCommonMocks) {
      this.preloadCommonMocks();
    }
  }

  /**
   * Destroy the mock system
   */
  destroy(): void {
    this.reset();
    this.mockFactories.clear();
    this.usageStats.clear();
  }
}

// Global lazy mock system
export const lazyMockSystem = new LazyMockSystem();

// Common mock factories
export const commonMockFactories = {
  useChat: {
    create: () => ({
      messages: [],
      isLoading: false,
      error: null,
      conversationId: null,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversation: vi.fn(),
      retryLastMessage: vi.fn(),
      isRetryable: false,
    }),
    reset: (mock: any) => {
      mock.messages = [];
      mock.isLoading = false;
      mock.error = null;
      mock.conversationId = null;
      mock.sendMessage.mockClear();
      mock.clearMessages.mockClear();
      mock.loadConversation.mockClear();
      mock.retryLastMessage.mockClear();
      mock.isRetryable = false;
    },
    validate: (mock: any) => {
      return mock && typeof mock.sendMessage === 'function';
    },
  },

  useProducts: {
    create: () => ({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: null,
      searchProducts: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      retry: vi.fn(),
      isRetryable: false,
    }),
    reset: (mock: any) => {
      mock.products = [];
      mock.totalCount = 0;
      mock.facets = null;
      mock.loading = false;
      mock.error = null;
      mock.searchProducts.mockClear();
      mock.loadMore.mockClear();
      mock.hasMore = false;
      mock.retry.mockClear();
      mock.isRetryable = false;
    },
    validate: (mock: any) => {
      return mock && typeof mock.searchProducts === 'function';
    },
  },

  useConversations: {
    create: () => ({
      conversations: [],
      isLoading: false,
      error: null,
      loadConversations: vi.fn(),
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      updateConversationTitle: vi.fn(),
      retry: vi.fn(),
      isRetryable: false,
    }),
    reset: (mock: any) => {
      mock.conversations = [];
      mock.isLoading = false;
      mock.error = null;
      mock.loadConversations.mockClear();
      mock.createConversation.mockClear();
      mock.deleteConversation.mockClear();
      mock.updateConversationTitle.mockClear();
      mock.retry.mockClear();
      mock.isRetryable = false;
    },
    validate: (mock: any) => {
      return mock && typeof mock.loadConversations === 'function';
    },
  },
};

// Register common factories
Object.entries(commonMockFactories).forEach(([name, factory]) => {
  lazyMockSystem.registerFactory(name, factory);
});

// Helper functions
export const createLazyMock = <T>(name: string, factory: () => T) =>
  lazyMockSystem.createLazyMock(name, factory);

export const getMock = <T>(name: string): T => lazyMockSystem.getMock<T>(name);

export const returnMock = <T>(name: string, mock: T) =>
  lazyMockSystem.returnMock(name, mock);

// Performance monitoring helpers
export const withMockProfiling = <T extends (...args: any[]) => any>(
  mockName: string,
  mockFn: T
): T => {
  return ((...args: any[]) => {
    testProfiler.trackOperation('mockCalls', mockName);
    return mockFn(...args);
  }) as T;
};
