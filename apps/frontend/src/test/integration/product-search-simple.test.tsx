/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import ProductBrowser from '@/components/products/ProductBrowser';
import { createMockUseProductsReturn } from '@/test/standardized-mocks';

// Mock the hooks
vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
  useProductDetail: vi.fn(),
  useProductFilters: vi.fn(),
}));

describe('Product Search Integration - Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProductBrowser component', async () => {
    // Mock the hooks
    const { useProducts, useProductDetail, useProductFilters } = await import(
      '@/hooks/useProducts'
    );

    vi.mocked(useProducts).mockReturnValue(
      createMockUseProductsReturn({
        products: [],
        totalCount: 0,
        facets: null,
        loading: false,
        error: null,
      })
    );

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

    // Render component
    render(<ProductBrowser />);

    // Assert: Verify component renders
    expect(screen.getByTestId('product-browser')).toBeInTheDocument();
    expect(screen.getByText('Product Browser')).toBeInTheDocument();
  });
});
