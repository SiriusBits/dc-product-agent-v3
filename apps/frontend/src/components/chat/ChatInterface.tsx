
import { useState, useCallback } from "react";
import { AlertCircle, RefreshCw, Sidebar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import ConversationSidebar from "./ConversationSidebar";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  className?: string;
}

export default function ChatInterface({ className }: ChatInterfaceProps) {
  const [showSidebar, setShowSidebar] = useState(true);
  
  const {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearMessages,
    loadConversation,
    retryLastMessage,
  } = useChat({
    maxResults: 10,
    includeSource: true,
  });

  const {
    conversations,
    isLoading: conversationsLoading,
    error: conversationsError,
    deleteConversation,
    updateConversationTitle,
  } = useConversations();

  const handleSelectConversation = useCallback(async (id: string) => {
    if (id !== conversationId) {
      await loadConversation(id);
    }
  }, [conversationId, loadConversation]);

  const handleNewConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (id === conversationId) {
      clearMessages();
    }
  }, [conversationId, deleteConversation, clearMessages]);

  const handleRetry = useCallback(async () => {
    await retryLastMessage();
  }, [retryLastMessage]);

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {showSidebar && (
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={conversationId}
          isLoading={conversationsLoading}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onUpdateTitle={updateConversationTitle}
        />
      )}

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <Sidebar className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Chemical Product Assistant</h1>
                <p className="text-sm text-muted-foreground">
                  Ask questions about chemical products, properties, and applications
                </p>
              </div>
            </div>
            
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
              >
                New Chat
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {(error || conversationsError) && (
          <div className="p-4">
            <Card className="border-destructive/50 bg-destructive/5">
              <div className="p-4 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-destructive">
                    {error || conversationsError}
                  </div>
                </div>
                {error && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="flex items-center space-x-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry</span>
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Chat History */}
        <ChatHistory
          messages={messages}
          isLoading={isLoading}
          className="flex-1"
        />

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSendMessage={sendMessage}
              isLoading={isLoading}
              disabled={!!error}
              placeholder="Ask about chemical products, properties, applications..."
            />
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}