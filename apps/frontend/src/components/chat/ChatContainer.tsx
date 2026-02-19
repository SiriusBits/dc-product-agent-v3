import React, { useState, useRef } from 'react';
import { MessageList, type Message } from './MessageList';
import { ChatInput } from './ChatInput';
import { api, type ChatMessage } from '../../lib/api';

export const ChatContainer: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am the Dixie Chemical Product Agent. How can I help you today?',
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const conversationIdRef = useRef<string | undefined>(undefined);

    // Build conversation history from messages (excluding the initial greeting)
    const buildConversationHistory = (msgs: Message[]): ChatMessage[] => {
        return msgs
            .slice(1) // Skip initial greeting
            .map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));
    };

    const handleSendMessage = async (content: string) => {
        // Clear any previous error
        setError(null);

        // Add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            // Build conversation history including the new user message
            const conversationHistory = buildConversationHistory([...messages, userMsg]);

            const response = await api.chat(
                content,
                conversationHistory,
                conversationIdRef.current
            );

            // Store conversation ID for future requests
            conversationIdRef.current = response.conversation_id;

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.answer,
                sources: response.sources,
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (err) {
            console.error('Error sending message:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Sorry, I encountered an error: ${errorMessage}`,
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-xl rounded-xl overflow-hidden my-4">
            <div className="bg-blue-600 p-4 text-white">
                <h2 className="text-lg font-semibold">Product Assistant</h2>
                {isLoading && (
                    <span className="text-xs opacity-75 ml-2">Thinking...</span>
                )}
            </div>
            {error && (
                <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 p-3 text-sm text-red-700 dark:text-red-200">
                    {error}
                </div>
            )}
            <MessageList messages={messages} />
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
    );
};
