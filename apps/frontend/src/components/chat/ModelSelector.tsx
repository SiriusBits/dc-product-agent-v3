import React from 'react';
import type { ModelInfo, ModelProvider } from '../../lib/api';

interface ModelSelectorProps {
    models: ModelInfo[];
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    disabled?: boolean;
}

const PROVIDER_LABELS: Record<ModelProvider, string> = {
    ollama: 'Ollama (Local)',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
};

const PROVIDER_ORDER: ModelProvider[] = ['ollama', 'openai', 'anthropic'];

const PROVIDER_COLORS: Record<ModelProvider, string> = {
    ollama: 'text-green-600 dark:text-green-400',
    openai: 'text-violet-600 dark:text-violet-400',
    anthropic: 'text-orange-600 dark:text-orange-400',
};

function groupByProvider(models: ModelInfo[]): Record<ModelProvider, ModelInfo[]> {
    const groups: Record<ModelProvider, ModelInfo[]> = {
        ollama: [],
        openai: [],
        anthropic: [],
    };
    for (const model of models) {
        groups[model.provider].push(model);
    }
    return groups;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModelId,
    onModelChange,
    disabled,
}) => {
    const grouped = groupByProvider(models);

    return (
        <div className="relative">
            <select
                value={selectedModelId}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={disabled}
                className="appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                title="Select LLM model"
            >
                {PROVIDER_ORDER.map((provider) => {
                    const providerModels = grouped[provider];
                    if (providerModels.length === 0) return null;
                    return (
                        <optgroup key={provider} label={PROVIDER_LABELS[provider]}>
                            {providerModels.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </optgroup>
                    );
                })}
            </select>
            {/* Dropdown chevron */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <svg
                    className="h-4 w-4 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                    />
                </svg>
            </div>
        </div>
    );
};
