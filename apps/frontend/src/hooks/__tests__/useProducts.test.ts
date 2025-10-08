/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProducts } from '../useProducts';
import type { Product, ProductFamily } from '@/types';
import {
  mockApiClient,
  setupTest,
  cleanupTest,
  createMockProduct,
} from '@/test/test-utils';

describe('useProducts', () => {
  const mockProducts: Product[] = [
    createMockProduct({
      id: 'asa-150',
      name: 'ASA 150',
      shortName: 'ASA150',
      family: 'ASA' as ProductFamily,
      casNumber: '12345-67-8',
      chemicalName: 'Alkenyl Succinic Anhydride 150',
      synonyms: ['ASA-150'],
      properties: [
        {
          category: 'Physical',
          name: 'Viscosity',
          valueString: '150 cP',
          valueNumeric: 150,
          unit: 'cP',
          testMethod: 'ASTM D445',
        },
      ],
      applications: ['Coatings', 'Adhesives'],
      keyBenefits: ['High viscosity', 'Good adhesion'],
    }),
    createMockProduct({
      id: 'dca-467',
      name: 'DCA 467',
      shortName: 'DCA467',
      family: 'DCA' as ProductFamily,
      casNumber: '98765-43-2',
      chemicalName: 'Dicyandiamide 467',
      synonyms: ['DCA-467'],
      properties: [
        {
          category: 'Physical',
          name: 'Melting Point',
          valueString: '200°C',
          valueNumeric: 200,
          unit: '°C',
          testMethod: 'DSC',
        },
      ],
      applications: ['Epoxy Curing'],
      keyBenefits: ['Fast cure', 'High strength'],
    }),
  ];

  const mockFamilies: ProductFamily[] = ['ASA', 'DCA', 'ECA'];
  const mockApplications = ['Coatings', 'Adhesives', 'Epoxy Curing'];

  beforeEach(() => {
    setupTest();
    mockApiClient.searchProducts.mockResolvedValue({
      products: mockProducts,
      total: mockProducts.length,
      limit: 20,
      offset: 0,
      families: mockFamilies,
      applications: mockApplications,
    });
    mockApiClient.getProductFamilies.mockResolvedValue(mockFamilies);
    mockApiClient.getProductApplications.mockResolvedValue(mockApplications);
  });

  afterEach(() => {
    cleanupTest();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useProducts());

    expect(result.current.products).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.families).toEqual([]);
    expect(result.current.applications).toEqual([]);
  });

  it('loads products on mount', async () => {
    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.families).toEqual(mockFamilies);
    expect(result.current.applications).toEqual(mockApplications);
    expect(mockApiClient.getProducts).toHaveBeenCalled();
    expect(mockApiClient.getProductFamilies).toHaveBeenCalled();
    expect(mockApiClient.getApplications).toHaveBeenCalled();
  });

  it('handles loading state correctly', async () => {
    let resolvePromise: (value: Product[]) => void;
    const promise = new Promise<Product[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.getProducts.mockReturnValue(promise);

    const { result } = renderHook(() => useProducts());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!(mockProducts);
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles API errors', async () => {
    const errorMessage = 'Failed to load products';
    mockApiClient.getProducts.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.products).toEqual([]);
  });

  it('searches products with query', async () => {
    const searchResults = [mockProducts[0]]; // Only ASA 150
    mockApiClient.searchProducts.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.products).toEqual(searchResults);
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
        families: ['ASA'],
        applications: ['Coatings'],
      });
    });

    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: ['ASA'],
      applications: ['Coatings'],
    });
  });

  it('gets individual product by ID', async () => {
    const product = mockProducts[0];
    mockApiClient.getProduct.mockResolvedValue(product);

    const { result } = renderHook(() => useProducts());

    let retrievedProduct: Product | null = null;
    await act(async () => {
      retrievedProduct = await result.current.getProduct('asa-150');
    });

    expect(retrievedProduct).toEqual(product);
    expect(mockApiClient.getProduct).toHaveBeenCalledWith('asa-150');
  });

  it('handles product not found', async () => {
    mockApiClient.getProduct.mockResolvedValue(null);

    const { result } = renderHook(() => useProducts());

    let retrievedProduct: Product | null = null;
    await act(async () => {
      retrievedProduct = await result.current.getProduct('non-existent');
    });

    expect(retrievedProduct).toBeNull();
  });

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
    let resolvePromise: (value: Product[]) => void;
    const promise = new Promise<Product[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiClient.searchProducts.mockReturnValue(promise);

    const { result } = renderHook(() => useProducts());

    act(() => {
      result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!([mockProducts[0]]);
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles search errors', async () => {
    const errorMessage = 'Search failed';
    mockApiClient.searchProducts.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({ query: 'ASA' });
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
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
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalCount).toBe(2);
    expect(result.current.familyCount).toEqual({
      ASA: 1,
      DCA: 1,
    });
  });

  it('filters products by multiple criteria', async () => {
    const filteredResults = [mockProducts[0]];
    mockApiClient.searchProducts.mockResolvedValue(filteredResults);

    const { result } = renderHook(() => useProducts());

    await act(async () => {
      await result.current.searchProducts({
        query: 'viscosity',
        families: ['ASA'],
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
