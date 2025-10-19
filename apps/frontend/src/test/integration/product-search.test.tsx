/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductBrowser from '@/components/products/ProductBrowser';
import {
  setupTest,
  typeIntoInput,
  createMockUseProductsReturn,
  createMockProduct,
  createMockProducts,
  createMockSearchFacets,
  render,
} from '@/test';

// Mock the useProducts hooks
vi.mock('@/hooks/useProducts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useProducts: vi.fn(),
    useProductDetail: vi.fn(),
    useProductFilters: vi.fn(),
  };
});

import {
  useProducts,
  useProductDetail,
  useProductFilters,
} from '@/hooks/useProducts';

describe('Product Search Integration', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest({
      enableAutoCleanup: true,
      mockSessionStorage: true,
      initialProducts: [],
      productsLoading: false,
    });

    // Setup default mock returns using reactive mocks
    vi.mocked(useProducts).mockImplementation(
      testContext.productsMock.getMock()
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
  });

  // ============================================================================
  // 6.1 Focused Product Rendering Tests
  // ============================================================================

  describe('Product Rendering', () => {
    it('renders ProductBrowser with empty products', async () => {
      // Arrange: Setup mock with empty products (already set by default)
      await testContext.updateProducts({
        products: [],
        totalCount: 0,
        facets: null,
        loading: false,
        error: null,
      });

      // Act: Render component
      const { getByTestId, getByText } = testContext.renderComponent(
        <ProductBrowser />
      );

      // Assert: Verify component renders and shows empty state
      expect(getByTestId('product-browser')).toBeInTheDocument();
      expect(getByText('Product Browser')).toBeInTheDocument();

      // Wait for empty state to appear
      await waitFor(() => {
        expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      });
    });

    it('renders ProductBrowser with multiple products', async () => {
      // Arrange: Setup mock with multiple products
      const mockProducts = createMockProducts(3, {
        family: 'ASA',
        applications: ['Coatings', 'Adhesives'],
      });
      mockProducts[0].name = 'ASA 150';
      mockProducts[1].name = 'ASA 140';
      mockProducts[2].name = 'DCA 467';

      await testContext.updateProducts({
        products: mockProducts,
        totalCount: 3,
        facets: createMockSearchFacets(),
        loading: false,
        error: null,
      });

      // Act: Render component
      const { getByText, getByTestId } = testContext.renderComponent(
        <ProductBrowser />
      );

      // Assert: Verify all products are displayed
      await waitFor(() => {
        expect(getByText('ASA 150')).toBeInTheDocument();
      });

      expect(getByText('ASA 140')).toBeInTheDocument();
      expect(getByText('DCA 467')).toBeInTheDocument();
      expect(getByTestId('product-list')).toBeInTheDocument();
    });

    it('displays product count correctly', async () => {
      // Arrange: Setup mock with specific product count
      const mockProducts = createMockProducts(5);
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 25, // More than displayed to test count display
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify product count is displayed
      await waitFor(() => {
        expect(screen.getByText('25 products')).toBeInTheDocument();
      });
    });

    it('renders product properties and applications', async () => {
      // Arrange: Setup mock with products containing specific properties
      const mockProduct = createMockProduct({
        name: 'Test Product',
        applications: ['Coatings', 'Adhesives'],
        key_properties: ['Viscosity: 150 cP', 'Specific Gravity: 1.05 g/cm³'],
      });

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [mockProduct],
          totalCount: 1,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify properties and applications are displayed
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      expect(screen.getByText('Viscosity: 150 cP')).toBeInTheDocument();
      expect(
        screen.getByText('Specific Gravity: 1.05 g/cm³')
      ).toBeInTheDocument();
      expect(screen.getByText('Coatings')).toBeInTheDocument();
      expect(screen.getByText('Adhesives')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.2 Product Search Tests
  // ============================================================================

  describe('Product Search', () => {
    it('search input is accessible and functional', async () => {
      // Arrange: Setup mock with products
      const mockProducts = createMockProducts(2);
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 2,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify search input is accessible
      const searchInput = screen.getByPlaceholderText(/search products/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('type', 'text');

      // Verify input is focusable and interactive
      searchInput.focus();
      expect(searchInput).toHaveFocus();
    });

    it('typing in search calls setSearchTerm', async () => {
      // Arrange: Setup mock with spy on searchProducts
      const mockSearchProducts = vi.fn().mockResolvedValue(undefined);
      const mockProducts = createMockProducts(2);

      await testContext.updateProducts({
        products: mockProducts,
        totalCount: 2,
        facets: createMockSearchFacets(),
        loading: false,
        error: null,
        searchProducts: mockSearchProducts,
      });

      const { getByPlaceholderText } = testContext.renderComponent(
        <ProductBrowser />
      );

      // Act: Type in search input using enhanced input utility
      const searchInput = getByPlaceholderText(/search products/i);
      await typeIntoInput(searchInput, 'ASA');

      // Assert: Verify searchProducts was called with search term
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalled();
      });

      // Verify the search was called with query parameter
      const lastCall =
        mockSearchProducts.mock.calls[mockSearchProducts.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({
          query: 'ASA',
        })
      );
    });

    it('search term updates trigger product filtering', async () => {
      // Arrange: Setup mock that changes products based on search
      const user = userEvent.setup();
      const allProducts = createMockProducts(5);
      const filteredProducts = createMockProducts(2, { name: 'ASA Product' });

      let currentProducts = allProducts;
      const mockSearchProducts = vi.fn().mockImplementation((params) => {
        // Simulate filtering based on query
        if (params.query === 'ASA') {
          currentProducts = filteredProducts;
        } else {
          currentProducts = allProducts;
        }
      });

      // Mock that returns different products based on search
      vi.mocked(useProducts).mockImplementation(() =>
        createMockUseProductsReturn({
          products: currentProducts,
          totalCount: currentProducts.length,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Search for 'ASA'
      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'ASA');

      // Assert: Verify search was triggered
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'ASA' })
        );
      });
    });

    it('handles empty search results', async () => {
      // Arrange: Setup mock with empty search results
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn().mockResolvedValue(undefined);

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Perform search
      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'nonexistent');

      // Assert: Verify empty state is shown
      await waitFor(() => {
        expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // 6.3 Product Filter Tests
  // ============================================================================

  describe('Product Filters', () => {
    it('filter controls are accessible', async () => {
      // Arrange: Setup mock with products and facets
      const mockProducts = createMockProducts(3);
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 3,
          facets: createMockSearchFacets({
            families: [
              { value: 'ASA', count: 2 },
              { value: 'DCA', count: 1 },
            ],
            applications: [
              { value: 'Coatings', count: 2 },
              { value: 'Adhesives', count: 1 },
            ],
          }),
          loading: false,
          error: null,
        })
      );

      render(<ProductBrowser />);

      // Assert: Verify filter controls are accessible
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /family/i })
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('combobox', { name: /application/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: /sort by/i })
      ).toBeInTheDocument();

      // Verify filter controls are focusable
      const familySelect = screen.getByRole('combobox', { name: /family/i });
      familySelect.focus();
      expect(familySelect).toHaveFocus();
    });

    it('applying filters calls setFilters', async () => {
      // Arrange: Setup mock with spy on searchProducts
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn().mockResolvedValue(undefined);
      const mockProducts = createMockProducts(3);

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 3,
          facets: createMockSearchFacets({
            families: [
              { value: 'ASA', count: 2 },
              { value: 'DCA', count: 1 },
            ],
          }),
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Apply family filter
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /family/i })
        ).toBeInTheDocument();
      });

      const familySelect = screen.getByRole('combobox', { name: /family/i });
      await user.click(familySelect);

      // Wait for dropdown options and select ASA
      await waitFor(() => {
        const asaOption = screen.getByText('ASA');
        expect(asaOption).toBeInTheDocument();
      });

      const asaOption = screen.getByText('ASA');
      await user.click(asaOption);

      // Assert: Verify searchProducts was called with family filter
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({
            family: 'ASA',
          })
        );
      });
    });

    it('product list updates with filtered results', async () => {
      // Arrange: Setup mock that simulates filtering
      const user = userEvent.setup();
      const allProducts = createMockProducts(5);
      const asaProducts = createMockProducts(2, { family: 'ASA' });
      asaProducts[0].name = 'ASA Product 1';
      asaProducts[1].name = 'ASA Product 2';

      let currentProducts = allProducts;
      const mockSearchProducts = vi.fn().mockImplementation((params) => {
        if (params.family === 'ASA') {
          currentProducts = asaProducts;
        } else {
          currentProducts = allProducts;
        }
      });

      vi.mocked(useProducts).mockImplementation(() =>
        createMockUseProductsReturn({
          products: currentProducts,
          totalCount: currentProducts.length,
          facets: createMockSearchFacets({
            families: [
              { value: 'ASA', count: 2 },
              { value: 'DCA', count: 3 },
            ],
          }),
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Apply family filter
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /family/i })
        ).toBeInTheDocument();
      });

      const familySelect = screen.getByRole('combobox', { name: /family/i });
      await user.click(familySelect);

      await waitFor(() => {
        const asaOption = screen.getByText('ASA');
        expect(asaOption).toBeInTheDocument();
      });

      const asaOption = screen.getByText('ASA');
      await user.click(asaOption);

      // Assert: Verify filter was applied
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({ family: 'ASA' })
        );
      });
    });

    it('handles application filter', async () => {
      // Arrange: Setup mock with application facets
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn().mockResolvedValue(undefined);
      const mockProducts = createMockProducts(3);

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 3,
          facets: createMockSearchFacets({
            applications: [
              { value: 'Coatings', count: 2 },
              { value: 'Adhesives', count: 1 },
            ],
          }),
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Apply application filter
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /application/i })
        ).toBeInTheDocument();
      });

      const applicationSelect = screen.getByRole('combobox', {
        name: /application/i,
      });
      await user.click(applicationSelect);

      await waitFor(() => {
        const coatingsOption = screen.getByText('Coatings');
        expect(coatingsOption).toBeInTheDocument();
      });

      const coatingsOption = screen.getByText('Coatings');
      await user.click(coatingsOption);

      // Assert: Verify searchProducts was called with application filter
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith(
          expect.objectContaining({
            applications: ['Coatings'],
          })
        );
      });
    });

    it('handles clear filters functionality', async () => {
      // Arrange: Setup mock with filters applied
      const user = userEvent.setup();
      const mockSearchProducts = vi.fn().mockResolvedValue(undefined);
      const mockProducts = createMockProducts(3);

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 3,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
          searchProducts: mockSearchProducts,
        })
      );

      render(<ProductBrowser />);

      // Act: Apply a filter first, then clear
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/search products/i)
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'test');

      // Clear filters
      const clearButton = screen.getByRole('button', {
        name: /clear filters/i,
      });
      await user.click(clearButton);

      // Assert: Verify searchProducts was called to clear filters
      await waitFor(() => {
        expect(mockSearchProducts).toHaveBeenCalledWith({});
      });
    });
  });

  // ============================================================================
  // 6.4 Product Loading and Error Tests
  // ============================================================================

  describe('Product Loading and Error States', () => {
    it('loading indicator appears when products are loading', async () => {
      // Arrange: Setup mock with loading state
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: true,
          error: null,
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify loading indicator is displayed
      await waitFor(() => {
        expect(screen.getByTestId('product-loading')).toBeInTheDocument();
      });

      // Verify no products are shown during loading
      expect(screen.queryByTestId('product-list')).not.toBeInTheDocument();
    });

    it('error message displays when error occurs', async () => {
      // Arrange: Setup mock with error state
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: false,
          error: 'Failed to load products',
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByTestId('product-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load products')).toBeInTheDocument();
    });

    it('empty state displays when no products match', async () => {
      // Arrange: Setup mock with empty results (not loading, no error)
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: false,
          error: null,
        })
      );

      // Act: Render component
      render(<ProductBrowser />);

      // Assert: Verify empty state is displayed
      await waitFor(() => {
        expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      });

      // Verify no loading or error states are shown
      expect(screen.queryByTestId('product-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('product-error')).not.toBeInTheDocument();
    });

    it('handles network error with retry functionality', async () => {
      // Arrange: Setup mock with retryable error
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: false,
          error: 'Network error occurred',
          retry: mockRetry,
          isRetryable: true,
        })
      );

      render(<ProductBrowser />);

      // Act: Click retry button
      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      await user.click(retryButton);

      // Assert: Verify retry function was called
      expect(mockRetry).toHaveBeenCalled();
    });

    it('transitions from loading to loaded state', async () => {
      // Arrange: Setup mock that starts loading then loads products
      const mockProducts = createMockProducts(2);

      // Start with loading state
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: true,
          error: null,
        })
      );

      const { rerender } = render(<ProductBrowser />);

      // Assert: Verify loading state
      await waitFor(() => {
        expect(screen.getByTestId('product-loading')).toBeInTheDocument();
      });

      // Act: Update to loaded state
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 2,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
        })
      );

      rerender(<ProductBrowser />);

      // Assert: Verify loaded state
      await waitFor(() => {
        expect(screen.queryByTestId('product-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-list')).toBeInTheDocument();
    });

    it('transitions from error to loaded state after retry', async () => {
      // Arrange: Setup mock that starts with error then succeeds
      const mockProducts = createMockProducts(2);

      // Start with error state
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: [],
          totalCount: 0,
          facets: null,
          loading: false,
          error: 'Server error',
          isRetryable: true,
        })
      );

      const { rerender } = render(<ProductBrowser />);

      // Assert: Verify error state
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Act: Simulate successful retry
      vi.mocked(useProducts).mockReturnValue(
        createMockUseProductsReturn({
          products: mockProducts,
          totalCount: 2,
          facets: createMockSearchFacets(),
          loading: false,
          error: null,
        })
      );

      rerender(<ProductBrowser />);

      // Assert: Verify error is cleared and products are shown
      await waitFor(() => {
        expect(screen.queryByTestId('product-error')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-list')).toBeInTheDocument();
    });
  });
});
