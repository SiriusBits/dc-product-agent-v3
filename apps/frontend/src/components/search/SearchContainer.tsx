import React, { useState } from 'react';
import { api, type SearchResult as SearchResultType } from '../../lib/api';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';

export const SearchContainer: React.FC = () => {
    const [results, setResults] = useState<SearchResultType[]>([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (searchQuery: string) => {
        setIsLoading(true);
        setError(null);
        setQuery(searchQuery);

        try {
            const response = await api.search(searchQuery);
            setResults(response.results);
        } catch (err) {
            console.error('Search failed:', err);
            setError('Failed to perform search. Please try again.');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <nav className="flex items-center gap-6 mb-4">
                        <a 
                            href="/" 
                            className="text-xl font-bold text-blue-600 dark:text-blue-400"
                        >
                            DC Product Agent
                        </a>
                        <div className="flex gap-4">
                            <a 
                                href="/search" 
                                className="text-gray-900 dark:text-white font-medium"
                            >
                                Search
                            </a>
                            <a 
                                href="/products" 
                                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Products
                            </a>
                            <a 
                                href="/chat" 
                                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Chat
                            </a>
                        </div>
                    </nav>
                    <SearchInput 
                        onSearch={handleSearch} 
                        disabled={isLoading}
                        initialQuery={query}
                    />
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}
                <SearchResults 
                    results={results} 
                    query={query}
                    isLoading={isLoading}
                />
            </main>
        </div>
    );
};
