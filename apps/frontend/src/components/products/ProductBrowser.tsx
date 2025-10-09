import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button } from '../ui';
import { ProductFilters } from './ProductFilters';
import { ProductList } from './ProductList';
import { ProductDetail } from './ProductDetail';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { useProducts, useProductDetail } from '../../hooks/useProducts';
import type { ProductSearchParams } from '../../hooks/useProducts';

// Import ProductList if not already imported
export { ProductList } from './ProductList';

export default function ProductBrowser() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [comparisonProducts, setComparisonProducts] = useState<string[]>([]);

  // Product search and listing
  const {
    products,
    totalCount,

    loading: productsLoading,
    error: productsError,
    searchProducts,
    loadMore,
    hasMore,
  } = useProducts();

  // Product detail
  const {
    product: selectedProduct,
    relatedProducts,
    loading: detailLoading,
    error: detailError,
    loadProduct,
  } = useProductDetail();

  // Handle filter changes
  const handleFiltersChange = (filters: ProductSearchParams) => {
    searchProducts(filters);
  };

  // Handle product selection
  const handleViewProduct = (productId: string) => {
    setSelectedProductId(productId);
    loadProduct(productId);
    setActiveTab('detail');
  };

  // Handle back to catalog
  const handleBackToCatalog = () => {
    setSelectedProductId(null);
    setActiveTab('catalog');
  };

  // Handle product comparison
  const handleCompareProduct = (productId: string) => {
    if (comparisonProducts.includes(productId)) {
      setComparisonProducts((prev) => prev.filter((id) => id !== productId));
    } else if (comparisonProducts.length < 3) {
      setComparisonProducts((prev) => [...prev, productId]);
    }
  };

  // Handle knowledge graph entity click
  const handleEntityClick = (entity: import('@repo/shared-types').KGEntity) => {
    // Try to find a product with this entity name
    const matchingProduct = products.find(
      (p) =>
        p.name.toLowerCase().includes(entity.text.toLowerCase()) ||
        p.short_name?.toLowerCase().includes(entity.text.toLowerCase())
    );

    if (matchingProduct) {
      handleViewProduct(matchingProduct.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Product Browser</h1>
        <p className="text-muted-foreground">
          Searchable catalog of chemical products and specifications
        </p>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
          <TabsTrigger value="knowledge-graph">Knowledge Graph</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedProductId}>
            Product Detail
          </TabsTrigger>
        </TabsList>

        {/* Product Catalog Tab */}
        <TabsContent value="catalog" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <ProductFilters
                onFiltersChange={handleFiltersChange}
                loading={productsLoading}
              />

              {/* Comparison Panel */}
              {comparisonProducts.length > 0 && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Compare ({comparisonProducts.length}/3)</span>
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setComparisonProducts([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {comparisonProducts.map((productId) => {
                      const product = products.find((p) => p.id === productId);
                      return product ? (
                        <div
                          key={productId}
                          className="text-sm p-2 bg-background rounded border"
                        >
                          {product.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <Button
                    className="w-full mt-3"
                    size="sm"
                    disabled={comparisonProducts.length < 1}
                    aria-label="Compare selected products"
                  >
                    Compare Products
                  </Button>
                </div>
              )}
            </div>

            {/* Product List */}
            <div className="lg:col-span-3">
              <ProductList
                products={products}
                loading={productsLoading}
                error={productsError?.message || null}
                totalCount={totalCount}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onViewProduct={handleViewProduct}
                onCompareProduct={handleCompareProduct}
                selectedProducts={comparisonProducts}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Graph Tab */}
        <TabsContent value="knowledge-graph">
          <KnowledgeGraphViewer onEntityClick={handleEntityClick} />
        </TabsContent>

        {/* Product Detail Tab */}
        <TabsContent value="detail">
          {selectedProductId && (
            <ProductDetail
              product={selectedProduct}
              relatedProducts={relatedProducts}
              loading={detailLoading}
              error={detailError?.message || null}
              onBack={handleBackToCatalog}
              onViewProduct={handleViewProduct}
              onCompareProduct={handleCompareProduct}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
