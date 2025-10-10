import React from 'react';
import { ExternalLink, Beaker, Tag, FileText } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from '../ui';
import type { ProductSummary } from '@repo/shared-types';

// Utility function to format property text for better readability
const formatProperty = (property: string): string => {
  // Handle properties with colons (e.g., "Viscosity: 150 cP")
  if (property.includes(':')) {
    const [name, value] = property.split(':');
    return `${name.trim()}: ${value.trim()}`;
  }
  return property;
};

export interface ProductCardProps {
  product: ProductSummary;
  onViewDetails: (productId: string) => void;
  onCompare?: (productId: string) => void;
  isSelected?: boolean;
  showCompareCheckbox?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  onViewDetails,
  onCompare,
  isSelected,
  showCompareCheckbox = true,
  className,
}: ProductCardProps) {
  const handleViewDetails = () => {
    onViewDetails(product.id);
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCompare?.(product.id);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onCompare?.(product.id);
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${className}`}
      onClick={handleViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {onCompare && showCompareCheckbox && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                aria-label={`Compare ${product.name}`}
              />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {product.name}
              </CardTitle>
              {product.description && (
                <CardDescription className="text-sm text-muted-foreground">
                  {product.description}
                </CardDescription>
              )}
              {product.short_name &&
                product.short_name !== product.name &&
                !product.description && (
                  <CardDescription className="text-sm text-muted-foreground">
                    {product.short_name}
                  </CardDescription>
                )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewDetails}
            className="ml-2 flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Product Family and CAS */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          {product.family && (
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3" />
              <span>{product.family}</span>
            </div>
          )}
          {product.cas_number && (
            <div className="flex items-center space-x-1">
              <Beaker className="h-3 w-3" />
              <span>CAS: {product.cas_number}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Key Benefits */}
        {product.key_benefits && product.key_benefits.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Benefits</h4>
            <div className="flex flex-wrap gap-1">
              {product.key_benefits.slice(0, 3).map((benefit, index) => (
                <Badge key={index} variant="default" className="text-xs">
                  {benefit}
                </Badge>
              ))}
              {product.key_benefits.length > 3 && (
                <Badge variant="default" className="text-xs">
                  +{product.key_benefits.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Key Properties */}
        {product.key_properties && product.key_properties.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-700">
              Key Properties
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {product.key_properties.slice(0, 3).map((property, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs font-medium bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100 px-2 py-1"
                  title={formatProperty(property)}
                >
                  {formatProperty(property)}
                </Badge>
              ))}
              {product.key_properties.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium bg-gray-50 border-gray-200 text-gray-600 px-2 py-1"
                >
                  +{product.key_properties.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Applications */}
        {product.applications && product.applications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Applications</h4>
            <div className="flex flex-wrap gap-1">
              {product.applications.slice(0, 2).map((application, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {application}
                </Badge>
              ))}
              {product.applications.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{product.applications.length - 2} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Document Count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <FileText className="h-3 w-3" />
            <span>
              {product.document_count} document
              {product.document_count !== 1 ? 's' : ''}
            </span>
          </div>

          {onCompare && !showCompareCheckbox && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompare}
              className="text-xs"
              aria-label={`Add ${product.name} to comparison`}
            >
              Compare
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
