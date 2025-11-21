import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

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

        // Simulate API call
        setTimeout(() => {
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I received your message: "${content}". This is a placeholder response.`,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsLoading(false);
        }, 1000);
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
