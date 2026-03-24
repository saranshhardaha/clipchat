'use client';

import { Wrench, Download, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useJob } from '@/hooks/use-job';
import type { ToolCallCard as ToolCallCardType } from '@/hooks/use-chat';

const TOOL_LABELS: Record<string, string> = {
  trim_video: 'Trim Video',
  merge_clips: 'Merge Clips',
  resize_video: 'Resize Video',
  extract_audio: 'Extract Audio',
  replace_audio: 'Replace Audio',
  add_text_overlay: 'Add Text Overlay',
  add_subtitles: 'Add Subtitles',
  change_speed: 'Change Speed',
  export_video: 'Export Video',
  get_video_info: 'Get Video Info',
};

interface ToolCallCardProps {
  toolCall: ToolCallCardType;
  onLoadInPlayer: (fileId: string) => void;
}

export function ToolCallCard({ toolCall, onLoadInPlayer }: ToolCallCardProps) {
  const { data: job } = useJob(toolCall.job_id || undefined);
  const label = TOOL_LABELS[toolCall.tool] ?? toolCall.tool;
  const status = job?.status ?? 'queued';
  const progress = job?.progress ?? 0;
  const outputFileId = job?.output?.output_file as string | undefined;

  return (
    <div className="mt-2 rounded-lg border border-border bg-card p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <Badge
          variant={
            status === 'completed' ? 'default' :
            status === 'failed' ? 'destructive' :
            'secondary'
          }
          className="text-[10px]"
        >
          {status}
        </Badge>
      </div>

      {(status === 'processing' || status === 'queued') && (
        <Progress value={status === 'queued' ? 0 : progress} className="h-1.5" />
      )}

      {status === 'failed' && job?.error && (
        <div className="flex items-start gap-1.5 text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{job.error}</span>
        </div>
      )}

      {status === 'completed' && outputFileId && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onLoadInPlayer(outputFileId)}
          >
            Load in Player
          </Button>
          <a
            href={`/api/files/${outputFileId}/content`}
            download
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
