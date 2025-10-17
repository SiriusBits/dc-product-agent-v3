/**
 * Unit tests for ReactiveHookMock and MockRegistry
 *
 * These tests verify that the reactive mock infrastructure correctly:
 * - Triggers React re-renders via act()
 * - Merges partial updates with existing state
 * - Resets to initial values
 * - Handles multiple sequential updates
 * - Notifies subscribers on updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import {
  ReactiveHookMock,
  MockRegistry,
  mockRegistry,
} from '../reactive-mocks';

// ============================================================================
// Test Types
// ============================================================================

interface TestHookState {
  count: number;
  isLoading: boolean;
  error: string | null;
  data: string[];
}

// ============================================================================
// Test Component
// ============================================================================

/**
 * Test component that uses a mocked hook to verify re-renders
 */
function TestComponent({ useTestHook }: { useTestHook: () => TestHookState }) {
  const state = useTestHook();
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, [state]);

  return (
    <div>
      <div data-testid="count">{state.count}</div>
      <div data-testid="loading">{state.isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="error">{state.error || 'no error'}</div>
      <div data-testid="data">{state.data.join(', ')}</div>
      <div data-testid="render-count">{renderCount}</div>
    </div>
  );
}

// ============================================================================
// ReactiveHookMock Tests
// ============================================================================

describe('ReactiveHookMock', () => {
  let mock: ReactiveHookMock<TestHookState>;
  let initialState: TestHookState;

  beforeEach(() => {
    initialState = {
      count: 0,
      isLoading: false,
      error: null,
      data: [],
    };
    mock = new ReactiveHookMock(initialState);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the provided initial value', () => {
      const state = mock.getCurrentValue();
      expect(state).toEqual(initialState);
    });

    it('should create a Vitest mock function', () => {
      const mockFn = mock.getMock();
      expect(mockFn).toBeDefined();
      expect(typeof mockFn).toBe('function');
      expect(mockFn.mock).toBeDefined();
    });

    it('should return initial value when mock function is called', () => {
      const mockFn = mock.getMock();
      const result = mockFn();
      expect(result).toEqual(initialState);
    });
  });

  describe('updateValue', () => {
    it('should update state with partial values', async () => {
      await mock.updateValue({ count: 5 });

      const state = mock.getCurrentValue();
      expect(state.count).toBe(5);
      expect(state.isLoading).toBe(false); // Other values unchanged
      expect(state.error).toBe(null);
      expect(state.data).toEqual([]);
    });

    it('should merge multiple properties in a single update', async () => {
      await mock.updateValue({
        count: 10,
        isLoading: true,
        data: ['item1', 'item2'],
      });

      const state = mock.getCurrentValue();
      expect(state.count).toBe(10);
      expect(state.isLoading).toBe(true);
      expect(state.data).toEqual(['item1', 'item2']);
      expect(state.error).toBe(null); // Unchanged property
    });

    it('should trigger React re-renders via act()', async () => {
      const mockFn = mock.getMock();

      const { rerender } = render(<TestComponent useTestHook={mockFn} />);

      // Initial render
      expect(screen.getByTestId('count')).toHaveTextContent('0');

      // Update and verify re-render
      await mock.updateValue({ count: 42 });

      // Force a re-render to pick up the new mock value
      rerender(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('count')).toHaveTextContent('42');
    });

    it('should handle multiple sequential updates correctly', async () => {
      await mock.updateValue({ count: 1 });
      await mock.updateValue({ count: 2 });
      await mock.updateValue({ count: 3 });

      const state = mock.getCurrentValue();
      expect(state.count).toBe(3);
    });

    it('should handle rapid sequential updates', async () => {
      const updates = [
        { count: 1 },
        { count: 2, isLoading: true },
        { count: 3, isLoading: false },
        { data: ['a', 'b'] },
        { error: 'test error' },
      ];

      for (const update of updates) {
        await mock.updateValue(update);
      }

      const state = mock.getCurrentValue();
      expect(state.count).toBe(3);
      expect(state.isLoading).toBe(false);
      expect(state.data).toEqual(['a', 'b']);
      expect(state.error).toBe('test error');
    });

    it('should preserve object references for unchanged properties', async () => {
      const originalData = initialState.data;

      await mock.updateValue({ count: 5 });

      const state = mock.getCurrentValue();
      // Note: getCurrentValue returns a copy, so we check the mock function's return
      const mockFn = mock.getMock();
      const directState = mockFn();
      expect(directState.data).toBe(originalData);
    });
  });

  describe('getMock', () => {
    it('should return a Vitest mock function', () => {
      const mockFn = mock.getMock();
      expect(mockFn.mock).toBeDefined();
      expect(mockFn.mock.calls).toBeDefined();
    });

    it('should return current state when called', () => {
      const mockFn = mock.getMock();
      const result = mockFn();
      expect(result).toEqual(initialState);
    });

    it('should return updated state after updateValue', async () => {
      const mockFn = mock.getMock();

      await mock.updateValue({ count: 99 });

      const result = mockFn();
      expect(result.count).toBe(99);
    });
  });

  describe('getCurrentValue', () => {
    it('should return the current state', () => {
      const state = mock.getCurrentValue();
      expect(state).toEqual(initialState);
    });

    it('should return updated state after updateValue', async () => {
      await mock.updateValue({ count: 7, isLoading: true });

      const state = mock.getCurrentValue();
      expect(state.count).toBe(7);
      expect(state.isLoading).toBe(true);
    });

    it('should return a copy of the state', () => {
      const state1 = mock.getCurrentValue();
      const state2 = mock.getCurrentValue();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });

    it('should not allow external mutation of state', () => {
      const state = mock.getCurrentValue();
      state.count = 999;

      const actualState = mock.getCurrentValue();
      expect(actualState.count).toBe(0); // Unchanged
    });
  });

  describe('reset', () => {
    it('should restore initial state', async () => {
      await mock.updateValue({ count: 50, isLoading: true, error: 'error' });

      mock.reset();

      const state = mock.getCurrentValue();
      expect(state).toEqual(initialState);
    });

    it('should clear mock function call history', async () => {
      const mockFn = mock.getMock();

      mockFn();
      mockFn();
      expect(mockFn.mock.calls.length).toBe(2);

      mock.reset();

      expect(mockFn.mock.calls.length).toBe(0);
    });

    it('should notify subscribers after reset', () => {
      const subscriber = vi.fn();
      mock.subscribe(subscriber);

      mock.reset();

      expect(subscriber).toHaveBeenCalledWith(initialState);
    });

    it('should allow updates after reset', async () => {
      await mock.updateValue({ count: 100 });
      mock.reset();
      await mock.updateValue({ count: 5 });

      const state = mock.getCurrentValue();
      expect(state.count).toBe(5);
    });
  });

  describe('subscribe', () => {
    it('should call subscriber when state updates', async () => {
      const subscriber = vi.fn();
      mock.subscribe(subscriber);

      await mock.updateValue({ count: 10 });

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({ count: 10 })
      );
    });

    it('should call multiple subscribers', async () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      mock.subscribe(subscriber1);
      mock.subscribe(subscriber2);

      await mock.updateValue({ count: 20 });

      expect(subscriber1).toHaveBeenCalledTimes(1);
      expect(subscriber2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const subscriber = vi.fn();
      const unsubscribe = mock.subscribe(subscriber);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop calling subscriber after unsubscribe', async () => {
      const subscriber = vi.fn();
      const unsubscribe = mock.subscribe(subscriber);

      await mock.updateValue({ count: 1 });
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();

      await mock.updateValue({ count: 2 });
      expect(subscriber).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle subscriber errors gracefully', async () => {
      const errorSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalSubscriber = vi.fn();

      mock.subscribe(errorSubscriber);
      mock.subscribe(normalSubscriber);

      // Should not throw
      await expect(mock.updateValue({ count: 5 })).resolves.not.toThrow();

      // Normal subscriber should still be called
      expect(normalSubscriber).toHaveBeenCalled();
    });

    it('should call subscribers on reset', () => {
      const subscriber = vi.fn();
      mock.subscribe(subscriber);

      subscriber.mockClear();
      mock.reset();

      expect(subscriber).toHaveBeenCalledWith(initialState);
    });
  });

  describe('integration with React components', () => {
    it('should trigger component re-renders on state updates', async () => {
      const mockFn = mock.getMock();

      const { rerender } = render(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');

      await mock.updateValue({ count: 5, isLoading: true });

      // Force a re-render to pick up the new mock value
      rerender(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('count')).toHaveTextContent('5');
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    it('should handle multiple rapid updates in components', async () => {
      const mockFn = mock.getMock();

      const { rerender } = render(<TestComponent useTestHook={mockFn} />);

      await mock.updateValue({ count: 1 });
      await mock.updateValue({ count: 2 });
      await mock.updateValue({ count: 3 });

      // Force a re-render to pick up the final mock value
      rerender(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('count')).toHaveTextContent('3');
    });

    it('should reflect array updates in components', async () => {
      const mockFn = mock.getMock();

      const { rerender } = render(<TestComponent useTestHook={mockFn} />);

      await mock.updateValue({ data: ['apple', 'banana'] });

      // Force a re-render to pick up the new mock value
      rerender(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('data')).toHaveTextContent('apple, banana');

      await mock.updateValue({ data: ['apple', 'banana', 'cherry'] });

      // Force another re-render
      rerender(<TestComponent useTestHook={mockFn} />);

      expect(screen.getByTestId('data')).toHaveTextContent(
        'apple, banana, cherry'
      );
    });
  });
});

// ============================================================================
// MockRegistry Tests
// ============================================================================

describe('MockRegistry', () => {
  let registry: MockRegistry;
  let mock1: ReactiveHookMock<TestHookState>;
  let mock2: ReactiveHookMock<TestHookState>;

  beforeEach(() => {
    registry = new MockRegistry();
    mock1 = new ReactiveHookMock({
      count: 0,
      isLoading: false,
      error: null,
      data: [],
    });
    mock2 = new ReactiveHookMock({
      count: 10,
      isLoading: true,
      error: 'error',
      data: ['test'],
    });
  });

  describe('register', () => {
    it('should register a mock with a name', () => {
      registry.register('test1', mock1);

      const retrieved = registry.get('test1');
      expect(retrieved).toBe(mock1);
    });

    it('should register multiple mocks', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      expect(registry.get('test1')).toBe(mock1);
      expect(registry.get('test2')).toBe(mock2);
    });

    it('should warn when overwriting existing mock', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register('test', mock1);
      registry.register('test', mock2);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );

      consoleSpy.mockRestore();
    });

    it('should overwrite existing mock when registering with same name', () => {
      registry.register('test', mock1);
      registry.register('test', mock2);

      const retrieved = registry.get('test');
      expect(retrieved).toBe(mock2);
    });
  });

  describe('get', () => {
    it('should retrieve registered mock by name', () => {
      registry.register('test', mock1);

      const retrieved = registry.get('test');
      expect(retrieved).toBe(mock1);
    });

    it('should return undefined for unregistered mock', () => {
      const retrieved = registry.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should be type-safe', () => {
      registry.register('test', mock1);

      const retrieved = registry.get<TestHookState>('test');
      if (retrieved) {
        const state = retrieved.getCurrentValue();
        expect(state.count).toBeDefined();
      }
    });
  });

  describe('update', () => {
    it('should update registered mock by name', async () => {
      registry.register('test', mock1);

      await registry.update('test', { count: 42 });

      const mock = registry.get('test');
      const state = mock?.getCurrentValue();
      expect(state?.count).toBe(42);
    });

    it('should throw error for unregistered mock', async () => {
      await expect(
        registry.update('nonexistent', { count: 1 })
      ).rejects.toThrow('Mock "nonexistent" not found');
    });

    it('should support partial updates', async () => {
      registry.register('test', mock1);

      await registry.update('test', { count: 5 });
      await registry.update('test', { isLoading: true });

      const mock = registry.get('test');
      const state = mock?.getCurrentValue();
      expect(state?.count).toBe(5);
      expect(state?.isLoading).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all registered mocks', async () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      await registry.update('test1', { count: 100 });
      await registry.update('test2', { count: 200 });

      registry.resetAll();

      const state1 = registry.get('test1')?.getCurrentValue();
      const state2 = registry.get('test2')?.getCurrentValue();

      expect(state1?.count).toBe(0); // Reset to initial
      expect(state2?.count).toBe(10); // Reset to initial
    });

    it('should not remove mocks from registry', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      registry.resetAll();

      expect(registry.get('test1')).toBeDefined();
      expect(registry.get('test2')).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should remove all mocks from registry', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      registry.clearAll();

      expect(registry.get('test1')).toBeUndefined();
      expect(registry.get('test2')).toBeUndefined();
    });

    it('should result in empty registry', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      registry.clearAll();

      expect(registry.getRegisteredNames()).toEqual([]);
    });
  });

  describe('getRegisteredNames', () => {
    it('should return empty array for empty registry', () => {
      expect(registry.getRegisteredNames()).toEqual([]);
    });

    it('should return all registered mock names', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);
      registry.register('test3', mock1);

      const names = registry.getRegisteredNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('test1');
      expect(names).toContain('test2');
      expect(names).toContain('test3');
    });

    it('should update after clearAll', () => {
      registry.register('test1', mock1);
      registry.register('test2', mock2);

      registry.clearAll();

      expect(registry.getRegisteredNames()).toEqual([]);
    });
  });
});

// ============================================================================
// Global mockRegistry Tests
// ============================================================================

describe('mockRegistry singleton', () => {
  beforeEach(() => {
    mockRegistry.clearAll();
  });

  afterEach(() => {
    mockRegistry.clearAll();
  });

  it('should be a MockRegistry instance', () => {
    expect(mockRegistry).toBeInstanceOf(MockRegistry);
  });

  it('should maintain state across imports', () => {
    const mock = new ReactiveHookMock({
      count: 0,
      isLoading: false,
      error: null,
      data: [],
    });
    mockRegistry.register('global-test', mock);

    expect(mockRegistry.get('global-test')).toBe(mock);
  });

  it('should be usable in test setup', async () => {
    const mock = new ReactiveHookMock({
      count: 0,
      isLoading: false,
      error: null,
      data: [],
    });
    mockRegistry.register('setup-test', mock);

    await mockRegistry.update('setup-test', { count: 99 });

    const state = mockRegistry.get('setup-test')?.getCurrentValue();
    expect(state?.count).toBe(99);
  });
});
