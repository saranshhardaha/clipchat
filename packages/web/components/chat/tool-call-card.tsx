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
  crop_video: 'Crop Video',
  rotate_flip: 'Rotate / Flip',
  color_adjust: 'Color Adjust',
  extract_audio: 'Extract Audio',
  replace_audio: 'Replace Audio',
  add_text_overlay: 'Add Text Overlay',
  add_subtitles: 'Add Subtitles',
  change_speed: 'Change Speed',
  export_video: 'Export Video',
  get_video_info: 'Get Video Info',
};

function formatInputSummary(tool: string, input: Record<string, unknown>): string | null {
  switch (tool) {
    case 'trim_video':
      return input.start_time != null && input.end_time != null
        ? `${input.start_time}s → ${input.end_time}s` : null;
    case 'merge_clips': {
      const count = Array.isArray(input.input_files) ? input.input_files.length : '?';
      const t = input.transition as string | undefined;
      return t && t !== 'none' ? `${count} clips · ${t}` : `${count} clips`;
    }
    case 'resize_video':
      return (input.preset as string) ?? (input.width && input.height ? `${input.width}×${input.height}` : null);
    case 'crop_video':
      return (input.preset as string) ?? (input.width && input.height ? `${input.width}×${input.height}` : null);
    case 'rotate_flip': {
      const parts = [input.rotation ? `${input.rotation}°` : null, input.flip as string | null].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'color_adjust': {
      const parts = [
        input.brightness != null ? `brightness ${input.brightness}` : null,
        input.saturation != null ? `saturation ${input.saturation}` : null,
        input.contrast != null ? `contrast ${input.contrast}` : null,
        input.hue != null ? `hue ${input.hue}°` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'change_speed':
      return input.speed_factor != null ? `${input.speed_factor}×` : null;
    case 'export_video':
      return [input.format, input.quality].filter(Boolean).join(' · ') || null;
    case 'add_text_overlay':
      return typeof input.text === 'string' ? `"${input.text.slice(0, 40)}${input.text.length > 40 ? '…' : ''}"` : null;
    case 'extract_audio':
      return [input.format, input.quality].filter(Boolean).join(' · ') || null;
    case 'replace_audio':
      return input.mix ? 'mix mode' : 'replace mode';
    default:
      return null;
  }
}

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
  const inputSummary = formatInputSummary(toolCall.tool, toolCall.input);

  return (
    <div
      className="mt-2 rounded-lg border border-border bg-card p-3 text-sm space-y-2"
      role="region"
      aria-label={`Tool: ${label}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <span className="font-medium">{label}</span>
            {inputSummary && (
              <p className="text-xs text-muted-foreground truncate">{inputSummary}</p>
            )}
          </div>
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
