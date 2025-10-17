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
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      error: 'Failed to load products',
    });

    render(<ProductBrowser />);

    expect(screen.getByText('Failed to load products')).toBeInTheDocument();
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
