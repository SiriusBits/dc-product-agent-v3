import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Input,
  Button,
  Select,
  MultiSelect,
  Badge,
  Loading
} from '../ui';
import { useProductFilters } from '../../hooks/useProducts';
import type { ProductSearchParams } from '../../hooks/useProducts';

export interface ProductFiltersProps {
  onFiltersChange: (filters: ProductSearchParams) => void;
  loading?: boolean;
  className?: string;
}

export function ProductFilters({ onFiltersChange, loading, className }: ProductFiltersProps) {
  const { families, applications, loading: filtersLoading } = useProductFilters();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'family' | 'relevance'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleFiltersChange = useCallback(() => {
    const filters: ProductSearchParams = {
      query: searchQuery || undefined,
      family: selectedFamily || undefined,
      applications: selectedApplications.length > 0 ? selectedApplications : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: 20,
      offset: 0,
    };

    onFiltersChange(filters);
  }, [searchQuery, selectedFamily, selectedApplications, sortBy, sortOrder, onFiltersChange]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFiltersChange();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedFamily, selectedApplications, sortBy, sortOrder, handleFiltersChange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedFamily('');
    setSelectedApplications([]);
    setSortBy('relevance');
    setSortOrder('desc');
  };

  const hasActiveFilters = searchQuery || selectedFamily || selectedApplications.length > 0;

  const familyOptions = families.map(family => ({
    value: family,
    label: family,
  }));

  const applicationOptions = applications.map(app => ({
    value: app,
    label: app,
  }));

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'name', label: 'Name' },
    { value: 'family', label: 'Family' },
  ];

  const sortOrderOptions = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' },
  ];

  if (filtersLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Loading message="Loading filters..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Query */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
        </div>

        {/* Product Family */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Product Family</label>
          <Select
            options={[{ value: '', label: 'All Families' }, ...familyOptions]}
            value={selectedFamily}
            onValueChange={setSelectedFamily}
            placeholder="Select family..."
            disabled={loading}
          />
        </div>

        {/* Applications */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Applications</label>
          <MultiSelect
            options={applicationOptions}
            value={selectedApplications}
            onValueChange={setSelectedApplications}
            placeholder="Select applications..."
            disabled={loading}
            maxDisplay={2}
          />
        </div>

        {/* Sort Options */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select
              options={sortOptions}
              value={sortBy}
              onValueChange={(value) => setSortBy(value as 'name' | 'family' | 'relevance')}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Order</label>
            <Select
              options={sortOrderOptions}
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
              disabled={loading}
            />
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Active Filters</label>
            <div className="flex flex-wrap gap-1">
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Search: {searchQuery}
                </Badge>
              )}
              {selectedFamily && (
                <Badge variant="secondary" className="text-xs">
                  Family: {selectedFamily}
                </Badge>
              )}
              {selectedApplications.map(app => (
                <Badge key={app} variant="secondary" className="text-xs">
                  App: {app}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}