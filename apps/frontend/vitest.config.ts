/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],

    // Optimized performance settings
    testTimeout: process.env.CI ? 30000 : 15000, // Longer timeout in CI
    hookTimeout: process.env.CI ? 15000 : 10000,
    teardownTimeout: 5000,

    // Enhanced test isolation for better reliability
    isolate: true,

    // Optimized pool configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: process.env.CI ? 2 : 4,
        minThreads: 1,
        isolate: true,
      },
    },

    // Enhanced reporter configuration
    reporters: process.env.CI
      ? ['verbose', 'json', 'junit']
      : ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
      junit: './test-results.xml',
    },

    // Coverage configuration
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/performance-*.ts',
        '**/lazy-mock-*.ts',
        '**/parallel-*.ts',
        '**/dom-optimizer.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },

    // Retry configuration with smart retry logic
    retry: process.env.CI ? 3 : 2,

    // Bail configuration
    bail: process.env.CI ? 10 : 5,

    // Performance monitoring
    logHeapUsage: process.env.PERF_MONITORING === 'true',

    // Sequence configuration for better test ordering
    sequence: {
      shuffle: false, // Disable shuffle for consistent performance measurement
      concurrent: true, // Enable concurrent execution within files
    },

    // File parallelization
    fileParallelism: true,

    // Enhanced watch mode (for development)
    watch: process.env.NODE_ENV !== 'test',

    // Environment variables for performance optimization
    env: {
      PERF_MONITORING: process.env.PERF_MONITORING || 'false',
      ENABLE_LAZY_MOCKS: process.env.ENABLE_LAZY_MOCKS || 'true',
      ENABLE_DOM_OPTIMIZATION: process.env.ENABLE_DOM_OPTIMIZATION || 'true',
      ENABLE_PARALLEL_OPTIMIZATION:
        process.env.ENABLE_PARALLEL_OPTIMIZATION || 'true',
      GENERATE_PERF_REPORTS:
        process.env.GENERATE_PERF_REPORTS ||
        (process.env.CI ? 'true' : 'false'),
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  // Ensure compatibility with different Vite versions
  define: {
    'import.meta.vitest': undefined,
  },

  // Optimizations for test performance
  optimizeDeps: {
    include: [
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'vitest',
    ],
  },

  // Build optimizations for tests
  build: {
    target: 'node14',
    minify: false, // Disable minification for faster builds in tests
  },
});
