import React, { useState, useMemo, useEffect } from 'react';
import { ProductFilter } from './ProductFilter';
import { ProductList } from './ProductList';
import type { Product } from './ProductCard';
import { api, type Product as ApiProduct } from '../../lib/api';

export const ProductBrowser: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.getDocuments();
                // Map API Product to Component Product (if needed, but they match now)
                // The API Product interface in api.ts matches the structure we need, 
                // except maybe tags. Our component expects 'tags', but API returns 'category'.
                // We can map category to tags or just add tags property.
                // Let's add a default tag for now.
                const mappedProducts = response.documents.map(p => ({
                    ...p,
                    tags: [p.category] // Use category as a tag
                }));
                setProducts(mappedProducts);
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

    const categories = useMemo(() => {
        const cats = new Set(products.map((p) => p.category));
        return Array.from(cats).sort();
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory ? product.category === selectedCategory : true;

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
