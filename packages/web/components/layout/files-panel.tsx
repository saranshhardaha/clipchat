'use client';

import { FileVideo, FileAudio, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFilesList } from '@/hooks/use-files-list';
import type { FileRecord } from '@/lib/engine-client';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileItem({ file }: { file: FileRecord }) {
  const isAudio = file.mime_type.startsWith('audio/');
  const Icon = isAudio ? FileAudio : FileVideo;

  function handleUse() {
    window.dispatchEvent(
      new CustomEvent('clipchat:select-file', {
        detail: { fileId: file.id, fileName: file.original_name },
      })
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/50 group">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">{file.original_name}</p>
        <p className="text-muted-foreground">{formatBytes(file.size_bytes)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="secondary"
          className="h-6 px-2 text-[10px]"
          onClick={handleUse}
        >
          Use
        </Button>
        <a
          href={`/api/files/${file.id}/content`}
          download={file.original_name}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Download"
        >
          <ArrowDownToLine className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export function FilesPanel() {
  const { data, isLoading } = useFilesList();
  const files = data?.files ?? [];

  return (
    <ScrollArea className="flex-1">
      <div className="px-2 py-2 space-y-0.5">
        {isLoading && (
          <p className="px-2 py-4 text-xs text-muted-foreground text-center">Loading…</p>
        )}
        {!isLoading && files.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground text-center">No files yet</p>
        )}
        {files.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>
    </ScrollArea>
  );
}
