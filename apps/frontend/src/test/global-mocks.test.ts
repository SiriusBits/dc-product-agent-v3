/**
 * Test to verify global mocks are properly configured
 */

import { describe, it, expect, vi } from 'vitest';

describe('Global Mocks Configuration', () => {
  describe('Clipboard API Mock', () => {
    it('should have clipboard.writeText mock available', () => {
      expect(navigator.clipboard).toBeDefined();
      expect(navigator.clipboard.writeText).toBeDefined();
      expect(vi.isMockFunction(navigator.clipboard.writeText)).toBe(true);
    });

    it('should have clipboard.readText mock available', () => {
      expect(navigator.clipboard.readText).toBeDefined();
      expect(vi.isMockFunction(navigator.clipboard.readText)).toBe(true);
    });

    it('should allow clipboard.writeText to be called', async () => {
      await navigator.clipboard.writeText('test text');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('should reset clipboard mock between tests', () => {
      // This test verifies that the mock was cleared from the previous test
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('scrollIntoView Mock', () => {
    it('should have scrollIntoView mock available', () => {
      const element = document.createElement('div');
      expect(element.scrollIntoView).toBeDefined();
      expect(vi.isMockFunction(element.scrollIntoView)).toBe(true);
    });

    it('should allow scrollIntoView to be called', () => {
      const element = document.createElement('div');
      element.scrollIntoView({ behavior: 'smooth' });
      expect(element.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
      });
    });

    it('should reset scrollIntoView mock between tests', () => {
      const element = document.createElement('div');
      // This test verifies that the mock was cleared from the previous test
      expect(element.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('IntersectionObserver Mock', () => {
    it('should have IntersectionObserver mock available', () => {
      expect(global.IntersectionObserver).toBeDefined();
      const observer = new IntersectionObserver(() => {});
      expect(observer).toBeDefined();
      expect(observer.observe).toBeDefined();
      expect(observer.disconnect).toBeDefined();
      expect(observer.unobserve).toBeDefined();
    });
  });

  describe('ResizeObserver Mock', () => {
    it('should have ResizeObserver mock available', () => {
      expect(global.ResizeObserver).toBeDefined();
      const observer = new ResizeObserver(() => {});
      expect(observer).toBeDefined();
      expect(observer.observe).toBeDefined();
      expect(observer.disconnect).toBeDefined();
      expect(observer.unobserve).toBeDefined();
    });
  });

  describe('Mock Reset Between Tests', () => {
    it('should clear localStorage after each test', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');
    });

    it('should have empty localStorage from previous test', () => {
      // This verifies that localStorage was cleared after the previous test
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('should clear sessionStorage after each test', () => {
      sessionStorage.setItem('test-key', 'test-value');
      expect(sessionStorage.getItem('test-key')).toBe('test-value');
    });

    it('should have empty sessionStorage from previous test', () => {
      // This verifies that sessionStorage was cleared after the previous test
      expect(sessionStorage.getItem('test-key')).toBeNull();
    });
  });
});
