/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { waitForDebounce } from '@/test';
import { useProducts } from '../useProducts';
import type { ProductSummary } from '@repo/shared-types';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    getRelatedProducts: vi.fn(),
    compareProducts: vi.fn(),
    getProductFamilies: vi.fn(),
    getProductApplications: vi.fn(),
    getProductStatistics: vi.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = 'ApiError';
    }
    isRetryable() {
      return this.status >= 500 || this.status === 429;
    }
  },
}));

// Get the mocked functions
const mockApiClient = vi.mocked(await import('@/lib/api-client')).apiClient;

// Import the hook and cache clearing function
const { useProducts, clearProductsCache } = await import('../useProducts');

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
    vi.clearAllMocks();
    clearProductsCache();
    mockApiClient.searchProducts.mockResolvedValue(mockSearchResponse);
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
    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({});
  });

  it('handles loading state correctly', async () => {
    // Clear cache to ensure fresh API call
    clearProductsCache();

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
    // Clear cache to ensure fresh API call
    clearProductsCache();

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
      limit: 20,
      offset: 0,
    });
  });

  it('searches products with filters', async () => {
    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
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
      limit: 20,
      offset: 0,
    });
  });

  // Note: getProduct method is not part of useProducts hook interface

  it('caches search results', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Second identical search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Should call API twice: once for initial load, once for first search (second is cached)
    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(2);
  });

  it('clears cache when search parameters change', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const initialResults = mockSearchResponse;
    const searchResults1 = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
    const searchResults2 = {
      products: [mockProducts[1]],
      total_count: 1,
      facets: {},
    };

    mockApiClient.searchProducts
      .mockResolvedValueOnce(initialResults)
      .mockResolvedValueOnce(searchResults1)
      .mockResolvedValueOnce(searchResults2);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    // Different search
    await act(async () => {
      await result.current.searchProducts({ query: 'DCA' });
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(3);
  });

  it('debounces search requests', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Test debounced search operations using enhanced utility with fake timers
    vi.useFakeTimers();

    try {
      await waitForDebounce(async () => {
        await act(async () => {
          await result.current.searchProducts({ query: 'ASA' });
        });
      }, 500);

      // Should call API for initial load + 1 debounced search
      expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(2);
      expect(result.current.products).toEqual(searchResults.products);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles concurrent search requests', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start multiple searches concurrently
    await act(async () => {
      const promise1 = result.current.searchProducts({ query: 'ASA' });
      const promise2 = result.current.searchProducts({ query: 'DCA' });
      await Promise.all([promise1, promise2]);
    });

    // Should handle initial load + both requests
    expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(3);
  });

  it('resets to all products when search is cleared', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const initialResults = mockSearchResponse;
    const searchResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
    const emptySearchResults = {
      products: mockProducts,
      total_count: 2,
      facets: mockSearchResponse.facets,
    };

    mockApiClient.searchProducts
      .mockResolvedValueOnce(initialResults)
      .mockResolvedValueOnce(searchResults)
      .mockResolvedValueOnce(emptySearchResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.products).toEqual(mockProducts);
    });

    // Perform search
    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.products).toEqual(searchResults.products);

    // Clear search
    await act(async () => {
      await result.current.searchProducts({ query: '' });
    });

    expect(result.current.products).toEqual(mockProducts);
  });

  it('maintains loading state during search', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    let resolvePromise: (value: unknown) => void;
    const promise = new Promise<unknown>((resolve) => {
      resolvePromise = resolve;
    });

    // Mock initial load to resolve immediately, then search to be pending
    mockApiClient.searchProducts
      .mockResolvedValueOnce(mockSearchResponse)
      .mockReturnValueOnce(promise);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise!({
        products: [mockProducts[0]],
        total_count: 1,
        facets: {},
      });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('handles search errors', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const errorMessage = 'Search failed';

    // Mock initial load to succeed, then search to fail
    mockApiClient.searchProducts
      .mockResolvedValueOnce(mockSearchResponse)
      .mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('clears error on successful search', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const successResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };

    // Mock initial load to succeed, first search to fail, second to succeed
    mockApiClient.searchProducts
      .mockResolvedValueOnce(mockSearchResponse)
      .mockRejectedValueOnce(new Error('Search failed'))
      .mockResolvedValueOnce(successResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

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
    // Clear cache to start fresh
    clearProductsCache();

    mockApiClient.searchProducts.mockResolvedValueOnce(mockSearchResponse);

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalCount).toBe(2);
    expect(result.current.facets?.families).toBeDefined();
  });

  it('filters products by multiple criteria', async () => {
    const filteredResults = {
      products: [mockProducts[0]],
      total_count: 1,
      facets: {},
    };
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
      family: 'ASA',
      applications: ['Coatings'],
      limit: 20,
      offset: 0,
    });
  });

  it('handles empty search results', async () => {
    // Clear cache to start fresh
    clearProductsCache();

    const emptyResults = {
      products: [],
      total_count: 0,
      facets: {},
    };

    // Mock initial load to succeed, then search to return empty
    mockApiClient.searchProducts
      .mockResolvedValueOnce(mockSearchResponse)
      .mockResolvedValueOnce(emptyResults);

    const { result } = renderHook(() => useProducts());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.searchProducts({ query: 'nonexistent' });
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });
});
