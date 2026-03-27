'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Video, MessageSquare, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSessionsList } from '@/hooks/use-sessions-list';
import { SidebarItem } from './sidebar-item';
import { FilesPanel } from './files-panel';

type Tab = 'chats' | 'files';

export function Sidebar() {
  const { data: sessions = [], isLoading } = useSessionsList();
  const [activeTab, setActiveTab] = useState<Tab>('chats');

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-background" aria-label="Navigation">
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

      {/* Tabs */}
      <div className="flex px-2 pt-2 gap-1">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
            activeTab === 'chats'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chats
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
            activeTab === 'files'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Files
        </button>
      </div>

      {/* Panel content */}
      {activeTab === 'chats' ? (
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
      ) : (
        <FilesPanel />
      )}
    </aside>
  );
}
