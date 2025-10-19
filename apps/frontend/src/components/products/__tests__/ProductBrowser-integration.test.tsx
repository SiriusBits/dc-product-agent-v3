/**
 * ProductBrowser Integration Tests
 *
 * Tests ProductBrowser component integration with mocked hooks.
 * Verifies conditional rendering, error handling, and filter functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { typeIntoInput } from '../../../test/input-utilities';
import ProductBrowser from '../ProductBrowser';
import { ApiError } from '../../../lib/api-client';

// Mock the hooks
vi.mock('../../../hooks/useProducts');
vi.mock('../../../hooks/useApi');

// Import the mocked hooks
import {
  useProducts,
  useProductDetail,
  useProductFilters,
} from '../../../hooks/useProducts';
import { useApi } from '../../../hooks/useApi';

const mockUseProducts = vi.mocked(useProducts);
const mockUseProductDetail = vi.mocked(useProductDetail);
const mockUseProductFilters = vi.mocked(useProductFilters);
const mockUseApi = vi.mocked(useApi);

describe('ProductBrowser Integration Tests', () => {
  let mockSearchProducts: ReturnType<typeof vi.fn>;
  let mockLoadMore: ReturnType<typeof vi.fn>;

  const mockProducts = [
    {
      id: 'asa-150',
      name: 'ASA 150',
      short_name: 'ASA150',
      description: 'Alkenyl Succinic Anhydride 150',
      family: 'ASA',
      cas_number: '12345-67-8',
      applications: ['Coatings', 'Adhesives'],
      key_properties: ['Viscosity: 150 cP'],
      key_benefits: ['High viscosity', 'Good adhesion'],
      document_count: 1,
    },
    {
      id: 'dca-467',
      name: 'DCA 467',
      short_name: 'DCA467',
      description: 'Dicyandiamide 467',
      family: 'DCA',
      cas_number: '98765-43-2',
      applications: ['Epoxy Curing'],
      key_properties: ['Melting Point: 200°C'],
      key_benefits: ['Fast cure', 'High strength'],
      document_count: 1,
    },
  ];

  const mockProductsHook = {
    products: mockProducts,
    totalCount: mockProducts.length,
    facets: null,
    loading: false,
    error: null,
    searchProducts: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    retry: vi.fn(),
    isRetryable: false,
  };

  beforeEach(() => {
    // Create fresh mock functions
    mockSearchProducts = vi.fn().mockResolvedValue(undefined);
    mockLoadMore = vi.fn().mockResolvedValue(undefined);

    // Set up default mock returns
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      searchProducts: mockSearchProducts,
      loadMore: mockLoadMore,
    });

    mockUseProductDetail.mockReturnValue({
      product: null,
      relatedProducts: [],
      loading: false,
      error: null,
      loadProduct: vi.fn(),
      retry: vi.fn(),
      isRetryable: false,
    });

    mockUseProductFilters.mockReturnValue({
      families: ['ASA', 'DCA', 'ECA', 'MHHPA'],
      applications: ['Coatings', 'Adhesives', 'Epoxy Curing', 'Composites'],
      loading: false,
      error: null,
      loadFilters: vi.fn(),
      retry: vi.fn(),
      isRetryable: false,
    });

    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
      isRetryable: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Conditional rendering logic', () => {
    it('shows only loading state when loading and no products exist', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        loading: true,
        products: [],
        error: null,
      });

      render(<ProductBrowser />);

      // Should show loading state
      expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();

      // Should NOT show error or product list
      expect(screen.queryByTestId('api-error-display')).not.toBeInTheDocument();
      expect(screen.queryByText('ASA 150')).not.toBeInTheDocument();
    });

    it('shows only error state when error exists', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: 'Network error',
        loading: true, // Even with loading=true, error should take precedence
        products: mockProducts, // Even with products, error should take precedence
      });

      render(<ProductBrowser />);

      // Should show error (string errors show as simple text, not ApiErrorDisplay)
      expect(screen.getByTestId('product-error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();

      // Should NOT show loading or product list
      expect(
        screen.queryByTestId('product-loading-spinner')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('ASA 150')).not.toBeInTheDocument();
    });

    it('shows product list when no error and not in initial loading state', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        loading: false,
        products: mockProducts,
        error: null,
      });

      render(<ProductBrowser />);

      // Should show product list
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
      expect(screen.getByText('DCA 467')).toBeInTheDocument();

      // Should NOT show error or loading
      expect(screen.queryByTestId('api-error-display')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('product-loading-spinner')
      ).not.toBeInTheDocument();
    });

    it('shows product list even when loading if products already exist', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        loading: true, // Loading more products
        products: mockProducts, // But already have some products
        error: null,
      });

      render(<ProductBrowser />);

      // Should show product list (not initial loading)
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
      expect(screen.getByText('DCA 467')).toBeInTheDocument();

      // Should NOT show loading spinner (since products exist)
      expect(
        screen.queryByTestId('product-loading-spinner')
      ).not.toBeInTheDocument();

      // Should NOT show error
      expect(screen.queryByTestId('api-error-display')).not.toBeInTheDocument();
    });
  });

  describe('Error handling integration', () => {
    it('displays string error with retry functionality', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: 'Network error',
        loading: false,
        products: [],
      });

      render(<ProductBrowser />);

      expect(screen.getByTestId('product-error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('calls searchProducts when retry is clicked for string error', async () => {
      const user = userEvent.setup();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: 'Network error',
        searchProducts: mockSearchProducts,
      });

      render(<ProductBrowser />);

      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);

      expect(mockSearchProducts).toHaveBeenCalled();
    });

    it('uses context-specific test ID for loading state', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        loading: true,
        products: [],
        error: null,
      });

      render(<ProductBrowser />);

      // Should use product-specific loading spinner test ID
      expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();
    });
  });

  describe('ProductFilters clear functionality', () => {
    it('passes empty object when clearing filters', async () => {
      const user = userEvent.setup();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
        products: mockProducts,
        loading: false,
        error: null,
      });

      render(<ProductBrowser />);

      // Apply some filters first
      const familySelect = screen.getByRole('combobox', { name: /family/i });
      await user.click(familySelect);
      await user.click(screen.getAllByText('ASA')[0]);

      // Verify filter was applied
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ family: 'ASA' })
        );
      });

      mockSearchProducts.mockClear();

      // Clear filters
      const clearButton = screen.getByRole('button', {
        name: /clear filters/i,
      });
      await user.click(clearButton);

      await waitFor(() => {
        // Should pass empty object {}, not default values
        expect(mockSearchProducts).toHaveBeenCalledWith({});
      });
    });

    it('search input triggers correct parameters', async () => {
      const user = userEvent.setup();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
        products: [],
        loading: false,
        error: null,
      });

      render(<ProductBrowser />);

      // Apply filter
      const searchInput = screen.getByPlaceholderText(/search products/i);
      await typeIntoInput(searchInput, 'ASA', { clearFirst: true });

      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'ASA' })
        );
      });
    });
  });

  describe('Filter interactions', () => {
    it('family filter triggers search with correct parameters', async () => {
      const user = userEvent.setup();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
        products: mockProducts,
        loading: false,
        error: null,
      });

      render(<ProductBrowser />);

      // Change family filter
      const familySelect = screen.getByRole('combobox', { name: /family/i });
      await user.click(familySelect);
      await user.click(screen.getAllByText('DCA')[0]);

      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ family: 'DCA' })
        );
      });
    });

    it('application filter triggers search with correct parameters', async () => {
      const user = userEvent.setup();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
        products: mockProducts,
        loading: false,
        error: null,
      });

      render(<ProductBrowser />);

      // Change application filter
      const applicationSelect = screen.getByRole('combobox', {
        name: /application/i,
      });
      await user.click(applicationSelect);
      await user.click(screen.getAllByText('Coatings')[0]);

      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ applications: ['Coatings'] })
        );
      });
    });
  });
});
