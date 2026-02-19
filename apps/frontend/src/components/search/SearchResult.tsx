import React from 'react';
import type { SearchResult as SearchResultType } from '../../lib/api';

interface SearchResultProps {
    result: SearchResultType;
}

export const SearchResult: React.FC<SearchResultProps> = ({ result }) => {
    // Format relevance score as percentage
    const relevancePercent = Math.round(result.relevance_score * 100);
    
    // Determine relevance badge color
    const getRelevanceColor = (score: number) => {
        if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    };

    const productDetailUrl = result.doc_id 
        ? `/products/${encodeURIComponent(result.doc_id)}`
        : null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2 gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {productDetailUrl ? (
                            <a 
                                href={productDetailUrl}
                                className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {result.product_name}
                            </a>
                        ) : (
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {result.product_name}
                            </h3>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({result.product_id})
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            Section: <span className="font-medium">{result.section_name}</span>
                        </span>
                        {result.chunk_type && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                                {result.chunk_type}
                            </span>
                        )}
                        {result.page && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Page {result.page}
                            </span>
                        )}
                    </div>
                </div>
                <span className={`px-2 py-1 text-sm font-medium rounded-full whitespace-nowrap ${getRelevanceColor(result.relevance_score)}`}>
                    {relevancePercent}% match
                </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-4">
                {result.chunk_text}
            </p>
        </div>
    );
};
