'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import type { Message } from '@/hooks/use-chat';

interface MessageListProps {
  messages: Message[];
  onLoadInPlayer: (fileId: string) => void;
}

export function MessageList({ messages, onLoadInPlayer }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Start a conversation</p>
          <p className="text-xs">Upload a video and tell Claude what to do with it</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-3 p-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onLoadInPlayer={onLoadInPlayer}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
