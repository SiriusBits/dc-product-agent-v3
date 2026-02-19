import React from 'react';
import type { SearchResult as SearchResultType } from '../../lib/api';
import { SearchResult } from './SearchResult';

interface SearchResultsProps {
    results: SearchResultType[];
    query: string;
    isLoading?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ 
    results, 
    query,
    isLoading 
}) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Searching...</p>
            </div>
        );
    }

    if (!query) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                    Enter a search query to find chemical product information
                </p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">
                    No results found for "{query}"
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                    Try different keywords or check your spelling
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Found <span className="font-semibold text-gray-900 dark:text-white">{results.length}</span> result{results.length !== 1 ? 's' : ''} for "{query}"
            </div>
            <div className="space-y-4">
                {results.map((result, index) => (
                    <SearchResult key={`${result.product_id}-${index}`} result={result} />
                ))}
            </div>
        </div>
    );
};
