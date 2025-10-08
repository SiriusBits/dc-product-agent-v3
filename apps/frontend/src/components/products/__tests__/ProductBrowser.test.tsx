/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductBrowser } from '../ProductBrowser';
import type { Product, ProductFamily } from '@/types';

// Mock the hooks
vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/hooks/useApi', () => ({
  useApi: vi.fn(),
}));

import { useProducts } from '@/hooks/useProducts';
import { useApi } from '@/hooks/useApi';

const mockUseProducts = vi.mocked(useProducts);
const mockUseApi = vi.mocked(useApi);

describe('ProductBrowser', () => {
  const mockProducts: Product[] = [
    {
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
    },
    {
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
    },
  ];

  const mockProductsHook = {
    products: mockProducts,
    isLoading: false,
    error: null,
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    families: ['ASA', 'DCA', 'ECA'] as ProductFamily[],
    applications: ['Coatings', 'Adhesives', 'Epoxy Curing'],
  };

  beforeEach(() => {
    mockUseProducts.mockReturnValue(mockProductsHook);
    mockUseApi.mockReturnValue({
      isLoading: false,
      error: null,
      execute: vi.fn(),
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
        families: [],
        applications: [],
      });
    });
  });

  it('filters products by family', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const familySelect = screen.getByRole('combobox', { name: /family/i });
    await user.click(familySelect);

    const asaOption = screen.getByText('ASA');
    await user.click(asaOption);

    expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: ['ASA'],
      applications: [],
    });
  });

  it('filters products by application', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const applicationSelect = screen.getByRole('combobox', { name: /application/i });
    await user.click(applicationSelect);

    const coatingsOption = screen.getByText('Coatings');
    await user.click(coatingsOption);

    expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: [],
      applications: ['Coatings'],
    });
  });

  it('displays product cards with correct information', () => {
    render(<ProductBrowser />);

    // Check ASA 150 card
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(screen.getByText('Alkenyl Succinic Anhydride 150')).toBeInTheDocument();
    expect(screen.getByText('ASA')).toBeInTheDocument();
    expect(screen.getByText('Coatings')).toBeInTheDocument();
    expect(screen.getByText('Adhesives')).toBeInTheDocument();

    // Check DCA 467 card
    expect(screen.getByText('DCA 467')).toBeInTheDocument();
    expect(screen.getByText('Dicyandiamide 467')).toBeInTheDocument();
    expect(screen.getByText('DCA')).toBeInTheDocument();
    expect(screen.getByText('Epoxy Curing')).toBeInTheDocument();
  });

  it('navigates to product detail when card is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    
    // Mock navigation
    vi.mock('react-router-dom', () => ({
      useNavigate: () => mockNavigate,
    }));

    render(<ProductBrowser />);

    const productCard = screen.getByText('ASA 150').closest('div');
    await user.click(productCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/products/asa-150');
  });

  it('shows loading state', () => {
    mockUseProducts.mockReturnValue({
      ...mockProductsHook,
      isLoading: true,
    });

    render(<ProductBrowser />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
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
    await user.click(screen.getByText('ASA'));

    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearButton);

    expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: [],
      applications: [],
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
    expect(screen.getByRole('combobox', { name: /application/i })).toHaveFocus();
  });

  it('handles search debouncing', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    const searchInput = screen.getByPlaceholderText(/search products/i);
    
    // Type quickly
    await user.type(searchInput, 'ASA', { delay: 50 });

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

    const searchInput = screen.getByPlaceholderText(/search products/i) as HTMLInputElement;
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

    const nameOption = screen.getByText('Name (A-Z)');
    await user.click(nameOption);

    // Should trigger re-search with sort parameter
    expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: [],
      applications: [],
      sortBy: 'name',
      sortOrder: 'asc',
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
      currentPage: 1,
      totalPages: 4,
    });

    render(<ProductBrowser />);

    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextPageButton);

    expect(mockProductsHook.searchProducts).toHaveBeenCalledWith({
      query: '',
      families: [],
      applications: [],
      page: 2,
    });
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