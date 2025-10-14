import {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type KeyboardEvent,
} from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export interface ChatInputRef {
  focus: () => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      onSendMessage,
      isLoading = false,
      disabled = false,
      placeholder = 'Ask about chemical products, properties, applications...',
      className,
    },
    ref
  ) => {
    const [message, setMessage] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const handleSubmit = useCallback(async () => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage || isLoading || disabled) return;

      setMessage('');
      try {
        await onSendMessage(trimmedMessage);
      } catch (error) {
        // Error handling is done in the parent component
        console.error('Failed to send message:', error);
      }

      // Focus back to input
      inputRef.current?.focus();
    }, [message, onSendMessage, isLoading, disabled]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
        // Shift+Enter allows new line (default behavior)
      },
      [handleSubmit]
    );

    const canSend = message.trim().length > 0 && !isLoading && !disabled;

    return (
      <div className={cn('flex items-end space-x-2', className)}>
        <div className="flex-1 relative">
          <Textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="pr-12 min-h-[44px] max-h-[200px] resize-none"
            maxLength={1000}
            rows={1}
            style={{
              height: 'auto',
              minHeight: '44px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          />
          <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
            {message.length}/1000
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSend}
          size="icon"
          className="flex-shrink-0"
          aria-label="Send message"
          title="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
