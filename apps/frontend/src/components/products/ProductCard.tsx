import React from 'react';

export interface Product {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
}

interface ProductCardProps {
    product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                        {product.category}
                    </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                    {product.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                    {product.tags.map((tag) => (
                        <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-750 px-6 py-3 border-t border-gray-100 dark:border-gray-700">
                <button className="text-blue-600 dark:text-blue-400 font-medium text-sm hover:underline">
                    View Details →
                </button>
            </div>
        </div>
    );
};
