import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import { useApi, useApiQuery } from './useApi';
import type {
  ProductSearchResponse,
  ProductSummary,
  BaseExtractionDocument,
  SearchFacets,
} from '@repo/shared-types';

export interface ProductSearchParams {
  query?: string;
  family?: string;
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
  error: ApiError | null;
  searchProducts: (params: ProductSearchParams) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

export function useProducts(
  initialParams: ProductSearchParams = {}
): UseProductsResult {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [currentParams, setCurrentParams] =
    useState<ProductSearchParams>(initialParams);
  const [hasMore, setHasMore] = useState(true);

  // Use API hook for search operations
  const searchApi = useApi(apiClient.searchProducts, {
    onSuccess: (response: ProductSearchResponse) => {
      setProducts(response.products);
      setTotalCount(response.total_count);
      setFacets(response.facets);
      setHasMore(response.products.length < response.total_count);
    },
  });

  // Use API hook for load more operations
  const loadMoreApi = useApi(apiClient.searchProducts, {
    onSuccess: (response: ProductSearchResponse) => {
      setProducts((prev) => [...prev, ...response.products]);
      setHasMore(
        products.length + response.products.length < response.total_count
      );
    },
  });

  const searchProducts = useCallback(
    async (params: ProductSearchParams) => {
      const searchParams = {
        ...params,
        limit: params.limit || 20,
        offset: 0, // Reset offset for new search
      };

      setCurrentParams(searchParams);
      await searchApi.execute(searchParams);
    },
    [searchApi]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadMoreApi.loading) return;

    const searchParams = {
      ...currentParams,
      offset: products.length,
    };

    await loadMoreApi.execute(searchParams);
  }, [currentParams, products.length, hasMore, loadMoreApi]);

  const retry = useCallback(async () => {
    if (searchApi.isRetryable) {
      await searchApi.retry();
    } else if (loadMoreApi.isRetryable) {
      await loadMoreApi.retry();
    }
  }, [searchApi, loadMoreApi]);

  // Initial search
  useEffect(() => {
    searchProducts(initialParams);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    products,
    totalCount,
    facets,
    loading: searchApi.loading || loadMoreApi.loading,
    error: searchApi.error || loadMoreApi.error,
    searchProducts,
    loadMore,
    hasMore,
    retry,
    isRetryable: searchApi.isRetryable || loadMoreApi.isRetryable,
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

  const loadProduct = useCallback(async (productId: string) => {
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

  // Use API query hooks to load filters automatically
  const familiesApi = useApiQuery(apiClient.getProductFamilies, [], {
    onSuccess: (data: string[]) => setFamilies(data),
    retryOnMount: true,
  });

  const applicationsApi = useApiQuery(apiClient.getProductApplications, [], {
    onSuccess: (data: string[]) => setApplications(data),
    retryOnMount: true,
  });

  const loadFilters = useCallback(async () => {
    await Promise.all([familiesApi.execute(), applicationsApi.execute()]);
  }, [familiesApi, applicationsApi]);

  const retry = useCallback(async () => {
    await Promise.all([familiesApi.retry(), applicationsApi.retry()]);
  }, [familiesApi, applicationsApi]);

  const error = familiesApi.error || applicationsApi.error;
  const isRetryable = familiesApi.isRetryable || applicationsApi.isRetryable;

  return {
    families,
    applications,
    loading: familiesApi.loading || applicationsApi.loading,
    error,
    loadFilters,
    retry,
    isRetryable,
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

  // Use API hook for comparison operations
  const comparisonApi = useApi(
    (productId: string, otherProductId: string, aspects?: string[]) =>
      apiClient.compareProducts(productId, otherProductId, aspects),
    {
      onSuccess: (data: Record<string, unknown>) => {
        setComparisonData(data);
      },
    }
  );

  const compareProducts = useCallback(
    async (productId: string, otherProductId: string, aspects?: string[]) => {
      await comparisonApi.execute(productId, otherProductId, aspects);
    },
    [comparisonApi]
  );

  const clearComparison = useCallback(() => {
    setComparisonData(null);
    comparisonApi.reset();
  }, [comparisonApi]);

  const retry = useCallback(async () => {
    await comparisonApi.retry();
  }, [comparisonApi]);

  return {
    comparisonData,
    loading: comparisonApi.loading,
    error: comparisonApi.error,
    compareProducts,
    clearComparison,
    retry,
    isRetryable: comparisonApi.isRetryable,
  };
}
