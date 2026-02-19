import React from 'react';
import type { ProductSummary } from '../../lib/api';

// Legacy interface for backwards compatibility
export interface Product {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
}

interface ProductCardProps {
    product: ProductSummary;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const detailUrl = `/products/${encodeURIComponent(product.doc_id)}`;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-2 gap-2">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {product.product_name}
                        </h3>
                        {product.product_short_name !== product.product_name && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {product.product_short_name}
                            </p>
                        )}
                    </div>
                    {product.product_family && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full whitespace-nowrap">
                            {product.product_family}
                        </span>
                    )}
                </div>

                {product.cas_number && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        CAS: {product.cas_number}
                    </p>
                )}

                {product.summary && (
                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                        {product.summary}
                    </p>
                )}

                {product.key_applications.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto">
                        {product.key_applications.slice(0, 4).map((app, index) => (
                            <span
                                key={index}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md"
                            >
                                {app}
                            </span>
                        ))}
                        {product.key_applications.length > 4 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md">
                                +{product.key_applications.length - 4} more
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-750 px-6 py-3 border-t border-gray-100 dark:border-gray-700">
                <a
                    href={detailUrl}
                    className="text-blue-600 dark:text-blue-400 font-medium text-sm hover:underline"
                >
                    View Details →
                </a>
            </div>
        </div>
    );
};
