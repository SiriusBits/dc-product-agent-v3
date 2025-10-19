#!/usr/bin/env node

/**
 * Enhanced Optimized Test Runner
 * Runs tests with comprehensive performance monitoring, optimization, and reliability checks
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced Configuration
const config = {
  // Test execution settings
  maxRetries: process.env.CI ? 3 : 2,
  timeout: process.env.CI ? 45000 : 30000, // Longer timeout in CI
  bail: process.env.CI ? 10 : 5, // More failures allowed in CI
  
  // Performance settings
  performanceMode: process.env.PERF_MODE || 'optimized', // 'fast', 'optimized', 'thorough'
  enablePerfMonitoring: process.env.PERF_MONITORING !== 'false',
  enableOptimizations: process.env.ENABLE_OPTIMIZATIONS !== 'false',
  
  // Optimization settings
  enableLazyMocks: process.env.ENABLE_LAZY_MOCKS !== 'false',
  enableDOMOptimization: process.env.ENABLE_DOM_OPTIMIZATION !== 'false',
  enableParallelOptimization: process.env.ENABLE_PARALLEL_OPTIMIZATION !== 'false',
  
  // Reliability settings
  enableRetries: process.env.ENABLE_RETRIES !== 'false',
  parallelism: process.env.CI ? 2 : Math.max(1, Math.floor(require('os').cpus()?.length / 2) || 4),
  
  // Reporting settings
  generateReport: process.env.GENERATE_REPORT !== 'false',
  generateBenchmark: process.env.GENERATE_BENCHMARK === 'true',
  verbose: process.env.VERBOSE === 'true',
  saveBaseline: process.env.SAVE_BASELINE === 'true',
};

// Enhanced performance mode configurations
const performanceModes = {
  fast: {
    testTimeout: 10000,
    hookTimeout: 5000,
    poolOptions: { threads: { maxThreads: 2, minThreads: 1, isolate: false } },
    reporter: ['basic'],
    coverage: false,
    optimizations: {
      enableLazyMocks: true,
      enableDOMOptimization: true,
      enableParallelOptimization: false, // Disabled for speed
    },
  },
  optimized: {
    testTimeout: 30000,
    hookTimeout: 10000,
    poolOptions: { threads: { maxThreads: config.parallelism, minThreads: 1, isolate: true } },
    reporter: ['verbose', 'json'],
    coverage: false,
    optimizations: {
      enableLazyMocks: true,
      enableDOMOptimization: true,
      enableParallelOptimization: true,
    },
  },
  thorough: {
    testTimeout: 60000,
    hookTimeout: 15000,
    poolOptions: { threads: { maxThreads: Math.min(config.parallelism + 2, 8), minThreads: 2, isolate: true } },
    reporter: ['verbose', 'json', 'junit'],
    coverage: true,
    optimizations: {
      enableLazyMocks: true,
      enableDOMOptimization: true,
      enableParallelOptimization: true,
    },
  },
};

class OptimizedTestRunner {
  constructor() {
    this.startTime = Date.now();
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      slowTests: [],
      failedTests: [],
      optimizationStats: {},
      performanceMetrics: {},
    };
    this.baselineResults = this.loadBaseline();
  }

  /**
   * Load baseline performance results
   */
  loadBaseline() {
    try {
      if (existsSync('./test-performance-baseline.json')) {
        return JSON.parse(readFileSync('./test-performance-baseline.json', 'utf-8'));
      }
    } catch (error) {
      console.warn('Could not load performance baseline:', error.message);
    }
    return null;
  }

  /**
   * Generate vitest configuration based on performance mode
   */
  generateVitestConfig() {
    const modeConfig = performanceModes[config.performanceMode];
    
    const vitestConfig = {
      testTimeout: modeConfig.testTimeout,
      hookTimeout: modeConfig.hookTimeout,
      teardownTimeout: 5000,
      isolate: true,
      pool: 'threads',
      poolOptions: modeConfig.poolOptions,
      reporter: modeConfig.reporter,
      retry: config.enableRetries ? config.maxRetries : 0,
      bail: config.bail,
      coverage: {
        enabled: modeConfig.coverage,
        provider: 'v8',
        reporter: ['text', 'json'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
        ],
      },
    };

    // Write temporary config file
    const configPath = path.join(__dirname, '../vitest.optimized.config.ts');
    const configContent = `
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: ${JSON.stringify(vitestConfig, null, 2)},
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
});
`;

    writeFileSync(configPath, configContent);
    return configPath;
  }

  /**
   * Run tests with optimized configuration
   */
  async runTests(testPattern = '') {
    console.log('🚀 Starting optimized test run...');
    console.log(`Performance mode: ${config.performanceMode}`);
    console.log(`Parallelism: ${config.parallelism} threads`);
    console.log(`Retries: ${config.enableRetries ? config.maxRetries : 'disabled'}`);
    
    const configPath = this.generateVitestConfig();
    
    const args = [
      'exec',
      'vitest',
      'run',
      '--config', configPath,
      '--reporter=verbose',
    ];

    // Add test pattern if specified
    if (testPattern) {
      args.push(testPattern);
    }

    // Add comprehensive environment variables
    const modeConfig = performanceModes[config.performanceMode];
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PERF_MONITORING: config.enablePerfMonitoring ? 'true' : 'false',
      ENABLE_LAZY_MOCKS: (config.enableLazyMocks && modeConfig.optimizations.enableLazyMocks) ? 'true' : 'false',
      ENABLE_DOM_OPTIMIZATION: (config.enableDOMOptimization && modeConfig.optimizations.enableDOMOptimization) ? 'true' : 'false',
      ENABLE_PARALLEL_OPTIMIZATION: (config.enableParallelOptimization && modeConfig.optimizations.enableParallelOptimization) ? 'true' : 'false',
      GENERATE_PERF_REPORTS: config.generateReport ? 'true' : 'false',
      GENERATE_BENCHMARK: config.generateBenchmark ? 'true' : 'false',
      VITEST_POOL_SIZE: config.parallelism.toString(),
      VITEST_MAX_THREADS: modeConfig.poolOptions.threads.maxThreads.toString(),
      VITEST_MIN_THREADS: modeConfig.poolOptions.threads.minThreads.toString(),
    };

    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', args, {
        stdio: 'pipe',
        env,
        cwd: path.join(__dirname, '..'),
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (config.verbose) {
          process.stdout.write(output);
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (config.verbose) {
          process.stderr.write(output);
        }
      });

      child.on('close', (code) => {
        this.parseTestResults(stdout, stderr);
        
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test results from vitest output
   */
  parseTestResults(stdout, stderr) {
    this.testResults.duration = Date.now() - this.startTime;
    
    // Parse vitest output for test counts
    const testSummaryMatch = stdout.match(/Test Files\s+(\d+) passed.*?Tests\s+(\d+) passed(?:, (\d+) failed)?(?:, (\d+) skipped)?/);
    if (testSummaryMatch) {
      this.testResults.passed = parseInt(testSummaryMatch[2]) || 0;
      this.testResults.failed = parseInt(testSummaryMatch[3]) || 0;
      this.testResults.skipped = parseInt(testSummaryMatch[4]) || 0;
      this.testResults.total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    }

    // Parse slow tests (tests taking > 3 seconds)
    const slowTestMatches = stdout.matchAll(/(\w+.*?\.test\.tsx?)\s+\((\d+)ms\)/g);
    for (const match of slowTestMatches) {
      const duration = parseInt(match[2]);
      if (duration > 3000) {
        this.testResults.slowTests.push({
          name: match[1],
          duration,
        });
      }
    }

    // Parse failed tests
    const failedTestMatches = stdout.matchAll(/FAIL\s+(.*?\.test\.tsx?)/g);
    for (const match of failedTestMatches) {
      this.testResults.failedTests.push({
        name: match[1],
        error: 'Test failed', // Could parse more detailed error info
      });
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        performanceMode: config.performanceMode,
        parallelism: config.parallelism,
        retries: config.maxRetries,
        optimizations: {
          lazyMocks: config.enableLazyMocks,
          domOptimization: config.enableDOMOptimization,
          parallelOptimization: config.enableParallelOptimization,
        },
      },
      results: this.testResults,
      performance: {
        totalDuration: this.testResults.duration,
        averageTestDuration: this.testResults.total > 0 
          ? this.testResults.duration / this.testResults.total 
          : 0,
        slowTestCount: this.testResults.slowTests.length,
        slowTestPercentage: this.testResults.total > 0 
          ? (this.testResults.slowTests.length / this.testResults.total) * 100 
          : 0,
        passRate: this.testResults.total > 0 
          ? (this.testResults.passed / this.testResults.total) * 100 
          : 0,
      },
      baseline: this.baselineResults ? {
        comparison: this.compareWithBaseline(),
        improvement: this.calculateImprovement(),
      } : null,
      recommendations: this.generateRecommendations(),
    };

    if (config.generateReport) {
      const reportPath = path.join(__dirname, '../test-performance-report.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to ${reportPath}`);
    }

    // Save as baseline if requested
    if (config.saveBaseline) {
      const baselinePath = path.join(__dirname, '../test-performance-baseline.json');
      writeFileSync(baselinePath, JSON.stringify({
        timestamp: report.timestamp,
        results: this.testResults,
        config: report.config,
      }, null, 2));
      console.log(`📈 Baseline saved to ${baselinePath}`);
    }

    return report;
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline() {
    if (!this.baselineResults) return null;

    return {
      durationChange: this.baselineResults.results.duration > 0 
        ? ((this.testResults.duration - this.baselineResults.results.duration) / this.baselineResults.results.duration) * 100
        : 0,
      passRateChange: this.baselineResults.results.total > 0 
        ? ((this.testResults.passed / this.testResults.total) - (this.baselineResults.results.passed / this.baselineResults.results.total)) * 100
        : 0,
      slowTestChange: this.testResults.slowTests.length - (this.baselineResults.results.slowTests?.length || 0),
    };
  }

  /**
   * Calculate performance improvement
   */
  calculateImprovement() {
    if (!this.baselineResults) return null;

    const comparison = this.compareWithBaseline();
    return {
      status: comparison.durationChange < -5 ? 'improved' : 
              comparison.durationChange > 10 ? 'regressed' : 'stable',
      summary: `Duration: ${comparison.durationChange.toFixed(1)}%, Pass Rate: ${comparison.passRateChange.toFixed(1)}%`,
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.slowTests.length > 0) {
      const slowPercentage = (this.testResults.slowTests.length / this.testResults.total) * 100;
      recommendations.push(
        `${slowPercentage.toFixed(1)}% of tests are slow (>3s). Consider optimizing: ${
          this.testResults.slowTests.slice(0, 3).map(t => t.name).join(', ')
        }`
      );
    }

    if (this.testResults.failed > 0) {
      const failureRate = (this.testResults.failed / this.testResults.total) * 100;
      recommendations.push(
        `${failureRate.toFixed(1)}% test failure rate. Check for flaky tests and improve reliability.`
      );
    }

    const avgDuration = this.testResults.total > 0 
      ? this.testResults.duration / this.testResults.total 
      : 0;
    
    if (avgDuration > 2000) {
      recommendations.push(
        `Average test duration is ${avgDuration.toFixed(0)}ms. Target: <1000ms for optimal performance.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Test performance looks good!');
    }

    return recommendations;
  }

  /**
   * Print comprehensive summary
   */
  printSummary() {
    const report = this.generatePerformanceReport();
    
    console.log('\n🚀 Enhanced Test Run Summary');
    console.log('=============================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} (${report.performance.passRate.toFixed(1)}%)`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Skipped: ${this.testResults.skipped}`);
    console.log(`Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);
    console.log(`Average: ${report.performance.averageTestDuration.toFixed(0)}ms per test`);
    
    // Performance optimizations status
    console.log('\n⚡ Optimizations:');
    console.log(`  Lazy Mocks: ${config.enableLazyMocks ? '✅' : '❌'}`);
    console.log(`  DOM Optimization: ${config.enableDOMOptimization ? '✅' : '❌'}`);
    console.log(`  Parallel Execution: ${config.enableParallelOptimization ? '✅' : '❌'}`);
    console.log(`  Performance Mode: ${config.performanceMode}`);
    console.log(`  Parallelism: ${config.parallelism} threads`);

    // Baseline comparison
    if (report.baseline) {
      console.log('\n📈 Baseline Comparison:');
      console.log(`  Status: ${report.baseline.improvement.status}`);
      console.log(`  ${report.baseline.improvement.summary}`);
    }
    
    if (this.testResults.slowTests.length > 0) {
      console.log(`\n🐌 Slow Tests (${this.testResults.slowTests.length}):`);
      this.testResults.slowTests.slice(0, 5).forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.name}: ${test.duration}ms`);
      });
    }

    if (this.testResults.failedTests.length > 0) {
      console.log(`\n❌ Failed Tests (${this.testResults.failedTests.length}):`);
      this.testResults.failedTests.slice(0, 5).forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.name}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Success/failure indicators
    const passRate = report.performance.passRate;
    const avgDuration = report.performance.averageTestDuration;
    
    console.log('\n🎯 Performance Targets:');
    console.log(`  Pass Rate: ${passRate >= 95 ? '✅' : '❌'} ${passRate.toFixed(1)}% (target: ≥95%)`);
    console.log(`  Avg Duration: ${avgDuration <= 1000 ? '✅' : '❌'} ${avgDuration.toFixed(0)}ms (target: ≤1000ms)`);
    console.log(`  Total Duration: ${this.testResults.duration <= 90000 ? '✅' : '❌'} ${(this.testResults.duration / 1000).toFixed(1)}s (target: ≤90s)`);

    console.log('=============================\n');
  }
}

// Main execution
async function main() {
  const runner = new OptimizedTestRunner();
  const testPattern = process.argv[2] || '';

  try {
    await runner.runTests(testPattern);
    runner.printSummary();
    
    // Exit with error if tests failed
    if (runner.testResults.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test run failed:', error.message);
    runner.printSummary();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { OptimizedTestRunner, config };