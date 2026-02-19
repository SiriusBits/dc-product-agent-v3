import React, { useState } from 'react';
import { ModelSelector } from './ModelSelector';
import type { ModelInfo } from '../../lib/api';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    models: ModelInfo[];
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled,
    models,
    selectedModelId,
    onModelChange,
}) => {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about chemical products..."
                        className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none max-h-32"
                        rows={1}
                        disabled={disabled}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || disabled}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Send
                    </button>
                </div>
                {models.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Model:</span>
                        <ModelSelector
                            models={models}
                            selectedModelId={selectedModelId}
                            onModelChange={onModelChange}
                            disabled={disabled}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
