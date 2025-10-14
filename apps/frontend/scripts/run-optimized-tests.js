#!/usr/bin/env node

/**
 * Optimized Test Runner
 * Runs tests with performance monitoring and reliability checks
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  // Test execution settings
  maxRetries: 2,
  timeout: 30000, // 30 seconds per test
  bail: process.env.CI ? 5 : 0, // Bail after 5 failures in CI
  
  // Performance settings
  performanceMode: process.env.PERF_MODE || 'optimized', // 'fast', 'optimized', 'thorough'
  enablePerfMonitoring: process.env.PERF_MONITORING !== 'false',
  
  // Reliability settings
  enableRetries: process.env.ENABLE_RETRIES !== 'false',
  parallelism: process.env.CI ? 2 : 4, // Lower parallelism in CI
  
  // Reporting settings
  generateReport: process.env.GENERATE_REPORT !== 'false',
  verbose: process.env.VERBOSE === 'true',
};

// Performance mode configurations
const performanceModes = {
  fast: {
    testTimeout: 15000,
    hookTimeout: 5000,
    poolOptions: { threads: { maxThreads: 2, minThreads: 1 } },
    reporter: ['basic'],
    coverage: false,
  },
  optimized: {
    testTimeout: 30000,
    hookTimeout: 10000,
    poolOptions: { threads: { maxThreads: 4, minThreads: 1 } },
    reporter: ['verbose'],
    coverage: false,
  },
  thorough: {
    testTimeout: 60000,
    hookTimeout: 15000,
    poolOptions: { threads: { maxThreads: 6, minThreads: 2 } },
    reporter: ['verbose', 'json'],
    coverage: true,
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
    };
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

    // Add performance monitoring environment variables
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PERF_MONITORING: config.enablePerfMonitoring ? 'true' : 'false',
      VITEST_POOL_SIZE: config.parallelism.toString(),
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
   * Generate performance report
   */
  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        performanceMode: config.performanceMode,
        parallelism: config.parallelism,
        retries: config.maxRetries,
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
      },
      recommendations: this.generateRecommendations(),
    };

    if (config.generateReport) {
      const reportPath = path.join(__dirname, '../test-performance-report.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to ${reportPath}`);
    }

    return report;
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
   * Print summary
   */
  printSummary() {
    console.log('\n📊 Test Run Summary');
    console.log('===================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Skipped: ${this.testResults.skipped}`);
    console.log(`Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);
    
    if (this.testResults.slowTests.length > 0) {
      console.log(`\n🐌 Slow Tests (${this.testResults.slowTests.length}):`);
      this.testResults.slowTests.slice(0, 5).forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.name}: ${test.duration}ms`);
      });
    }

    if (this.testResults.failedTests.length > 0) {
      console.log(`\n❌ Failed Tests (${this.testResults.failedTests.length}):`);
      this.testResults.failedTests.forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.name}`);
      });
    }

    const report = this.generatePerformanceReport();
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('===================\n');
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