import { memo, useState } from 'react';
import {
  User,
  Bot,
  ExternalLink,
  FileText,
  Database,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import type {
  ChatMessage as ChatMessageType,
  RetrievalResult,
} from '@repo/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest?: boolean;
}

interface SourceCardProps {
  source: RetrievalResult;
  index: number;
}

const SourceCard = memo(({ source, index }: SourceCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'vector':
        return <Database className="h-3 w-3" />;
      case 'kg':
        return <GitBranch className="h-3 w-3" />;
      case 'hybrid':
        return <GitBranch className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getSourceColor = (sourceType: string) => {
    switch (sourceType) {
      case 'vector':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'kg':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'hybrid':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const documentName =
    source.provenance?.document ||
    source.metadata?.document ||
    source.metadata?.filename ||
    'Unknown Document';
  const page = source.metadata?.page;
  const confidence = Math.round(source.score * 100);

  const handleToggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      className={cn(
        'text-xs border cursor-pointer',
        getSourceColor(source.source)
      )}
      onClick={handleToggleExpansion}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {getSourceIcon(source.source)}
            <Badge variant="outline" className="text-xs">
              {source.source.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {confidence}% confidence
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium">#{index + 1}</span>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-medium text-xs truncate" title={documentName}>
            {documentName}
          </div>
          {page && (
            <div className="text-xs text-muted-foreground">Page {page}</div>
          )}
        </div>

        {isExpanded && (
          <div className="text-xs leading-relaxed">{source.content}</div>
        )}

        {isExpanded && source.metadata?.url && (
          <div className="pt-1">
            <a
              href={source.metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              <span>View Source</span>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

SourceCard.displayName = 'SourceCard';

const ChatMessage = memo(({ message, isLatest = false }: ChatMessageProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isUser = message.role === 'user';
  const hasSource = message.sources && message.sources.length > 0;
  const isPending = !message.content && message.role === 'assistant';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  return (
    <div
      data-testid="message-container"
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'justify-end' : 'justify-start',
        isLatest && !isUser
          ? 'animate-in slide-in-from-left-2 duration-300'
          : ''
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col space-y-2 max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'relative group rounded-lg px-4 py-2 text-sm',
            isUser ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isPending ? (
            <div
              className="flex items-center space-x-2"
              data-testid="message-loading"
            >
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
              <span className="text-xs text-muted-foreground">thinking...</span>
            </div>
          ) : (
            <>
              <div className="break-words">
                {isUser ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  renderMarkdown(message.content)
                )}
              </div>
              {!isUser && message.content && (isHovered || isCopied) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                  aria-label="Copy message"
                >
                  {isCopied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {hasSource && !isUser && (
          <>
            <Separator className="my-2" />
            <div className="w-full space-y-2">
              <div className="text-xs font-medium text-muted-foreground flex items-center space-x-1">
                <FileText className="h-3 w-3" />
                <span>Sources ({message.sources!.length})</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {message.sources!.slice(0, 4).map((source, index) => (
                  <SourceCard
                    key={`${source.metadata?.document || 'unknown'}-${index}`}
                    source={source}
                    index={index}
                  />
                ))}
              </div>
              {message.sources!.length > 4 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  +{message.sources!.length - 4} more sources
                </div>
              )}
            </div>
          </>
        )}

        <div className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>
        </div>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
