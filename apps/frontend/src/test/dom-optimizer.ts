/**
 * DOM Operation Optimizer
 * Reduces unnecessary DOM operations in tests for better performance
 */

import { screen, within, queries } from '@testing-library/react';
import type { BoundFunctions } from '@testing-library/react';
import { testProfiler, performanceUtils } from './performance-profiler';

export interface DOMOptimizerConfig {
  enableCaching: boolean;
  enableBatching: boolean;
  enableSmartQueries: boolean;
  cacheTimeout: number;
  maxCacheSize: number;
  enableQueryOptimization: boolean;
  trackDOMOperations: boolean;
}

export interface CachedQuery {
  selector: string;
  element: HTMLElement | null;
  timestamp: number;
  hitCount: number;
}

export interface QueryStats {
  selector: string;
  callCount: number;
  totalTime: number;
  averageTime: number;
  cacheHitRate: number;
  lastUsed: number;
}

const DEFAULT_DOM_CONFIG: DOMOptimizerConfig = {
  enableCaching: true,
  enableBatching: true,
  enableSmartQueries: true,
  cacheTimeout: 5000, // 5 seconds
  maxCacheSize: 100,
  enableQueryOptimization: true,
  trackDOMOperations: process.env.NODE_ENV !== 'production',
};

export class DOMOptimizer {
  private config: DOMOptimizerConfig;
  private queryCache = new Map<string, CachedQuery>();
  private queryStats = new Map<string, QueryStats>();
  private batchedOperations: Array<() => void> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private lastDOMSnapshot: string = '';
  private domChangeDetected = false;

  constructor(config: Partial<DOMOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_DOM_CONFIG, ...config };
    this.setupDOMChangeDetection();
  }

  /**
   * Optimized getByTestId with caching
   */
  getByTestId = (testId: string, container?: HTMLElement): HTMLElement => {
    return this.optimizedQuery('getByTestId', testId, () => {
      const element = container
        ? within(container).getByTestId(testId)
        : screen.getByTestId(testId);
      return element;
    });
  };

  /**
   * Optimized queryByTestId with caching
   */
  queryByTestId = (
    testId: string,
    container?: HTMLElement
  ): HTMLElement | null => {
    return this.optimizedQuery('queryByTestId', testId, () => {
      const element = container
        ? within(container).queryByTestId(testId)
        : screen.queryByTestId(testId);
      return element;
    });
  };

  /**
   * Optimized getByText with caching
   */
  getByText = (text: string | RegExp, container?: HTMLElement): HTMLElement => {
    const textKey = typeof text === 'string' ? text : text.toString();
    return this.optimizedQuery('getByText', textKey, () => {
      const element = container
        ? within(container).getByText(text)
        : screen.getByText(text);
      return element;
    });
  };

  /**
   * Optimized queryByText with caching
   */
  queryByText = (
    text: string | RegExp,
    container?: HTMLElement
  ): HTMLElement | null => {
    const textKey = typeof text === 'string' ? text : text.toString();
    return this.optimizedQuery('queryByText', textKey, () => {
      const element = container
        ? within(container).queryByText(text)
        : screen.queryByText(text);
      return element;
    });
  };

  /**
   * Optimized getByRole with caching
   */
  getByRole = (
    role: string,
    options?: any,
    container?: HTMLElement
  ): HTMLElement => {
    const roleKey = `${role}-${JSON.stringify(options || {})}`;
    return this.optimizedQuery('getByRole', roleKey, () => {
      const element = container
        ? within(container).getByRole(role as any, options)
        : screen.getByRole(role as any, options);
      return element;
    });
  };

  /**
   * Optimized queryByRole with caching
   */
  queryByRole = (
    role: string,
    options?: any,
    container?: HTMLElement
  ): HTMLElement | null => {
    const roleKey = `${role}-${JSON.stringify(options || {})}`;
    return this.optimizedQuery('queryByRole', roleKey, () => {
      const element = container
        ? within(container).queryByRole(role as any, options)
        : screen.queryByRole(role as any, options);
      return element;
    });
  };

  /**
   * Batch multiple DOM queries for better performance
   */
  batchQueries = <T>(queries: Array<() => T>): T[] => {
    if (!this.config.enableBatching) {
      return queries.map((query) => query());
    }

    const startTime = performance.now();
    performanceUtils.trackDOMOperation('batch-queries');

    const results = queries.map((query) => query());

    const duration = performance.now() - startTime;
    if (this.config.trackDOMOperations && duration > 50) {
      console.warn(
        `Slow batch query operation: ${duration.toFixed(1)}ms for ${queries.length} queries`
      );
    }

    return results;
  };

  /**
   * Smart query that chooses the most efficient selector
   */
  smartQuery = (
    selectors: Array<{ type: string; value: string; priority: number }>,
    container?: HTMLElement
  ): HTMLElement | null => {
    if (!this.config.enableSmartQueries) {
      // Use first selector as fallback
      const first = selectors[0];
      return this.executeQuery(first.type, first.value, container);
    }

    // Sort by priority and try each selector
    const sortedSelectors = selectors.sort((a, b) => b.priority - a.priority);

    for (const selector of sortedSelectors) {
      try {
        const element = this.executeQuery(
          selector.type,
          selector.value,
          container
        );
        if (element) {
          return element;
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    return null;
  };

  /**
   * Execute a specific query type
   */
  private executeQuery = (
    type: string,
    value: string,
    container?: HTMLElement
  ): HTMLElement | null => {
    const baseQueries = container ? within(container) : screen;

    switch (type) {
      case 'testId':
        return baseQueries.queryByTestId(value);
      case 'text':
        return baseQueries.queryByText(value);
      case 'role':
        return baseQueries.queryByRole(value as any);
      case 'placeholder':
        return baseQueries.queryByPlaceholderText(value);
      case 'label':
        return baseQueries.queryByLabelText(value);
      case 'alt':
        return baseQueries.queryByAltText(value);
      case 'title':
        return baseQueries.queryByTitle(value);
      default:
        return null;
    }
  };

  /**
   * Core optimized query function
   */
  private optimizedQuery = <T extends HTMLElement | null>(
    queryType: string,
    selector: string,
    queryFn: () => T
  ): T => {
    const cacheKey = `${queryType}:${selector}`;

    if (this.config.trackDOMOperations) {
      performanceUtils.trackDOMOperation(queryType);
    }

    // Check cache first
    if (this.config.enableCaching && !this.domChangeDetected) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        this.updateQueryStats(cacheKey, 0, true);
        cached.hitCount++;
        return cached.element as T;
      }
    }

    // Execute query
    const startTime = performance.now();
    const element = queryFn();
    const duration = performance.now() - startTime;

    // Update cache
    if (this.config.enableCaching) {
      this.updateCache(cacheKey, element, duration);
    }

    // Update stats
    this.updateQueryStats(cacheKey, duration, false);

    // Warn about slow queries
    if (this.config.trackDOMOperations && duration > 100) {
      console.warn(
        `Slow DOM query: ${queryType}(${selector}) took ${duration.toFixed(1)}ms`
      );
    }

    return element;
  };

  /**
   * Update query cache
   */
  private updateCache = (
    cacheKey: string,
    element: HTMLElement | null,
    duration: number
  ): void => {
    // Don't cache if query was too slow (might be inefficient)
    if (duration > 200) {
      return;
    }

    // Clean up old cache entries if needed
    if (this.queryCache.size >= this.config.maxCacheSize) {
      this.cleanupCache();
    }

    this.queryCache.set(cacheKey, {
      selector: cacheKey,
      element,
      timestamp: Date.now(),
      hitCount: 0,
    });
  };

  /**
   * Check if cache entry is valid
   */
  private isCacheValid = (cached: CachedQuery): boolean => {
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTimeout) {
      return false;
    }

    // Check if element is still in DOM
    if (cached.element && !document.contains(cached.element)) {
      return false;
    }

    return true;
  };

  /**
   * Clean up old cache entries
   */
  private cleanupCache = (): void => {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, cached] of this.queryCache.entries()) {
      if (!this.isCacheValid(cached)) {
        entriesToDelete.push(key);
      }
    }

    // Remove invalid entries
    entriesToDelete.forEach((key) => this.queryCache.delete(key));

    // If still too many entries, remove least recently used
    if (this.queryCache.size >= this.config.maxCacheSize) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(
        0,
        Math.floor(this.config.maxCacheSize * 0.3)
      );
      toRemove.forEach(([key]) => this.queryCache.delete(key));
    }
  };

  /**
   * Update query statistics
   */
  private updateQueryStats = (
    selector: string,
    duration: number,
    cacheHit: boolean
  ): void => {
    if (!this.config.trackDOMOperations) return;

    const stats = this.queryStats.get(selector) || {
      selector,
      callCount: 0,
      totalTime: 0,
      averageTime: 0,
      cacheHitRate: 0,
      lastUsed: 0,
    };

    stats.callCount++;
    stats.totalTime += duration;
    stats.averageTime = stats.totalTime / stats.callCount;
    stats.lastUsed = Date.now();

    // Update cache hit rate
    const cached = this.queryCache.get(selector);
    if (cached) {
      stats.cacheHitRate = (cached.hitCount / stats.callCount) * 100;
    }

    this.queryStats.set(selector, stats);
  };

  /**
   * Setup DOM change detection
   */
  private setupDOMChangeDetection = (): void => {
    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      this.domChangeDetected = true;

      // Reset flag after a short delay
      setTimeout(() => {
        this.domChangeDetected = false;
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: true,
      characterDataOldValue: false,
    });
  };

  /**
   * Get performance statistics
   */
  getStats = (): {
    cacheSize: number;
    cacheHitRate: number;
    slowQueries: QueryStats[];
    mostUsedQueries: QueryStats[];
    recommendations: string[];
  } => {
    const stats = Array.from(this.queryStats.values());
    const totalQueries = stats.reduce((sum, s) => sum + s.callCount, 0);
    const totalCacheHits = Array.from(this.queryCache.values()).reduce(
      (sum, c) => sum + c.hitCount,
      0
    );

    const cacheHitRate =
      totalQueries > 0 ? (totalCacheHits / totalQueries) * 100 : 0;

    const slowQueries = stats
      .filter((s) => s.averageTime > 50)
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);

    const mostUsedQueries = stats
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 5);

    const recommendations = this.generateRecommendations(stats, cacheHitRate);

    return {
      cacheSize: this.queryCache.size,
      cacheHitRate,
      slowQueries,
      mostUsedQueries,
      recommendations,
    };
  };

  /**
   * Generate performance recommendations
   */
  private generateRecommendations = (
    stats: QueryStats[],
    cacheHitRate: number
  ): string[] => {
    const recommendations: string[] = [];

    // Cache hit rate recommendations
    if (cacheHitRate < 30 && this.config.enableCaching) {
      recommendations.push(
        `Cache hit rate is ${cacheHitRate.toFixed(1)}%. Consider optimizing query patterns or increasing cache timeout.`
      );
    }

    // Slow query recommendations
    const slowQueries = stats.filter((s) => s.averageTime > 100);
    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} slow queries detected. Consider using more specific selectors or data-testid attributes.`
      );
    }

    // Frequent query recommendations
    const frequentQueries = stats.filter((s) => s.callCount > 20);
    if (frequentQueries.length > 0) {
      recommendations.push(
        `${frequentQueries.length} frequently used queries detected. Consider caching elements or reducing query frequency.`
      );
    }

    // Query optimization recommendations
    const textQueries = stats.filter((s) => s.selector.includes('getByText'));
    if (textQueries.length > stats.length * 0.5) {
      recommendations.push(
        'Many text-based queries detected. Consider using data-testid for better performance and reliability.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ DOM query performance looks good!');
    }

    return recommendations;
  };

  /**
   * Clear all caches and stats
   */
  clear = (): void => {
    this.queryCache.clear();
    this.queryStats.clear();
    this.batchedOperations = [];
    this.domChangeDetected = false;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  };

  /**
   * Preload common queries for better performance
   */
  preloadQueries = (queries: Array<{ type: string; value: string }>): void => {
    queries.forEach((query) => {
      try {
        this.executeQuery(query.type, query.value);
      } catch (error) {
        // Ignore errors during preloading
      }
    });
  };
}

// Global DOM optimizer instance
export const domOptimizer = new DOMOptimizer();

// Export optimized query functions
export const optimizedScreen = {
  getByTestId: domOptimizer.getByTestId,
  queryByTestId: domOptimizer.queryByTestId,
  getByText: domOptimizer.getByText,
  queryByText: domOptimizer.queryByText,
  getByRole: domOptimizer.getByRole,
  queryByRole: domOptimizer.queryByRole,
  batchQueries: domOptimizer.batchQueries,
  smartQuery: domOptimizer.smartQuery,
};

// Helper functions
export const withDOMOptimization = <T>(
  testFn: () => T,
  preloadQueries?: Array<{ type: string; value: string }>
): T => {
  if (preloadQueries) {
    domOptimizer.preloadQueries(preloadQueries);
  }

  try {
    return testFn();
  } finally {
    // Don't clear cache immediately, let it expire naturally
  }
};

export const measureDOMOperation = async <T>(
  operationName: string,
  operation: () => T | Promise<T>
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  performanceUtils.trackDOMOperation(operationName);

  try {
    const result = await Promise.resolve(operation());
    const duration = performance.now() - startTime;
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.warn(
      `DOM operation ${operationName} failed after ${duration.toFixed(1)}ms:`,
      error
    );
    throw error;
  }
};
