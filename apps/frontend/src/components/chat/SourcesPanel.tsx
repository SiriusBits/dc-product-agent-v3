import React, { useState } from 'react';
import type { CitedSource } from '../../lib/api';

interface SourcesPanelProps {
    sources: CitedSource[];
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (sources.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
                <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                    />
                </svg>
                <span>
                    {sources.length} source{sources.length !== 1 ? 's' : ''} cited
                </span>
            </button>

            {isExpanded && (
                <div className="mt-2 space-y-2">
                    {sources.map((source, index) => (
                        <SourceItem key={index} source={source} />
                    ))}
                </div>
            )}
        </div>
    );
};

interface SourceItemProps {
    source: CitedSource;
}

const SourceItem: React.FC<SourceItemProps> = ({ source }) => {
    const relevancePercent = Math.round(source.relevance * 100);
    const relevanceColor = getRelevanceColor(source.relevance);

    const content = (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {source.product_name}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 truncate">
                        {source.section}
                    </div>
                </div>
                <div
                    className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${relevanceColor}`}
                >
                    {relevancePercent}%
                </div>
            </div>
            {source.chunk_text && (
                <div className="mt-2 text-gray-600 dark:text-gray-300 line-clamp-2 italic">
                    "{source.chunk_text}"
                </div>
            )}
        </div>
    );

    if (source.product_id) {
        return (
            <a
                href={`/products/${encodeURIComponent(source.product_id)}`}
                className="block hover:ring-2 hover:ring-blue-500 rounded-lg transition-shadow"
            >
                {content}
            </a>
        );
    }

    return content;
};

function getRelevanceColor(relevance: number): string {
    if (relevance >= 0.8) {
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (relevance >= 0.6) {
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
}
