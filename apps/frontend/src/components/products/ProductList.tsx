import React from 'react';
import { ProductCard } from './ProductCard';
import type { ProductSummary } from '../../lib/api';

interface ProductListProps {
    products: ProductSummary[];
}

export const ProductList: React.FC<ProductListProps> = ({ products }) => {
    if (products.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">No products found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
                <ProductCard key={product.doc_id} product={product} />
            ))}
        </div>
    );
};
