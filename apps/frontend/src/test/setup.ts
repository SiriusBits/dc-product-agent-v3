import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// Create persistent mock functions for clipboard
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
const clipboardReadText = vi.fn().mockResolvedValue('');

// Global mock for clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: clipboardWriteText,
    readText: clipboardReadText,
  },
  writable: true,
  configurable: true,
});

// Global mock for scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Global mock for IntersectionObserver (used by some UI components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Global mock for ResizeObserver (used by some UI components)
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
