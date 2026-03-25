'use client';

import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useJob } from '@/hooks/use-job';
import { cn } from '@/lib/utils';
import type { ToolCallCard } from '@/hooks/use-chat';

const TOOL_LABELS: Record<string, string> = {
  trim_video: 'Trim',
  merge_clips: 'Merge',
  resize_video: 'Resize',
  crop_video: 'Crop',
  rotate_flip: 'Rotate',
  color_adjust: 'Color',
  extract_audio: 'Extract Audio',
  replace_audio: 'Replace Audio',
  add_text_overlay: 'Add Text',
  add_subtitles: 'Subtitles',
  change_speed: 'Speed',
  export_video: 'Export',
  get_video_info: 'Info',
};

interface TimelineStepProps {
  toolCall: ToolCallCard;
  isActive: boolean;
  onClick: () => void;
}

export function TimelineStep({ toolCall, isActive, onClick }: TimelineStepProps) {
  const { data: job } = useJob(toolCall.job_id || undefined);
  const label = TOOL_LABELS[toolCall.tool] ?? toolCall.tool;
  const status = job?.status ?? 'queued';

  const Icon =
    status === 'completed' ? CheckCircle2 :
    status === 'failed' ? AlertCircle :
    status === 'processing' ? Loader2 :
    Circle;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          status === 'processing' && 'animate-spin',
          status === 'completed' && 'text-green-500',
          status === 'failed' && 'text-destructive'
        )}
      />
      <span>{label}</span>
      {status !== 'completed' && status !== 'queued' && (
        <Badge
          variant={status === 'failed' ? 'destructive' : 'secondary'}
          className="h-4 px-1 text-[10px]"
        >
          {status}
        </Badge>
      )}
    </button>
  );
}
