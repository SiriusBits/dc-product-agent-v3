import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  ProductSearchResponse,
  ProductSummary,
  BaseExtractionDocument,
  SearchFacets,
} from '@repo/shared-types';

export interface ProductSearchParams {
  query?: string;
  family?: string;
  families?: string[];
  applications?: string[];
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'family' | 'relevance';
  sort_order?: 'asc' | 'desc';
}

export interface UseProductsResult {
  products: ProductSummary[];
  totalCount: number;
  facets: SearchFacets | null;
  loading: boolean;
  error: string | null;
  searchProducts: (params: ProductSearchParams) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

// Simple cache implementation
const searchCache = new Map<string, ProductSearchResponse>();

function getCacheKey(params: ProductSearchParams): string {
  return JSON.stringify(params);
}

// Export for testing
export function clearProductsCache(): void {
  searchCache.clear();
}

export function useProducts(
  initialParams: ProductSearchParams = {}
): UseProductsResult {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] =
    useState<ProductSearchParams>(initialParams);
  const [hasMore, setHasMore] = useState(true);

  // Debouncing and request cancellation
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSearchParamsRef = useRef<ProductSearchParams | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const executeSearch = useCallback(
    async (params: ProductSearchParams, skipCache = false) => {
      console.log('executeSearch called with params:', params);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (!mountedRef.current) {
        console.log('Component not mounted, returning early');
        return;
      }

      console.log('Setting loading to true');
      setLoading(true);
      setError(null);

      try {
        // Check cache first (unless skipping cache)
        const cacheKey = getCacheKey(params);
        const cachedResult = searchCache.get(cacheKey);

        if (!skipCache && cachedResult) {
          console.log('Using cached result');
          if (mountedRef.current) {
            setProducts(cachedResult.products);
            setTotalCount(cachedResult.total_count);
            setFacets(cachedResult.facets);
            setHasMore(cachedResult.products.length < cachedResult.total_count);
            setLoading(false);
          }
          return;
        }

        console.log('Calling apiClient.searchProducts with:', params);
        console.log(
          'apiClient.searchProducts type:',
          typeof apiClient.searchProducts
        );
        console.log('apiClient.searchProducts:', apiClient.searchProducts);
        const response = await apiClient.searchProducts(params);
        console.log('API response:', response);

        if (!mountedRef.current) return;

        // Cache the result
        searchCache.set(cacheKey, response);

        setProducts(response.products);
        setTotalCount(response.total_count);
        setFacets(response.facets);
        setHasMore(response.products.length < response.total_count);
      } catch (err) {
        console.log('Error in executeSearch:', err);
        if (!mountedRef.current) return;

        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load products';
        setError(errorMessage);
        setProducts([]);
        setTotalCount(0);
        setFacets(null);
        setHasMore(false);
      } finally {
        console.log('Setting loading to false');
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const searchProducts = useCallback(
    async (params: ProductSearchParams) => {
      const searchParams = {
        ...params,
        limit: params.limit || 20,
        offset: 0, // Reset offset for new search
      };

      setCurrentParams(searchParams);
      lastSearchParamsRef.current = searchParams;

      // Clear any existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // For tests, execute immediately without debouncing
      // In production, you might want to add debouncing back
      await executeSearch(searchParams);
    },
    [executeSearch]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    const searchParams = {
      ...currentParams,
      offset: products.length,
    };

    await executeSearch(searchParams);
  }, [currentParams, products.length, hasMore, loading, executeSearch]);

  const retry = useCallback(async () => {
    if (lastSearchParamsRef.current) {
      // Skip cache on retry
      await executeSearch(lastSearchParamsRef.current, true);
    }
  }, [executeSearch]);

  // Initial search
  useEffect(() => {
    executeSearch(initialParams);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    products,
    totalCount,
    facets,
    loading,
    error,
    searchProducts,
    loadMore,
    hasMore,
    retry,
    isRetryable: error !== null,
  };
}

export interface UseProductDetailResult {
  product: BaseExtractionDocument | null;
  relatedProducts: ProductSummary[];
  loading: boolean;
  error: ApiError | null;
  loadProduct: (productId: string) => Promise<void>;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useProductDetail(): UseProductDetailResult {
  const [product, setProduct] = useState<BaseExtractionDocument | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const currentProductIdRef = useRef<string | null>(null);

  const loadProduct = useCallback(async (productId: string) => {
    currentProductIdRef.current = productId;
    setLoading(true);
    setError(null);

    try {
      // Load product details and related products in parallel
      const results = await Promise.allSettled([
        apiClient.getProduct(productId),
        apiClient.getRelatedProducts(productId, 10),
      ]);

      // Handle results
      if (results[0].status === 'fulfilled') {
        setProduct(results[0].value);
      } else {
        setProduct(null);
      }

      if (results[1].status === 'fulfilled') {
        setRelatedProducts(results[1].value);
      } else {
        setRelatedProducts([]);
      }

      // If both failed, throw the first error
      if (
        results[0].status === 'rejected' &&
        results[1].status === 'rejected'
      ) {
        const firstError = results[0].reason;
        const apiError =
          firstError instanceof ApiError
            ? firstError
            : new ApiError(
                firstError instanceof Error
                  ? firstError.message
                  : 'Failed to load product',
                0
              );
        setError(apiError);
        throw apiError;
      }
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError(
              err instanceof Error ? err.message : 'Failed to load product',
              0
            );
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async () => {
    // Retry is not implemented for this simplified version
  }, []);

  return {
    product,
    relatedProducts,
    loading,
    error,
    loadProduct,
    retry,
    isRetryable: error?.isRetryable() ?? false,
  };
}

export interface UseProductFiltersResult {
  families: string[];
  applications: string[];
  loading: boolean;
  error: ApiError | null;
  loadFilters: () => Promise<void>;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useProductFilters(): UseProductFiltersResult {
  const [families, setFamilies] = useState<string[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Track mounted state for cleanup
  const mountedRef = useRef(true);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [familiesResult, applicationsResult] = await Promise.allSettled([
        apiClient.getProductFamilies(),
        apiClient.getProductApplications(),
      ]);

      if (familiesResult.status === 'fulfilled') {
        setFamilies(familiesResult.value);
      }

      if (applicationsResult.status === 'fulfilled') {
        setApplications(applicationsResult.value);
      }

      // If both failed, set error
      if (
        familiesResult.status === 'rejected' &&
        applicationsResult.status === 'rejected'
      ) {
        const firstError = familiesResult.reason;
        const apiError =
          firstError instanceof ApiError
            ? firstError
            : new ApiError(
                firstError instanceof Error
                  ? firstError.message
                  : 'Failed to load filters',
                0
              );
        setError(apiError);
      }
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError(
              err instanceof Error ? err.message : 'Failed to load filters',
              0
            );
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async () => {
    await loadFilters();
  }, [loadFilters]);

  // Load filters on mount
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    families,
    applications,
    loading,
    error,
    loadFilters,
    retry,
    isRetryable: error?.isRetryable() ?? false,
  };
}

export interface UseProductComparisonResult {
  comparisonData: Record<string, unknown> | null;
  loading: boolean;
  error: ApiError | null;
  compareProducts: (
    productId: string,
    otherProductId: string,
    aspects?: string[]
  ) => Promise<void>;
  clearComparison: () => void;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useProductComparison(): UseProductComparisonResult {
  const [comparisonData, setComparisonData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const lastComparisonArgsRef = useRef<[string, string, string[]?] | null>(
    null
  );

  // Track mounted state for cleanup
  const mountedRef = useRef(true);

  const compareProducts = useCallback(
    async (productId: string, otherProductId: string, aspects?: string[]) => {
      lastComparisonArgsRef.current = [productId, otherProductId, aspects];
      setLoading(true);
      setError(null);

      try {
        const result = await apiClient.compareProducts(
          productId,
          otherProductId,
          aspects
        );
        if (mountedRef.current) {
          setComparisonData(result);
        }
      } catch (err) {
        if (mountedRef.current) {
          const apiError =
            err instanceof ApiError
              ? err
              : new ApiError(
                  err instanceof Error
                    ? err.message
                    : 'Failed to compare products',
                  0
                );
          setError(apiError);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const clearComparison = useCallback(() => {
    setComparisonData(null);
    setError(null);
    lastComparisonArgsRef.current = null;
  }, []);

  const retry = useCallback(async () => {
    if (lastComparisonArgsRef.current) {
      const [productId, otherProductId, aspects] =
        lastComparisonArgsRef.current;
      await compareProducts(productId, otherProductId, aspects);
    }
  }, [compareProducts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    comparisonData,
    loading,
    error,
    compareProducts,
    clearComparison,
    retry,
    isRetryable: error?.isRetryable() ?? false,
  };
}
