import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type {
  ProductSearchResponse,
  ProductSummary,
  BaseExtractionDocument,
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
  facets: any;
  loading: boolean;
  error: string | null;
  searchProducts: (params: ProductSearchParams) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useProducts(
  initialParams: ProductSearchParams = {}
): UseProductsResult {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] =
    useState<ProductSearchParams>(initialParams);
  const [hasMore, setHasMore] = useState(true);

  const searchProducts = useCallback(async (params: ProductSearchParams) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = {
        ...params,
        limit: params.limit || 20,
        offset: 0, // Reset offset for new search
      };

      const response = await apiClient.searchProducts(searchParams);

      setProducts(response.products);
      setTotalCount(response.total_count);
      setFacets(response.facets);
      setCurrentParams(searchParams);
      setHasMore(response.products.length < response.total_count);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to search products'
      );
      setProducts([]);
      setTotalCount(0);
      setFacets(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    setError(null);

    try {
      const searchParams = {
        ...currentParams,
        offset: products.length,
      };

      const response = await apiClient.searchProducts(searchParams);

      setProducts((prev) => [...prev, ...response.products]);
      setHasMore(
        products.length + response.products.length < response.total_count
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load more products'
      );
    } finally {
      setLoading(false);
    }
  }, [currentParams, products.length, hasMore, loading]);

  // Initial search
  useEffect(() => {
    searchProducts(initialParams);
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
  };
}

export interface UseProductDetailResult {
  product: BaseExtractionDocument | null;
  relatedProducts: ProductSummary[];
  loading: boolean;
  error: string | null;
  loadProduct: (productId: string) => Promise<void>;
}

export function useProductDetail(): UseProductDetailResult {
  const [product, setProduct] = useState<BaseExtractionDocument | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load product details and related products in parallel
      const [productData, relatedData] = await Promise.all([
        apiClient.getProduct(productId),
        apiClient.getRelatedProducts(productId, 10),
      ]);

      setProduct(productData);
      setRelatedProducts(relatedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
      setProduct(null);
      setRelatedProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    product,
    relatedProducts,
    loading,
    error,
    loadProduct,
  };
}

export interface UseProductFiltersResult {
  families: string[];
  applications: string[];
  loading: boolean;
  error: string | null;
  loadFilters: () => Promise<void>;
}

export function useProductFilters(): UseProductFiltersResult {
  const [families, setFamilies] = useState<string[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [familiesData, applicationsData] = await Promise.all([
        apiClient.getProductFamilies(),
        apiClient.getProductApplications(),
      ]);

      setFamilies(familiesData);
      setApplications(applicationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filters');
      setFamilies([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load filters on mount
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  return {
    families,
    applications,
    loading,
    error,
    loadFilters,
  };
}

export interface UseProductComparisonResult {
  comparisonData: any | null;
  loading: boolean;
  error: string | null;
  compareProducts: (
    productId: string,
    otherProductId: string,
    aspects?: string[]
  ) => Promise<void>;
  clearComparison: () => void;
}

export function useProductComparison(): UseProductComparisonResult {
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compareProducts = useCallback(
    async (productId: string, otherProductId: string, aspects?: string[]) => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.compareProducts(
          productId,
          otherProductId,
          aspects
        );
        setComparisonData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to compare products'
        );
        setComparisonData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearComparison = useCallback(() => {
    setComparisonData(null);
    setError(null);
  }, []);

  return {
    comparisonData,
    loading,
    error,
    compareProducts,
    clearComparison,
  };
}
