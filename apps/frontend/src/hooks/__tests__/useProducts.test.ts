/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProducts } from '../useProducts';
import type { ProductSummary } from '@repo/shared-types';
import {
  mockApiClient,
  setupTest,
  cleanupTest,
  createMockProduct,
} from '@/test/test-utils';

describe('useProducts', () => {
  const mockProducts: ProductSummary[] = [
    {
      id: 'asa-150',
      name: 'ASA 150',
      short_name: 'ASA150',
      family: 'ASA',
      cas_number: '12345-67-8',
      applications: ['Coatings', 'Adhesives'],
      key_properties: ['Viscosity: 150 cP'],
      document_count: 1,
    },
    {
      id: 'dca-467',
      name: 'DCA 467',
      short_name: 'DCA467',
      family: 'DCA',
      cas_number: '98765-43-2',
      applications: ['Epoxy Curing'],
      key_properties: ['Melting Point: 200°C'],
      document_count: 1,
    },
  ];

  const mockSearchResponse = {
    products: mockProducts,
    total_count: 2,
    facets: {
      families: [
        { value: 'ASA', count: 1 },
        { value: 'DCA', count: 1 },
      ],
      applications: [
        { value: 'Coatings', count: 1 },
        { value: 'Adhesives', count: 1 },
        { value: 'Epoxy Curing', count: 1 },
      ],
      manufacturers: [],
      properties: [],
    },
    query_info: {
      processed_query: '',
      filters_applied: [],
      search_time_ms: 100,
    },
  };

  beforeEach(() => {
    setupTest();
    mockApiClient.searchProducts.mockResolvedValue(mockSearchResponse);
  });

  afterEach(() => {
    cleanupTest();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useProducts());

    expect(result.current.products).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.totalCount).toBe(0);
    expect(result.current.facets).toBeNull();
  });

  it('loads products on mount', async () => {
    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.totalCount).toBeGreaterThan(0);
    expect(result.current.facets).toBeDefined();
    expect(mockApiClient.searchProducts).toHaveBeenCalled();
  });

  it('handles loading state correctly', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise<any>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.searchProducts.mockReturnValue(promise);

    const { result } = renderHook(() => useProducts());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise!({ products: mockProducts, total_count: 2, facets: {} });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('handles API errors', async () => {
    const errorMessage = 'Failed to load products';
    mockApiClient.searchProducts.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
  });

  it('searches products with query', async () => {
    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    }; // Only ASA 150
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.products).toEqual(searchResults.products);
    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: 'ASA',
      families: undefined,
      applications: undefined,
    });
  });

  it('searches products with filters', async () => {
    const searchResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({
        query: '',
        family: 'ASA',
        applications: ['Coatings'],
      });
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: '',
      family: 'ASA',
      applications: ['Coatings'],
    });
  });

  // Note: getProduct method is not part of useProducts hook interface

  it('caches search results', async () => {
    const searchResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // First search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Second identical search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Should only call API once due to caching
    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(1);
  });

  it('clears cache when search parameters change', async () => {
    const searchResults1 = [mockProducts[0]];
    const searchResults2 = [mockProducts[1]];

    mockApiClient.searchProducts
      .mockResolvedValueOnce(searchResults1)
      .mockResolvedValueOnce(searchResults2);

    const { result } = renderHook(() => useProducts());

    // First search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Different search
    await act(async () => {
      await result.current.searchProducts({ query: 'DCA' });
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(2);
  });

  it('debounces search requests', async () => {
    vi.useFakeTimers();

    const searchResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Multiple rapid searches
    act(() => {
      result.current.searchProducts({ query: 'A' });
      result.current.searchProducts({ query: 'AS' });
      result.current.searchProducts({ query: 'ASA' });
    });

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(1);
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: 'ASA',
      families: undefined,
      applications: undefined,
    });

    vi.useRealTimers();
  });

  it('handles concurrent search requests', async () => {
    const searchResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Start multiple searches concurrently
    await act(async () => {
      const promise1 = result.current.searchProducts({ query: 'ASA' });
      const promise2 = result.current.searchProducts({ query: 'DCA' });
      await Promise.all([promise1, promise2]);
    });

    // Should handle both requests
    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(2);
  });

  it('resets to all products when search is cleared', async () => {
    const searchResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.products).toEqual(mockProducts);
    });

    // Perform search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.products).toEqual(searchResults);

    // Clear search
    await act(async () => {
      await result.current.searchProducts({ query: '' });
    });

    expect(result.current.products).toEqual(mockProducts);
  });

  it('maintains loading state during search', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise<unknown>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.searchProducts.mockReturnValue(promise);

    const { result } = renderHook(() => useProducts());

    act(() => {
      result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise!({
        // products property is part of the response structure
        total_count: 1,
        facets: {},
      });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('handles search errors', async () => {
    const errorMessage = 'Search failed';
    mockApiClient.searchProducts.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('clears error on successful search', async () => {
    // First search fails
    mockApiClient.searchProducts.mockRejectedValueOnce(
      new Error('Search failed')
    );
    // Second search succeeds
    mockApiClient.searchProducts.mockResolvedValueOnce([mockProducts[0]]);

    const { result } = renderHook(() => useProducts());

    // Failed search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.error).toBe('Search failed');

    // Successful search
    await act(async () => {
      await result.current.searchProducts({ query: 'DCA' });
    });

    expect(result.current.error).toBeNull();
  });

  it('provides product statistics', async () => {
    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalCount).toBe(2);
    expect(result.current.facets?.families).toBeDefined();
  });

  it('filters products by multiple criteria', async () => {
    const filteredResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(filteredResults);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({
        query: 'viscosity',
        family: 'ASA',
        applications: ['Coatings'],
      });
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: 'viscosity',
      families: ['ASA'],
      applications: ['Coatings'],
    });
  });

  it('handles empty search results', async () => {
    mockApiClient.searchProducts.mockResolvedValue([]);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({ query: 'nonexistent' });
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });
});
