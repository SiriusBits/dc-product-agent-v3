import React from 'react';
import { ChevronDown, Grid, List } from 'lucide-react';
import { 
  Button,
  Loading,
  Card,
  CardContent
} from '../ui';
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
  className
}: ProductListProps) {
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <div className="text-red-600 mb-2">Error loading products</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <Card className={className}>
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
    <div className={className}>
      {/* Header with results count and view mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {loading && products.length === 0 ? (
            'Loading products...'
          ) : (
            `Showing ${products.length} of ${totalCount} products`
          )}
        </div>
        
        {onViewModeChange && (
          <div className="flex items-center space-x-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Products Grid/List */}
      <div className={
        viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-4'
      }>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onViewDetails={onViewProduct}
            onCompare={onCompareProduct}
            isSelected={selectedProducts.includes(product.id)}
            className={viewMode === 'list' ? 'w-full' : ''}
          />
        ))}
      </div>

      {/* Loading indicator for initial load */}
      {loading && products.length === 0 && (
        <div className="py-8">
          <Loading message="Loading products..." />
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
              <Loading size="sm" />
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>Load More</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Loading indicator for load more */}
      {loading && products.length > 0 && (
        <div className="flex justify-center mt-4">
          <Loading message="Loading more products..." size="sm" />
        </div>
      )}
    </div>
  );
}