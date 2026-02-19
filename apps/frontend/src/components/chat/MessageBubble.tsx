import React from 'react';
import type { CitedSource } from '../../lib/api';
import { SourcesPanel } from './SourcesPanel';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    sources?: CitedSource[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, sources }) => {
    const isUser = role === 'user';
    const hasSources = !isUser && sources && sources.length > 0;

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none dark:bg-gray-700 dark:text-gray-100'
                    }`}
            >
                <div className="flex items-start gap-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">{content}</p>
                    {hasSources && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-500 text-white rounded-full">
                            {sources.length}
                        </span>
                    )}
                </div>
                {hasSources && <SourcesPanel sources={sources} />}
            </div>
        </div>
    );
};
