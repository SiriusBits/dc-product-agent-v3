import React, { useState } from 'react';

interface SearchInputProps {
    onSearch: (query: string) => void;
    disabled?: boolean;
    initialQuery?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
    onSearch, 
    disabled,
    initialQuery = '' 
}) => {
    const [query, setQuery] = useState(initialQuery);

    const handleSearch = () => {
        if (query.trim() && !disabled) {
            onSearch(query.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    return (
        <div className="w-full">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for chemical products, properties, applications..."
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500"
                    disabled={disabled}
                />
                <button
                    onClick={handleSearch}
                    disabled={!query.trim() || disabled}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    Search
                </button>
            </div>
        </div>
    );
};
