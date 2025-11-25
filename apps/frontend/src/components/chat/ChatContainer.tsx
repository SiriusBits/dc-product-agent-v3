import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { api } from '../../lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export const ChatContainer: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am the Dixie Chemical Product Agent. How can I help you today?',
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = async (content: string) => {
        // Add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await api.query(content); // Assuming 'api' is defined elsewhere or imported

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.answer,
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request.',
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
            </div>
            <MessageList messages={messages} />
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
    );
};
