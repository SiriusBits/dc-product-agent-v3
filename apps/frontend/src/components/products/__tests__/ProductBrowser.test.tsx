/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductBrowser from '../ProductBrowser';
// ProductSummary type is used implicitly in mockProducts

// Mock the hooks using importOriginal pattern for partial mocking
vi.mock('@/hooks/useProducts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useProducts')>();
  return {
    ...actual,
    useProducts: vi.fn(),
    useProductDetail: vi.fn(),
    useProductFilters: vi.fn(),
    useProductComparison: vi.fn(),
  };
});

vi.mock('@/hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import {
  useProducts,
  useProductDetail,
  useProductFilters,
} from '@/hooks/useProducts';
import { useApi } from '@/hooks/useApi';
import { ApiError } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';

const mockUseProducts = vi.mocked(useProducts);
const mockUseProductDetail = vi.mocked(useProductDetail);
const mockUseProductFilters = vi.mocked(useProductFilters);
const mockUseApi = vi.mocked(useApi);

describe('ProductBrowser', () => {
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
    mockUseProducts.mockReturnValue(mockProductsHook);
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

  it('renders product browser with product list', () => {
    render(<ProductBrowser />);

    expect(screen.getByText('Product Catalog')).toBeInTheDocument();
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(screen.getByText('DCA 467')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<ProductBrowser />);

    expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    render(<ProductBrowser />);

    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Application')).toBeInTheDocument();
  });

  it('performs search when search input changes', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'ASA');

    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        family: undefined,
        applications: [],
      });
    });
  });

  it('filters products by family', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const familySelect = screen.getByRole('combobox', { name: /family/i });
    await user.click(familySelect);

    const asaOption = screen.getAllByText('ASA')[0];
    await user.click(asaOption);

    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          family: 'ASA',
          applications: [],
        })
      );
    });
  });

  it('filters products by application', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const applicationSelect = screen.getByRole('combobox', {
      name: /application/i,
    });
    await user.click(applicationSelect);

    const coatingsOption = screen.getAllByText('Coatings')[0];
    await user.click(coatingsOption);

    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          applications: ['Coatings'],
        })
      );
    });
  });

  it('displays product cards with correct information', () => {
    render(<ProductBrowser />);

    // Check ASA 150 card
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(
      screen.getByText('Alkenyl Succinic Anhydride 150')
    ).toBeInTheDocument();
    expect(screen.getAllByText('ASA')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Coatings')[0]).toBeInTheDocument();
    expect(screen.getByText('Adhesives')).toBeInTheDocument();

    // Check DCA 467 card
    expect(screen.getByText('DCA 467')).toBeInTheDocument();
    expect(screen.getByText('Dicyandiamide 467')).toBeInTheDocument();
    expect(screen.getByText('DCA')).toBeInTheDocument();
    expect(screen.getByText('Epoxy Curing')).toBeInTheDocument();
  });

  it('navigates to product detail when card is clicked', async () => {
    const user = userEvent.setup();

    // Mock window.location.href since we're using Astro routing
    const mockLocation = { ...window.location, href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    render(<ProductBrowser />);

    const productCard = screen.getByText('ASA 150').closest('div');
    await user.click(productCard!);

    expect(window.location.href).toBe('/products/asa-150');
  });

  it('shows loading state', () => {
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      loading: true,
      products: [], // Need empty products array for loading state to show
    });

    render(<ProductBrowser />);

    expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const mockError = new ApiError('Failed to load products', 500);
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      error: mockError,
    });

    render(<ProductBrowser />);

    expect(screen.getByTestId('api-error-display')).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
  });

  // New tests for conditional rendering logic (Requirements 2.1, 2.2, 2.3)
  describe('Conditional rendering logic', () => {
    it('shows only error state when error exists', () => {
      const mockError = new ApiError('Network error', 0); // Network error
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: mockError,
        loading: true, // Even with loading=true, error should take precedence
        products: mockProducts, // Even with products, error should take precedence
      });

      render(<ProductBrowser />);

      // Should show error
      expect(screen.getByTestId('api-error-display')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toBeInTheDocument();

      // Should NOT show loading or product list
      expect(
        screen.queryByTestId('product-loading-spinner')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('ASA 150')).not.toBeInTheDocument();
    });

    it('shows only loading state when loading and no products exist', () => {
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        loading: true,
        products: [], // No products
        error: null,
      });

      render(<ProductBrowser />);

      // Should show loading
      expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();

      // Should NOT show error or product list
      expect(screen.queryByTestId('api-error-display')).not.toBeInTheDocument();
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

    it('passes null error to ProductList when error is handled above', () => {
      const mockError = new ApiError('Network error', 0);
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: mockError,
        products: [],
      });

      render(<ProductBrowser />);

      // Error should be handled by ApiErrorDisplay, not passed to ProductList
      expect(screen.getByTestId('api-error-display')).toBeInTheDocument();

      // ProductList should not be rendered when there's an error
      expect(screen.queryByTestId('product-list')).not.toBeInTheDocument();
    });
  });

  // New tests for ApiErrorDisplay integration (Requirements 2.2, 2.3)
  describe('ApiErrorDisplay integration', () => {
    it('displays error with retry functionality', () => {
      const mockRetry = vi.fn();
      const mockError = new ApiError('Network error', 0); // Network error is retryable
      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: mockError,
        retry: mockRetry,
        isRetryable: true,
      });

      render(<ProductBrowser />);

      expect(screen.getByTestId('api-error-display')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('calls searchProducts when retry is clicked', async () => {
      const user = userEvent.setup();
      const mockRetry = vi.fn();
      const mockSearchProducts = vi.fn();
      const mockError = new ApiError('Network error', 0);

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        error: mockError,
        retry: mockRetry,
        isRetryable: true,
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

  it('shows empty state when no products found', () => {
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      products: [],
    });

    render(<ProductBrowser />);

    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    // Apply some filters first
    const familySelect = screen.getByRole('combobox', { name: /family/i });
    await user.click(familySelect);
    await user.click(screen.getAllByText('ASA')[0]);

    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
        query: '',
        family: undefined,
        applications: [],
      });
    });
  });

  // New tests for ProductFilters clear functionality (Requirements 2.4)
  describe('ProductFilters clear functionality', () => {
    it('passes empty object when clearing filters instead of default values', async () => {
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
      });

      render(<ProductBrowser />);

      // Apply some filters first
      const familySelect = screen.getByRole('combobox', { name: /family/i });
      await user.click(familySelect);
      await user.click(screen.getAllByText('ASA')[0]);

      // Clear the mock calls from filter application
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

    it('accepts clearing flag parameter in handleFiltersChange', async () => {
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn();

      mockUseProducts.mockReturnValue({
        ...mockProductsHook,
        searchProducts: mockSearchProducts,
      });

      render(<ProductBrowser />);

      // Apply a filter first
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

      // Clear filters - this should call handleFiltersChange with clearing flag
      const clearButton = screen.getByRole('button', {
        name: /clear filters/i,
      });
      await user.click(clearButton);

      await waitFor(() => {
        // Should pass empty object when clearing
        expect(mockSearchProducts).toHaveBeenCalledWith({});
      });
    });
  });

  it('displays product count', () => {
    render(<ProductBrowser />);

    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const searchInput = screen.getByPlaceholderText(/search products/i);
    searchInput.focus();

    // Tab to family filter
    await user.keyboard('{Tab}');
    expect(screen.getByRole('combobox', { name: /family/i })).toHaveFocus();

    // Tab to application filter
    await user.keyboard('{Tab}');
    expect(
      screen.getByRole('combobox', { name: /application/i })
    ).toHaveFocus();
  });

  it('handles search debouncing', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const searchInput = screen.getByPlaceholderText(/search products/i);

    // Type quickly
    await user.type(searchInput, 'ASA');

    // Should debounce and only call once after delay
    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves search state when navigating back', () => {
    // Mock URL search params
    Object.defineProperty(window, 'location', {
      value: {
        search: '?q=ASA&family=ASA',
      },
      writable: true,
    });

    render(<ProductBrowser />);

    const searchInput = screen.getByPlaceholderText(
      /search products/i
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('ASA');
  });

  it('displays product properties in cards', () => {
    render(<ProductBrowser />);

    expect(screen.getByText('Viscosity: 150 cP')).toBeInTheDocument();
    expect(screen.getByText('Melting Point: 200°C')).toBeInTheDocument();
  });

  it('shows product benefits', () => {
    render(<ProductBrowser />);

    expect(screen.getByText('High viscosity')).toBeInTheDocument();
    expect(screen.getByText('Good adhesion')).toBeInTheDocument();
    expect(screen.getByText('Fast cure')).toBeInTheDocument();
    expect(screen.getByText('High strength')).toBeInTheDocument();
  });

  it('supports sorting products', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    await user.click(sortSelect);

    const nameOption = screen.getByText('Name');
    await user.click(nameOption);

    // Should trigger re-search with sort parameter
    await waitFor(() => {
      expect(mockProductsHook.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'name',
        })
      );
    });
  });

  it('supports grid and list view toggle', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const listViewButton = screen.getByRole('button', { name: /list view/i });
    await user.click(listViewButton);

    expect(screen.getByTestId('product-list-view')).toBeInTheDocument();

    const gridViewButton = screen.getByRole('button', { name: /grid view/i });
    await user.click(gridViewButton);

    expect(screen.getByTestId('product-grid-view')).toBeInTheDocument();
  });

  it('handles pagination for large product lists', async () => {
    const user = userEvent.setup();

    // Mock large product list
    const manyProducts = Array.from({ length: 50 }, (_, i) => ({
      ...mockProducts[0],
      id: `product-${i}`,
      name: `Product ${i}`,
    }));

    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      products: manyProducts,
      totalCount: 100,
      hasMore: true,
      loading: false,
      facets: null,
    });

    render(<ProductBrowser />);

    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextPageButton);

    expect(mockProductsHook.loadMore).toHaveBeenCalled();
  });

  it('shows comparison checkbox for products', () => {
    render(<ProductBrowser />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('enables compare button when products are selected', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);

    const compareButton = screen.getByRole('button', { name: /compare/i });
    expect(compareButton).not.toBeDisabled();
  });
});
