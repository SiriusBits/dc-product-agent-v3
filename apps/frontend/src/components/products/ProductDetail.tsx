import { useState } from 'react';
import { 
  ArrowLeft, 
  Beaker, 
  Tag, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Info,
  Zap,
  Target
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  Loading
} from '../ui';
import { ProductCard } from './ProductCard';
import type { BaseExtractionDocument, ProductSummary } from '@repo/shared-types';

export interface ProductDetailProps {
  product: BaseExtractionDocument | null;
  relatedProducts: ProductSummary[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onViewProduct: (productId: string) => void;
  onCompareProduct?: (productId: string) => void;
  className?: string;
}

export function ProductDetail({
  product,
  relatedProducts,
  loading,
  error,
  onBack,
  onViewProduct,
  onCompareProduct,
  className
}: ProductDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <Loading message="Loading product details..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-red-600 mb-2">Error loading product</div>
            <div className="text-sm text-muted-foreground">
              {error || 'Product not found'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { product_info } = product;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Button>

      {/* Product Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold">
                {product_info.product_name}
              </CardTitle>
              {product_info.product_short_name && 
               product_info.product_short_name !== product_info.product_name && (
                <CardDescription className="text-lg mt-1">
                  {product_info.product_short_name}
                </CardDescription>
              )}
            </div>
            {onCompareProduct && (
              <Button onClick={() => onCompareProduct(product.doc_id || '')}>
                Compare
              </Button>
            )}
          </div>

          {/* Product Metadata */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            {product_info.product_family && (
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Family:</strong> {product_info.product_family}
                </span>
              </div>
            )}
            {product_info.cas_number && (
              <div className="flex items-center space-x-2">
                <Beaker className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>CAS:</strong> {product_info.cas_number}
                </span>
              </div>
            )}
            {product_info.chemical_name && (
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Chemical Name:</strong> {product_info.chemical_name}
                </span>
              </div>
            )}
          </div>

          {/* Synonyms */}
          {product_info.synonyms && product_info.synonyms.length > 0 && (
            <div className="mt-3">
              <span className="text-sm font-medium">Synonyms: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {product_info.synonyms.map((synonym, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {synonym}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Benefits */}
          {product.key_benefits && product.key_benefits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Key Benefits</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {product.key_benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Applications Overview */}
          {product.applications && product.applications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Applications</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {product.applications.map((application, index) => (
                    <Badge key={index} variant="secondary">
                      {application}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Applications Text */}
          {product.applications_text && (
            <Card>
              <CardHeader>
                <CardTitle>Application Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{product.applications_text}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties">
          <Card>
            <CardHeader>
              <CardTitle>Properties & Specifications</CardTitle>
              <CardDescription>
                Technical properties and test specifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {product.properties_and_specifications && product.properties_and_specifications.length > 0 ? (
                <div className="space-y-4">
                  {/* Group properties by category */}
                  {Object.entries(
                    product.properties_and_specifications.reduce((acc, prop) => {
                      const category = prop.category || 'General';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(prop);
                      return acc;
                    }, {} as Record<string, typeof product.properties_and_specifications>)
                  ).map(([category, properties]) => (
                    <div key={category}>
                      <h4 className="font-medium mb-3">{category}</h4>
                      <div className="grid gap-3">
                        {properties.map((prop, index) => (
                          <div key={index} className="flex justify-between items-start p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{prop.name}</div>
                              {prop.test_method && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Test Method: {prop.test_method}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">
                                {prop.value_string || 
                                 (prop.value_numeric !== null ? prop.value_numeric : '') ||
                                 (prop.value_min !== null && prop.value_max !== null 
                                   ? `${prop.value_min} - ${prop.value_max}` 
                                   : '')}
                                {prop.unit && ` ${prop.unit}`}
                              </div>
                              {prop.page && (
                                <div className="text-xs text-muted-foreground">
                                  Page {prop.page}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {category !== Object.keys(product.properties_and_specifications.reduce((acc, prop) => {
                        const cat = prop.category || 'General';
                        if (!acc[cat]) acc[cat] = [];
                        return acc;
                      }, {} as Record<string, unknown[]>)).slice(-1)[0] && <Separator className="my-4" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No properties data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Applications & Uses</CardTitle>
              <CardDescription>
                Detailed application information and use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.applications && product.applications.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Application Areas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {product.applications.map((application, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 border rounded">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{application}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.applications_text && (
                <div>
                  <h4 className="font-medium mb-3">Application Details</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm leading-relaxed">{product.applications_text}</p>
                  </div>
                </div>
              )}

              {(!product.applications || product.applications.length === 0) && !product.applications_text && (
                <div className="text-center text-muted-foreground py-8">
                  No application information available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Source Documents</span>
              </CardTitle>
              <CardDescription>
                Technical bulletins and documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{product.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.document_type} • {product.manufacturer}
                    </div>
                    {product.extraction_metadata?.extraction_date && (
                      <div className="text-xs text-muted-foreground">
                        Extracted: {new Date(product.extraction_metadata.extraction_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Products</CardTitle>
            <CardDescription>
              Products with similar properties or applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedProducts.slice(0, 6).map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  onViewDetails={onViewProduct}
                  onCompare={onCompareProduct}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}