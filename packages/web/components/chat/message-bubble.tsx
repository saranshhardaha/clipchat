'use client';

import { cn } from '@/lib/utils';
import { ToolCallCard } from './tool-call-card';
import type { Message } from '@/hooks/use-chat';

interface MessageBubbleProps {
  message: Message;
  onLoadInPlayer: (fileId: string) => void;
}

export function MessageBubble({ message, onLoadInPlayer }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {/* Text content */}
        {message.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        )}

        {/* Error indicator */}
        {message.hasError && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <span aria-hidden>⚠</span> Something went wrong. Please try again.
          </p>
        )}

        {/* Tool call cards (assistant only) */}
        {message.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} toolCall={tc} onLoadInPlayer={onLoadInPlayer} />
        ))}

        {/* Streaming indicator */}
        {!isUser && !message.content && message.toolCalls.length === 0 && (
          <span className="flex gap-0.5 items-center h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}
