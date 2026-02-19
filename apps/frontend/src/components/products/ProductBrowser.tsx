import React, { useState, useMemo, useEffect } from 'react';
import { ProductFilter } from './ProductFilter';
import { ProductList } from './ProductList';
import { api, type ProductSummary } from '../../lib/api';

export const ProductBrowser: React.FC = () => {
    const [products, setProducts] = useState<ProductSummary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.getProducts();
                setProducts(response.products);
            } catch (err) {
                console.error('Failed to fetch products. Full error:', err);
                if (err instanceof Error) {
                    console.error('Error message:', err.message);
                    console.error('Error stack:', err.stack);
                }
                setError(`Failed to load products: ${err instanceof Error ? err.message : String(err)}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Get unique product families for filtering
    const categories = useMemo(() => {
        const families = products
            .map((p) => p.product_family)
            .filter((f): f is string => f !== null && f !== undefined);
        return Array.from(new Set(families)).sort();
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                product.product_name.toLowerCase().includes(searchLower) ||
                product.product_short_name.toLowerCase().includes(searchLower) ||
                (product.summary?.toLowerCase().includes(searchLower) ?? false) ||
                (product.cas_number?.toLowerCase().includes(searchLower) ?? false) ||
                product.key_applications.some((app) => app.toLowerCase().includes(searchLower));

            const matchesCategory = selectedCategory 
                ? product.product_family === selectedCategory 
                : true;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    if (isLoading) {
        return <div className="text-center py-8">Loading products...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Product Catalog</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                    Explore our comprehensive range of chemical products and solutions.
                </p>
            </div>

            <ProductFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                categories={categories}
            />

            <ProductList products={filteredProducts} />
        </div>
    );
};
