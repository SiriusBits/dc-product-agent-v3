/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductBrowser from '@/components/products/ProductBrowser';
import type { ProductSummary } from '@repo/shared-types';
import {
  render,
  setupTest,
  cleanupTest,
  mockApiClient,
  mockNavigate,
} from '@/test/test-utils';

// Mock the useProducts hook directly
const mockUseProducts = vi.fn();
const mockUseProductDetail = vi.fn();
const mockUseProductFilters = vi.fn();

vi.mock('@/hooks/useProducts', () => ({
  useProducts: () => mockUseProducts(),
  useProductDetail: () => mockUseProductDetail(),
  useProductFilters: () => mockUseProductFilters(),
}));

describe('Product Search Integration', () => {
  const mockProducts: ProductSummary[] = [
    {
      id: 'asa-150',
      name: 'ASA 150',
      short_name: 'ASA150',
      family: 'ASA',
      cas_number: '12345-67-8',
      applications: ['Coatings', 'Adhesives', 'Sealants'],
      key_properties: ['Viscosity: 150 cP', 'Specific Gravity: 1.05 g/cm³'],
      document_count: 1,
    },
    {
      id: 'asa-140',
      name: 'ASA 140',
      short_name: 'ASA140',
      family: 'ASA',
      cas_number: '12345-67-9',
      applications: ['Coatings', 'Adhesives'],
      key_properties: ['Viscosity: 140 cP'],
      document_count: 1,
    },
    {
      id: 'dca-467',
      name: 'DCA 467',
      short_name: 'DCA467',
      family: 'DCA',
      cas_number: '98765-43-2',
      applications: ['Epoxy Curing', 'Powder Coatings'],
      key_properties: ['Melting Point: 200°C'],
      document_count: 1,
    },
  ];

  const mockFamilies = ['ASA', 'DCA', 'ECA'];
  const mockApplications = [
    'Coatings',
    'Adhesives',
    'Sealants',
    'Epoxy Curing',
    'Powder Coatings',
  ];

  const createDefaultMockSearchProducts = () =>
    vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    setupTest();

    // Reset mock implementations for each test
    mockUseProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: createDefaultMockSearchProducts(),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    mockUseProductDetail.mockReturnValue({
      product: null,
      relatedProducts: [],
      loading: false,
      error: null,
      loadProduct: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    mockUseProductFilters.mockReturnValue({
      families: mockFamilies,
      applications: mockApplications,
      loading: false,
      error: null,
      loadFilters: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });
  });

  afterEach(() => {
    cleanupTest();
    vi.clearAllMocks();
  });

  it('displays products correctly', async () => {
    render(<ProductBrowser />);

    // Wait for products to be displayed
    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Verify all products are displayed
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(screen.getByText('ASA 140')).toBeInTheDocument();
    expect(screen.getByText('DCA 467')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    const mockSearchProducts = createDefaultMockSearchProducts();

    mockUseProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: mockSearchProducts,
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Find and use search input
    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'ASA');

    // Wait for search to be called
    await waitFor(
      () => {
        expect(mockSearchProducts).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it('handles filter functionality', async () => {
    const user = userEvent.setup();
    const mockSearchProducts = createDefaultMockSearchProducts();

    mockUseProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: mockSearchProducts,
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Test family filter
    const familySelect = screen.getByRole('combobox', { name: /family/i });
    await user.click(familySelect);

    // Wait for options and select ASA - find the option in the dropdown
    await waitFor(() => {
      const asaOptions = screen.getAllByText('ASA');
      // Find the option that's in a button (dropdown option)
      const asaOption = asaOptions.find(
        (option) => option.closest('button')?.getAttribute('type') === 'button'
      );
      if (asaOption) {
        return user.click(asaOption);
      }
      throw new Error('ASA option not found');
    });

    // Verify search was called
    await waitFor(
      () => {
        expect(mockSearchProducts).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it('handles product comparison', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Select products for comparison
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Compare button should be enabled
    const compareButton = screen.getByRole('button', { name: /compare/i });
    expect(compareButton).not.toBeDisabled();

    await user.click(compareButton);
    expect(compareButton).toBeInTheDocument();
  });

  it('handles view mode switching', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Switch to list view
    const listViewButton = screen.getByRole('button', { name: /list view/i });
    await user.click(listViewButton);

    expect(screen.getByTestId('product-list-view')).toBeInTheDocument();

    // Switch back to grid view
    const gridViewButton = screen.getByRole('button', { name: /grid view/i });
    await user.click(gridViewButton);

    expect(screen.getByTestId('product-grid-view')).toBeInTheDocument();
  });

  it('handles product detail navigation', async () => {
    const user = userEvent.setup();

    // Mock window.location.href assignment
    const originalLocation = window.location;
    delete (window as unknown).location;
    window.location = { ...originalLocation, href: '' };

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Click on product card
    const productCard = screen.getByText('ASA 150').closest('.cursor-pointer');
    expect(productCard).toBeInTheDocument();

    await user.click(productCard!);

    // Verify navigation was attempted
    expect(window.location.href).toBe('/products/asa-150');

    // Restore original location
    window.location = originalLocation;
  });

  it('handles empty search results', async () => {
    mockUseProducts.mockReturnValue({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: null,
      searchProducts: createDefaultMockSearchProducts(),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });
  });

  it('handles error states', async () => {
    mockUseProducts.mockReturnValue({
      products: [],
      totalCount: 0,
      facets: null,
      loading: false,
      error: 'Search failed',
      searchProducts: createDefaultMockSearchProducts(),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: true,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('handles pagination', async () => {
    const user = userEvent.setup();
    const mockLoadMore = vi.fn().mockResolvedValue(undefined);

    const manyProducts = Array.from({ length: 50 }, (_, i) => ({
      ...mockProducts[0],
      id: `product-${i}`,
      name: `Product ${i}`,
      short_name: `Product${i}`,
    }));

    mockUseProducts.mockReturnValue({
      products: manyProducts.slice(0, 20),
      totalCount: 50,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: createDefaultMockSearchProducts(),
      loadMore: mockLoadMore,
      hasMore: true,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Product 0')).toBeInTheDocument();
    });

    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextPageButton);

    expect(mockLoadMore).toHaveBeenCalled();
  });

  it('displays product properties and applications', async () => {
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Verify properties are displayed
    expect(screen.getByText('Viscosity: 150 cP')).toBeInTheDocument();
    expect(
      screen.getByText('Specific Gravity: 1.05 g/cm³')
    ).toBeInTheDocument();

    // Verify applications are displayed (use getAllByText for multiple instances)
    expect(screen.getAllByText('Coatings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Adhesives').length).toBeGreaterThan(0);
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Tab through interface elements
    const searchInput = screen.getByPlaceholderText(/search products/i);
    searchInput.focus();

    await user.keyboard('{Tab}');
    expect(screen.getByRole('combobox', { name: /family/i })).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(
      screen.getByRole('combobox', { name: /application/i })
    ).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(screen.getByRole('combobox', { name: /sort by/i })).toHaveFocus();
  });

  it('handles sorting options', async () => {
    const user = userEvent.setup();
    const mockSearchProducts = createDefaultMockSearchProducts();

    mockUseProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: mockSearchProducts,
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Change sort order
    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    await user.click(sortSelect);

    const nameOption = screen.getByText('Name');
    await user.click(nameOption);

    await waitFor(
      () => {
        expect(mockSearchProducts).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it('handles clear filters functionality', async () => {
    const user = userEvent.setup();
    const mockSearchProducts = createDefaultMockSearchProducts();

    mockUseProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      facets: {
        families: mockFamilies.map((f) => ({ value: f, count: 1 })),
        applications: mockApplications.map((a) => ({ value: a, count: 1 })),
        manufacturers: [],
        properties: [],
      },
      loading: false,
      error: null,
      searchProducts: mockSearchProducts,
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      retry: vi.fn().mockResolvedValue(undefined),
      isRetryable: false,
    });

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Add some filters first
    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'test');

    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearButton);

    await waitFor(
      () => {
        expect(mockSearchProducts).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });
});
