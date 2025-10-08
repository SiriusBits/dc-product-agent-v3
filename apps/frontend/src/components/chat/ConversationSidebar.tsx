import { useState } from "react";
import { MessageSquare, Trash2, Edit2, Plus, Loader2 } from "lucide-react";
import type { Conversation } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading?: boolean;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  className?: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onUpdateTitle,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || "");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      try {
        await onUpdateTitle(editTitle.trim());
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      setIsDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  return (
    <Card className={cn(
      "cursor-pointer transition-colors hover:bg-accent/50",
      isActive && "bg-accent border-primary"
    )}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between space-x-2">
          <div className="flex-1 min-w-0" onClick={onSelect}>
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveTitle();
                  } else if (e.key === "Escape") {
                    setEditTitle(conversation.title || "");
                    setIsEditing(false);
                  }
                }}
                className="h-6 text-sm"
                autoFocus
              />
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-medium truncate">
                  {conversation.title || "Untitled Conversation"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(conversation.updated_at)}
                </div>
                {conversation.metadata?.message_count && (
                  <div className="text-xs text-muted-foreground">
                    {conversation.metadata.message_count} messages
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConversationSidebar({
  conversations,
  currentConversationId,
  isLoading = false,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onUpdateTitle,
  className,
}: ConversationSidebarProps) {
  return (
    <div className={cn("w-80 border-r bg-background/50", className)}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="font-semibold">Conversations</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            className="flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No conversations yet.
            <br />
            Start a new chat to begin.
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onSelect={() => onSelectConversation(conversation.id)}
                onDelete={() => onDeleteConversation(conversation.id)}
                onUpdateTitle={(title) => onUpdateTitle(conversation.id, title)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}