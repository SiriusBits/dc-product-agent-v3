import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Grid, List } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { LoadingSpinner, LoadingState } from '../ui/loading';
import { ProductCard } from './ProductCard';
import type { ProductSummary } from '@repo/shared-types';

export interface ProductListProps {
  products: ProductSummary[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onViewProduct: (productId: string) => void;
  onCompareProduct?: (productId: string) => void;
  selectedProducts?: string[];
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  className?: string;
}

export function ProductList({
  products,
  loading,
  error,
  totalCount,
  hasMore,
  onLoadMore,
  onViewProduct,
  onCompareProduct,
  selectedProducts = [],
  viewMode = 'grid',
  onViewModeChange,
  className,
}: ProductListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const productRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset refs array when products change
  useEffect(() => {
    productRefs.current = productRefs.current.slice(0, products.length);
  }, [products.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (products.length === 0) return;

      const columnsPerRow = viewMode === 'grid' ? 3 : 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev + columnsPerRow;
            return next < products.length ? next : prev;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev - columnsPerRow;
            return next >= 0 ? next : prev;
          });
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (viewMode === 'grid') {
            setFocusedIndex((prev) => {
              const next = prev + 1;
              return next < products.length ? next : prev;
            });
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (viewMode === 'grid') {
            setFocusedIndex((prev) => {
              const next = prev - 1;
              return next >= 0 ? next : prev;
            });
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < products.length) {
            onViewProduct(products[focusedIndex].id);
          }
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(products.length - 1);
          break;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [products, focusedIndex, viewMode, onViewProduct]);

  // Focus the product card when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < productRefs.current.length) {
      productRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  if (error) {
    return (
      <Card className={className} data-testid="product-error">
        <CardContent className="p-6 text-center">
          <div className="text-red-600 mb-2">Error loading products</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <Card className={className} data-testid="product-empty-state">
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground mb-2">No products found</div>
          <div className="text-sm text-muted-foreground">
            Try adjusting your search criteria or filters
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className} ref={containerRef} tabIndex={0}>
      {/* Header with results count and view mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {loading && products.length === 0
            ? 'Loading products...'
            : products.length < totalCount
              ? `Showing ${products.length} of ${totalCount} products`
              : `${totalCount} ${totalCount === 1 ? 'product' : 'products'}`}
        </div>

        {onViewModeChange && (
          <div className="flex items-center space-x-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="h-8 w-8 p-0"
              aria-label="Grid View"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="h-8 w-8 p-0"
              aria-label="List View"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Products Grid/List */}
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        }
        data-testid={
          viewMode === 'list' ? 'product-list-view' : 'product-grid-view'
        }
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            ref={(el) => {
              productRefs.current[index] = el;
            }}
            tabIndex={-1}
            onFocus={() => setFocusedIndex(index)}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
          >
            <ProductCard
              product={product}
              onViewDetails={onViewProduct}
              onCompare={onCompareProduct}
              isSelected={selectedProducts.includes(product.id)}
              showCompareCheckbox={!!onCompareProduct}
              className={viewMode === 'list' ? 'w-full' : ''}
            />
          </div>
        ))}
      </div>

      {/* Loading indicator for initial load */}
      {loading && products.length === 0 && (
        <div className="py-8" data-testid="product-loading">
          <LoadingState
            message="Loading products..."
            testId="product-list-loading-spinner"
          />
        </div>
      )}

      {/* Load More Button */}
      {hasMore && products.length > 0 && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            {loading ? (
              <LoadingSpinner size="sm" testId="product-list-loading-spinner" />
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>Next Page</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Loading indicator for load more */}
      {loading && products.length > 0 && (
        <div className="flex justify-center mt-4">
          <LoadingState message="Loading more products..." size="sm" />
        </div>
      )}
    </div>
  );
}
