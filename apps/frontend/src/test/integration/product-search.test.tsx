/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductBrowser } from '@/components/products/ProductBrowser';
import type { Product, ProductFamily } from '@/types';
import { 
  render, 
  setupTest, 
  cleanupTest, 
  mockApiClient,
  mockSetSearchParams,
  createMockProduct 
} from '@/test/test-utils';

const mockApiClient = vi.mocked(apiClient);

describe('Product Search Integration', () => {
  const mockProducts: Product[] = [
    {
      id: 'asa-150',
      name: 'ASA 150',
      shortName: 'ASA150',
      family: 'ASA' as ProductFamily,
      casNumber: '12345-67-8',
      chemicalName: 'Alkenyl Succinic Anhydride 150',
      synonyms: ['ASA-150', 'Alkenyl Succinic Anhydride 150'],
      properties: [
        {
          category: 'Physical',
          name: 'Viscosity',
          valueString: '150 cP',
          valueNumeric: 150,
          unit: 'cP',
          testMethod: 'ASTM D445',
        },
        {
          category: 'Physical',
          name: 'Specific Gravity',
          valueString: '1.05',
          valueNumeric: 1.05,
          unit: 'g/cm³',
          testMethod: 'ASTM D792',
        },
      ],
      applications: ['Coatings', 'Adhesives', 'Sealants'],
      keyBenefits: ['High viscosity', 'Good adhesion', 'Chemical resistance'],
    },
    {
      id: 'asa-140',
      name: 'ASA 140',
      shortName: 'ASA140',
      family: 'ASA' as ProductFamily,
      casNumber: '12345-67-9',
      chemicalName: 'Alkenyl Succinic Anhydride 140',
      synonyms: ['ASA-140'],
      properties: [
        {
          category: 'Physical',
          name: 'Viscosity',
          valueString: '140 cP',
          valueNumeric: 140,
          unit: 'cP',
          testMethod: 'ASTM D445',
        },
      ],
      applications: ['Coatings', 'Adhesives'],
      keyBenefits: ['Medium viscosity', 'Good flow'],
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
      applications: ['Epoxy Curing', 'Powder Coatings'],
      keyBenefits: ['Fast cure', 'High strength', 'Low temperature cure'],
    },
  ];

  const mockFamilies: ProductFamily[] = ['ASA', 'DCA', 'ECA'];
  const mockApplications = ['Coatings', 'Adhesives', 'Sealants', 'Epoxy Curing', 'Powder Coatings'];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default API responses
    mockApiClient.getProducts.mockResolvedValue(mockProducts);
    mockApiClient.getProductFamilies.mockResolvedValue(mockFamilies);
    mockApiClient.getApplications.mockResolvedValue(mockApplications);
    mockApiClient.searchProducts.mockResolvedValue(mockProducts);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('completes full product search workflow', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    // 1. Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // 2. Verify all products are displayed initially
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(screen.getByText('ASA 140')).toBeInTheDocument();
    expect(screen.getByText('DCA 467')).toBeInTheDocument();

    // 3. Perform text search
    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'ASA');

    // Mock search results for ASA
    const asaProducts = mockProducts.filter(p => p.name.includes('ASA'));
    mockApiClient.searchProducts.mockResolvedValue(asaProducts);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        families: undefined,
        applications: undefined,
      });
    });

    // 4. Verify search results
    expect(screen.getByText('ASA 150')).toBeInTheDocument();
    expect(screen.getByText('ASA 140')).toBeInTheDocument();
    expect(screen.queryByText('DCA 467')).not.toBeInTheDocument();
  });

  it('handles advanced filtering workflow', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // 1. Filter by family
    const familySelect = screen.getByRole('combobox', { name: /family/i });
    await user.click(familySelect);
    
    const asaOption = screen.getByText('ASA');
    await user.click(asaOption);

    // Mock filtered results
    const asaProducts = mockProducts.filter(p => p.family === 'ASA');
    mockApiClient.searchProducts.mockResolvedValue(asaProducts);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: '',
        families: ['ASA'],
        applications: undefined,
      });
    });

    // 2. Add application filter
    const applicationSelect = screen.getByRole('combobox', { name: /application/i });
    await user.click(applicationSelect);
    
    const coatingsOption = screen.getByText('Coatings');
    await user.click(coatingsOption);

    // Mock results with both filters
    const filteredProducts = mockProducts.filter(p => 
      p.family === 'ASA' && p.applications.includes('Coatings')
    );
    mockApiClient.searchProducts.mockResolvedValue(filteredProducts);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: '',
        families: ['ASA'],
        applications: ['Coatings'],
      });
    });

    // 3. Clear filters
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    await user.click(clearButton);

    mockApiClient.searchProducts.mockResolvedValue(mockProducts);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: '',
        families: [],
        applications: [],
      });
    });
  });

  it('handles product comparison workflow', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // 1. Select products for comparison
    const checkboxes = screen.getAllByRole('checkbox');
    
    // Select first two products
    await user.click(checkboxes[0]); // ASA 150
    await user.click(checkboxes[1]); // ASA 140

    // 2. Compare button should be enabled
    const compareButton = screen.getByRole('button', { name: /compare/i });
    expect(compareButton).not.toBeDisabled();

    // 3. Click compare
    const comparisonData = [mockProducts[0], mockProducts[1]];
    mockApiClient.compareProducts.mockResolvedValue(comparisonData);

    await user.click(compareButton);

    expect(mockApiClient.compareProducts).toHaveBeenCalledWith(['asa-150', 'asa-140']);

    // 4. Verify comparison view (this would navigate to comparison page in real app)
    // For now, just verify the API was called
    expect(mockApiClient.compareProducts).toHaveBeenCalled();
  });

  it('handles sorting and view options', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // 1. Change sort order
    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    await user.click(sortSelect);

    const nameOption = screen.getByText('Name (A-Z)');
    await user.click(nameOption);

    mockApiClient.searchProducts.mockResolvedValue(mockProducts);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: '',
        families: undefined,
        applications: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    // 2. Switch to list view
    const listViewButton = screen.getByRole('button', { name: /list view/i });
    await user.click(listViewButton);

    expect(screen.getByTestId('product-list-view')).toBeInTheDocument();

    // 3. Switch back to grid view
    const gridViewButton = screen.getByRole('button', { name: /grid view/i });
    await user.click(gridViewButton);

    expect(screen.getByTestId('product-grid-view')).toBeInTheDocument();
  });

  it('handles product detail navigation', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    
    // Navigation is already mocked in setupTest

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Click on product card
    const productCard = screen.getByText('ASA 150').closest('[data-testid="product-card"]');
    await user.click(productCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/products/asa-150');
  });

  it('handles search with no results', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Search for non-existent product
    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'NonExistentProduct');

    // Mock empty results
    mockApiClient.searchProducts.mockResolvedValue([]);

    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });

    // Verify search was called
    expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
      query: 'NonExistentProduct',
      families: undefined,
      applications: undefined,
    });
  });

  it('handles error states during search', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Mock search error
    mockApiClient.searchProducts.mockRejectedValue(new Error('Search failed'));

    const searchInput = screen.getByPlaceholderText(/search products/i);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('handles pagination for large result sets', async () => {
    const user = userEvent.setup();
    
    // Mock large product set
    const manyProducts = Array.from({ length: 50 }, (_, i) => ({
      ...mockProducts[0],
      id: `product-${i}`,
      name: `Product ${i}`,
    }));

    mockApiClient.getProducts.mockResolvedValue(manyProducts.slice(0, 20));
    
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Product 0')).toBeInTheDocument();
    });

    // Mock pagination response
    mockApiClient.searchProducts.mockResolvedValue(manyProducts.slice(20, 40));

    // Click next page
    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextPageButton);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: '',
        families: undefined,
        applications: undefined,
        page: 2,
        limit: 20,
      });
    });
  });

  it('handles search debouncing', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers();

    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search products/i);

    // Type rapidly
    await user.type(searchInput, 'A');
    await user.type(searchInput, 'S');
    await user.type(searchInput, 'A');

    // Fast-forward time to trigger debounced search
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockApiClient.searchProducts).toHaveBeenCalledTimes(1);
      expect(mockApiClient.searchProducts).toHaveBeenCalledWith({
        query: 'ASA',
        families: undefined,
        applications: undefined,
      });
    });

    vi.useRealTimers();
  });

  it('preserves search state in URL', async () => {
    const user = userEvent.setup();
    const mockSetSearchParams = vi.fn();
    
    // Search params are already mocked in setupTest
    mockSetSearchParams.mockClear();

    render(<ProductBrowser />);

    // Should initialize with URL parameters
    const searchInput = screen.getByPlaceholderText(/search products/i) as HTMLInputElement;
    expect(searchInput.value).toBe('ASA');

    // Perform new search
    await user.clear(searchInput);
    await user.type(searchInput, 'DCA');

    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({ q: 'DCA' });
    });
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

    await user.keyboard('{Tab}'); // Family filter
    expect(screen.getByRole('combobox', { name: /family/i })).toHaveFocus();

    await user.keyboard('{Tab}'); // Application filter
    expect(screen.getByRole('combobox', { name: /application/i })).toHaveFocus();

    await user.keyboard('{Tab}'); // Sort select
    expect(screen.getByRole('combobox', { name: /sort by/i })).toHaveFocus();
  });

  it('handles product property display and filtering', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    // Verify properties are displayed
    expect(screen.getByText('Viscosity: 150 cP')).toBeInTheDocument();
    expect(screen.getByText('Specific Gravity: 1.05 g/cm³')).toBeInTheDocument();

    // Verify applications are displayed
    expect(screen.getByText('Coatings')).toBeInTheDocument();
    expect(screen.getByText('Adhesives')).toBeInTheDocument();

    // Verify benefits are displayed
    expect(screen.getByText('High viscosity')).toBeInTheDocument();
    expect(screen.getByText('Good adhesion')).toBeInTheDocument();
  });

  it('handles concurrent search requests', async () => {
    const user = userEvent.setup();
    render(<ProductBrowser />);

    await waitFor(() => {
      expect(screen.getByText('ASA 150')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search products/i);

    // Start multiple searches quickly
    await user.type(searchInput, 'A');
    await user.type(searchInput, 'S');
    await user.type(searchInput, 'A');

    // Clear and type different search
    await user.clear(searchInput);
    await user.type(searchInput, 'DCA');

    // Should handle the race condition and show latest results
    mockApiClient.searchProducts.mockResolvedValue([mockProducts[2]]); // DCA 467

    await waitFor(() => {
      expect(screen.getByText('DCA 467')).toBeInTheDocument();
    });
  });
});