import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ChatInput({
  onSendMessage,
  isLoading = false,
  disabled = false,
  placeholder = "Ask about chemical products, properties, applications...",
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || disabled) return;

    setMessage("");
    try {
      await onSendMessage(trimmedMessage);
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Failed to send message:", error);
    }
    
    // Focus back to input
    inputRef.current?.focus();
  }, [message, onSendMessage, isLoading, disabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const canSend = message.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-12"
          maxLength={1000}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {message.length}/1000
        </div>
      </div>
      
      <Button
        onClick={handleSubmit}
        disabled={!canSend}
        size="icon"
        className="flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}