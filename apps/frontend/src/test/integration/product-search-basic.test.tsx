/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, createMockUseProductsReturn } from '@/test';
import ProductBrowser from '@/components/products/ProductBrowser';

// Mock each hook individually
vi.mock('@/hooks/useProducts', () => {
  return {
    useProducts: vi.fn(),
    useProductDetail: vi.fn(),
    useProductFilters: vi.fn(),
    useProductComparison: vi.fn(),
    clearProductsCache: vi.fn(),
  };
});

// Import after mocking
const { useProducts, useProductDetail, useProductFilters } = await import(
  '@/hooks/useProducts'
);

describe('Product Search Integration - Basic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    vi.mocked(useProducts).mockReturnValue({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: null,
      searchProducts: vi.fn().mockResolvedValue(undefined),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    vi.mocked(useProductDetail).mockReturnValue({
      product: null,
      relatedProducts: [],
      loading: false,
      error: null,
      loadProduct: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    vi.mocked(useProductFilters).mockReturnValue({
      families: ['ASA', 'DCA', 'ECA'],
      applications: ['Coatings', 'Adhesives', 'Sealants'],
      loading: false,
      error: null,
      loadFilters: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });
  });

  it('renders ProductBrowser component', async () => {
    render(<ProductBrowser />);

    // Assert: Verify component renders
    expect(screen.getByTestId('product-browser')).toBeInTheDocument();
    expect(screen.getByText('Product Browser')).toBeInTheDocument();
  });

  it('shows empty state when no products', async () => {
    render(<ProductBrowser />);

    // Wait for empty state to appear
    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });
  });
});
