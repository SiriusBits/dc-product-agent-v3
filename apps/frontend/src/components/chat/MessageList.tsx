import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { CitedSource } from '../../lib/api';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: CitedSource[];
}

interface MessageListProps {
    messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
                <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    sources={msg.sources}
                />
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
