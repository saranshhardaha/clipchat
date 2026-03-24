'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from '@/lib/engine-client';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function SidebarItem({ session }: { session: Session }) {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${session.id}`;
  const title = session.title ?? 'Untitled session';
  const truncated = title.length > 28 ? title.slice(0, 28) + '…' : title;

  return (
    <Link
      href={`/chat/${session.id}`}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <div className="flex-1 overflow-hidden">
        <p className="truncate leading-tight">{truncated}</p>
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          {formatRelativeTime(session.updated_at)}
        </p>
      </div>
    </Link>
  );
}
