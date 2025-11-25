import React, { useState, useMemo } from 'react';
import { ProductFilter } from './ProductFilter';
import { ProductList } from './ProductList';
import { Product } from './ProductCard';

// Mock data for now
const MOCK_PRODUCTS: Product[] = [
    {
        id: '1',
        name: 'Dixie Anhydride 1',
        description: 'A high-performance curing agent for epoxy resins, offering excellent thermal stability and electrical properties.',
        category: 'Anhydrides',
        tags: ['Epoxy Curing', 'Thermal Stability', 'Electrical'],
    },
    {
        id: '2',
        name: 'Dixie Solvent X',
        description: 'A versatile industrial solvent with high solvency power and low volatility, suitable for coatings and adhesives.',
        category: 'Solvents',
        tags: ['Industrial', 'Coatings', 'Adhesives'],
    },
    {
        id: '3',
        name: 'Dixie Plasticizer P',
        description: 'A phthalate-free plasticizer designed for PVC applications requiring low temperature flexibility.',
        category: 'Plasticizers',
        tags: ['PVC', 'Phthalate-Free', 'Low Temp'],
    },
    {
        id: '4',
        name: 'Dixie Anhydride 2',
        description: 'Modified anhydride for filament winding and pultrusion applications.',
        category: 'Anhydrides',
        tags: ['Filament Winding', 'Pultrusion'],
    },
];

export const ProductBrowser: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const categories = useMemo(() => {
        const cats = new Set(MOCK_PRODUCTS.map((p) => p.category));
        return Array.from(cats).sort();
    }, []);

    const filteredProducts = useMemo(() => {
        return MOCK_PRODUCTS.filter((product) => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory ? product.category === selectedCategory : true;

            return matchesSearch && matchesCategory;
        });
    }, [searchTerm, selectedCategory]);

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
