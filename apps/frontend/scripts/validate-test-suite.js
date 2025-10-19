#!/usr/bin/env node

/**
 * Test Suite Validation Runner
 * Runs the full test suite multiple times to validate stability and performance
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validation configuration
const VALIDATION_CONFIG = {
  runs: 10,
  targetPassRate: 95, // 95% pass rate target
  targetExecutionTime: 90000, // 90 seconds target
  minPassingTests: 664, // Minimum passing tests (95% of ~699 total)
  maxFlakiness: 0, // Zero flaky tests allowed
};

class TestSuiteValidator {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.summary = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averagePassRate: 0,
      averageExecutionTime: 0,
      flakyTests: new Map(),
      consistentFailures: new Map(),
      performanceMetrics: {
        fastest: Infinity,
        slowest: 0,
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
      },
    };
  }

  /**
   * Run a single test suite execution
   */
  async runSingleTest(runNumber) {
    console.log(`\n🔄 Running test suite - Run ${runNumber}/${VALIDATION_CONFIG.runs}`);
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    const args = [
      'exec',
      'vitest',
      'run',
      '--reporter=json',
      '--reporter=verbose',
    ];

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PERF_MONITORING: 'true',
      ENABLE_LAZY_MOCKS: 'true',
      ENABLE_DOM_OPTIMIZATION: 'true',
      ENABLE_PARALLEL_OPTIMIZATION: 'true',
      GENERATE_PERF_REPORTS: 'false', // Disable individual reports during validation
      RUN_NUMBER: runNumber.toString(),
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
        // Only show progress indicators, not full output
        if (output.includes('PASS') || output.includes('FAIL') || output.includes('Test Files')) {
          process.stdout.write('.');
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parseTestResult(stdout, stderr, code, duration, runNumber);
        
        console.log(`\n✅ Run ${runNumber} completed in ${(duration / 1000).toFixed(1)}s`);
        console.log(`   Passed: ${result.passed}/${result.total} (${result.passRate.toFixed(1)}%)`);
        
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test results from vitest output
   */
  parseTestResult(stdout, stderr, exitCode, duration, runNumber) {
    const result = {
      runNumber,
      exitCode,
      duration,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0,
      failedTests: [],
      slowTests: [],
      success: exitCode === 0,
    };

    try {
      // Try to parse JSON output first
      const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (jsonMatch) {
        const jsonResult = JSON.parse(jsonMatch[0]);
        if (jsonResult.testResults) {
          result.total = jsonResult.numTotalTests || 0;
          result.passed = jsonResult.numPassedTests || 0;
          result.failed = jsonResult.numFailedTests || 0;
          result.skipped = jsonResult.numPendingTests || 0;
        }
      }

      // Fallback to text parsing
      if (result.total === 0) {
        const testSummaryMatch = stdout.match(/Test Files\s+(\d+) passed.*?Tests\s+(\d+) passed(?:, (\d+) failed)?(?:, (\d+) skipped)?/);
        if (testSummaryMatch) {
          result.passed = parseInt(testSummaryMatch[2]) || 0;
          result.failed = parseInt(testSummaryMatch[3]) || 0;
          result.skipped = parseInt(testSummaryMatch[4]) || 0;
          result.total = result.passed + result.failed + result.skipped;
        }
      }

      result.passRate = result.total > 0 ? (result.passed / result.total) * 100 : 0;

      // Parse failed tests
      const failedTestMatches = stdout.matchAll(/FAIL\s+(.*?\.test\.tsx?)/g);
      for (const match of failedTestMatches) {
        result.failedTests.push(match[1]);
      }

      // Parse slow tests (>5 seconds)
      const slowTestMatches = stdout.matchAll(/(\w+.*?\.test\.tsx?)\s+\((\d+)ms\)/g);
      for (const match of slowTestMatches) {
        const testDuration = parseInt(match[2]);
        if (testDuration > 5000) {
          result.slowTests.push({
            name: match[1],
            duration: testDuration,
          });
        }
      }

    } catch (error) {
      console.warn(`Warning: Could not parse test results for run ${runNumber}:`, error.message);
    }

    return result;
  }

  /**
   * Analyze results for flaky tests and patterns
   */
  analyzeResults() {
    // Track flaky tests (tests that sometimes pass, sometimes fail)
    const testResults = new Map();
    
    this.results.forEach(result => {
      result.failedTests.forEach(testName => {
        if (!testResults.has(testName)) {
          testResults.set(testName, { failures: 0, runs: 0 });
        }
        testResults.get(testName).failures++;
        testResults.get(testName).runs++;
      });
      
      // Also track tests that passed (for flakiness detection)
      // This is approximated since we don't have individual test pass data
    });

    // Identify flaky tests (failed in some runs but not all)
    testResults.forEach((stats, testName) => {
      const failureRate = stats.failures / this.results.length;
      if (failureRate > 0 && failureRate < 1) {
        this.summary.flakyTests.set(testName, {
          failures: stats.failures,
          totalRuns: this.results.length,
          failureRate: failureRate * 100,
        });
      } else if (failureRate === 1) {
        this.summary.consistentFailures.set(testName, {
          failures: stats.failures,
          totalRuns: this.results.length,
        });
      }
    });

    // Calculate summary statistics
    this.summary.totalRuns = this.results.length;
    this.summary.successfulRuns = this.results.filter(r => r.success).length;
    this.summary.failedRuns = this.results.length - this.summary.successfulRuns;
    
    if (this.results.length > 0) {
      this.summary.averagePassRate = this.results.reduce((sum, r) => sum + r.passRate, 0) / this.results.length;
      this.summary.averageExecutionTime = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
      
      this.summary.performanceMetrics.fastest = Math.min(...this.results.map(r => r.duration));
      this.summary.performanceMetrics.slowest = Math.max(...this.results.map(r => r.duration));
      this.summary.performanceMetrics.totalTests = this.results.reduce((sum, r) => sum + r.total, 0);
      this.summary.performanceMetrics.totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
      this.summary.performanceMetrics.totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    }
  }

  /**
   * Generate detailed validation report
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    
    const report = {
      timestamp: new Date().toISOString(),
      validationConfig: VALIDATION_CONFIG,
      summary: this.summary,
      totalValidationTime: totalDuration,
      results: this.results,
      validation: {
        passRateTarget: this.summary.averagePassRate >= VALIDATION_CONFIG.targetPassRate,
        executionTimeTarget: this.summary.averageExecutionTime <= VALIDATION_CONFIG.targetExecutionTime,
        minPassingTestsTarget: this.summary.performanceMetrics.totalPassed >= (VALIDATION_CONFIG.minPassingTests * this.results.length),
        flakinessTarget: this.summary.flakyTests.size <= VALIDATION_CONFIG.maxFlakiness,
        overallSuccess: false, // Will be set below
      },
      recommendations: [],
    };

    // Determine overall success
    report.validation.overallSuccess = 
      report.validation.passRateTarget &&
      report.validation.executionTimeTarget &&
      report.validation.minPassingTestsTarget &&
      report.validation.flakinessTarget;

    // Generate recommendations
    if (!report.validation.passRateTarget) {
      report.recommendations.push(
        `Pass rate ${this.summary.averagePassRate.toFixed(1)}% is below target ${VALIDATION_CONFIG.targetPassRate}%. Focus on fixing consistently failing tests.`
      );
    }

    if (!report.validation.executionTimeTarget) {
      report.recommendations.push(
        `Average execution time ${(this.summary.averageExecutionTime / 1000).toFixed(1)}s exceeds target ${VALIDATION_CONFIG.targetExecutionTime / 1000}s. Optimize slow tests.`
      );
    }

    if (!report.validation.flakinessTarget) {
      report.recommendations.push(
        `${this.summary.flakyTests.size} flaky tests detected. Target is ${VALIDATION_CONFIG.maxFlakiness}. Fix test reliability issues.`
      );
    }

    if (this.summary.consistentFailures.size > 0) {
      report.recommendations.push(
        `${this.summary.consistentFailures.size} tests fail consistently across all runs. These need immediate attention.`
      );
    }

    // Save report
    const reportPath = path.join(__dirname, '../test-suite-validation-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  /**
   * Print validation summary
   */
  printSummary(report) {
    console.log('\n🎯 Test Suite Validation Summary');
    console.log('=' .repeat(60));
    console.log(`Validation runs: ${this.summary.totalRuns}`);
    console.log(`Successful runs: ${this.summary.successfulRuns}/${this.summary.totalRuns} (${((this.summary.successfulRuns / this.summary.totalRuns) * 100).toFixed(1)}%)`);
    console.log(`Total validation time: ${((Date.now() - this.startTime) / 1000 / 60).toFixed(1)} minutes`);
    
    console.log('\n📊 Performance Metrics:');
    console.log(`Average pass rate: ${this.summary.averagePassRate.toFixed(1)}% (target: ≥${VALIDATION_CONFIG.targetPassRate}%)`);
    console.log(`Average execution time: ${(this.summary.averageExecutionTime / 1000).toFixed(1)}s (target: ≤${VALIDATION_CONFIG.targetExecutionTime / 1000}s)`);
    console.log(`Fastest run: ${(this.summary.performanceMetrics.fastest / 1000).toFixed(1)}s`);
    console.log(`Slowest run: ${(this.summary.performanceMetrics.slowest / 1000).toFixed(1)}s`);
    console.log(`Total tests executed: ${this.summary.performanceMetrics.totalTests}`);
    console.log(`Total tests passed: ${this.summary.performanceMetrics.totalPassed}`);
    console.log(`Total tests failed: ${this.summary.performanceMetrics.totalFailed}`);

    console.log('\n🎯 Validation Targets:');
    console.log(`Pass Rate: ${report.validation.passRateTarget ? '✅' : '❌'} ${this.summary.averagePassRate.toFixed(1)}% (≥${VALIDATION_CONFIG.targetPassRate}%)`);
    console.log(`Execution Time: ${report.validation.executionTimeTarget ? '✅' : '❌'} ${(this.summary.averageExecutionTime / 1000).toFixed(1)}s (≤${VALIDATION_CONFIG.targetExecutionTime / 1000}s)`);
    console.log(`Min Passing Tests: ${report.validation.minPassingTestsTarget ? '✅' : '❌'} ${(this.summary.performanceMetrics.totalPassed / this.results.length).toFixed(0)} avg (≥${VALIDATION_CONFIG.minPassingTests})`);
    console.log(`Flakiness: ${report.validation.flakinessTarget ? '✅' : '❌'} ${this.summary.flakyTests.size} flaky tests (≤${VALIDATION_CONFIG.maxFlakiness})`);

    if (this.summary.flakyTests.size > 0) {
      console.log('\n🔄 Flaky Tests:');
      Array.from(this.summary.flakyTests.entries()).slice(0, 10).forEach(([testName, stats]) => {
        console.log(`  • ${testName}: ${stats.failures}/${stats.totalRuns} failures (${stats.failureRate.toFixed(1)}%)`);
      });
    }

    if (this.summary.consistentFailures.size > 0) {
      console.log('\n❌ Consistent Failures:');
      Array.from(this.summary.consistentFailures.entries()).slice(0, 10).forEach(([testName, stats]) => {
        console.log(`  • ${testName}: ${stats.failures}/${stats.totalRuns} failures`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log(`\n🎯 Overall Validation: ${report.validation.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('=' .repeat(60));
  }

  /**
   * Run full validation suite
   */
  async runValidation() {
    console.log('🚀 Starting Test Suite Validation');
    console.log(`Running ${VALIDATION_CONFIG.runs} consecutive test runs...`);
    console.log(`Targets: ≥${VALIDATION_CONFIG.targetPassRate}% pass rate, ≤${VALIDATION_CONFIG.targetExecutionTime / 1000}s execution time`);
    
    for (let i = 1; i <= VALIDATION_CONFIG.runs; i++) {
      try {
        const result = await this.runSingleTest(i);
        this.results.push(result);
        
        // Short delay between runs to prevent resource conflicts
        if (i < VALIDATION_CONFIG.runs) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Run ${i} failed:`, error.message);
        this.results.push({
          runNumber: i,
          exitCode: 1,
          duration: 0,
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          passRate: 0,
          failedTests: [],
          slowTests: [],
          success: false,
          error: error.message,
        });
      }
    }

    this.analyzeResults();
    const report = this.generateReport();
    this.printSummary(report);

    return report;
  }
}

// Main execution
async function main() {
  const validator = new TestSuiteValidator();
  
  try {
    const report = await validator.runValidation();
    
    // Exit with appropriate code
    if (report.validation.overallSuccess) {
      console.log('\n🎉 Test suite validation PASSED!');
      process.exit(0);
    } else {
      console.log('\n❌ Test suite validation FAILED!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestSuiteValidator, VALIDATION_CONFIG };