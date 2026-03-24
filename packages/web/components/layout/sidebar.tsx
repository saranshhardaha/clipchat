'use client';

import Link from 'next/link';
import { Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSessionsList } from '@/hooks/use-sessions-list';
import { SidebarItem } from './sidebar-item';

export function Sidebar() {
  const { data: sessions = [], isLoading } = useSessionsList();

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Video className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">ClipChat</span>
      </div>

      <Separator />

      {/* New Chat Button */}
      <div className="px-3 py-2">
        <Button asChild variant="outline" className="w-full justify-start gap-2" size="sm">
          <Link href="/chat">
            <Plus className="h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </div>

      <Separator />

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-0.5">
          {isLoading && (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">
              Loading...
            </p>
          )}
          {!isLoading && sessions.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">
              No sessions yet
            </p>
          )}
          {sessions.map((session) => (
            <SidebarItem key={session.id} session={session} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
