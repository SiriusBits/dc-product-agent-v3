import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '@repo/shared-types';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import ChatMessage from './ChatMessage';
import { cn } from '@/lib/utils';

interface ChatHistoryProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
  className?: string;
}

export default function ChatHistory({
  messages,
  isLoading = false,
  className,
}: ChatHistoryProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div
        className={cn(
          'flex-1 flex items-center justify-center text-center p-8',
          className
        )}
      >
        <div className="space-y-4 max-w-md">
          <div className="text-2xl font-semibold text-muted-foreground">
            Start a conversation
          </div>
          <div className="text-sm text-muted-foreground">
            Ask questions about chemical products, their properties,
            applications, or compare different products. I'll search through
            technical documents and knowledge graphs to provide accurate
            information.
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div>Try asking:</div>
            <ul className="space-y-1 text-left">
              <li>• "What is the viscosity of ASA 150?"</li>
              <li>• "Which products are good for coatings?"</li>
              <li>• "Compare DCA 467 and DCA 221"</li>
              <li>• "What products are similar to DDSA?"</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className={cn('flex-1', className)}>
      <div className="space-y-0">
        {messages.map((message, index) => (
          <div key={message.id}>
            <ChatMessage
              message={message}
              isLatest={index === messages.length - 1}
            />
            {index < messages.length - 1 && <Separator className="mx-4" />}
          </div>
        ))}

        {isLoading && (
          <>
            <Separator className="mx-4" />
            <div className="flex gap-3 p-4" data-testid="chat-loading-spinner">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-primary/20 animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      thinking...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
