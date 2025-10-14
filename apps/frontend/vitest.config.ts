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
    // Performance optimizations
    testTimeout: 15000, // 15 seconds max per test
    hookTimeout: 10000, // 10 seconds max for hooks
    teardownTimeout: 5000, // 5 seconds max for cleanup
    // Improved test isolation
    isolate: true,
    // Pool configuration for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
    },
    // Coverage configuration (optional)
    coverage: {
      enabled: false, // Disable by default for performance
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
    // Retry configuration for flaky tests
    retry: 2,
    // Bail early on failures in CI
    bail: process.env.CI ? 5 : 0,
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
});
