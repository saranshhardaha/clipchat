'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight, Film } from 'lucide-react';
import { TimelineStep } from './timeline-step';
import type { ToolCallCard } from '@/hooks/use-chat';

interface EditTimelineProps {
  steps: ToolCallCard[];
  activeJobId: string | null;
  onStepSelect: (jobId: string) => void;
  sourceFileId?: string | null;
  isOriginalActive?: boolean;
  onOriginalSelect?: () => void;
}

export function EditTimeline({
  steps,
  activeJobId,
  onStepSelect,
  sourceFileId,
  isOriginalActive,
  onOriginalSelect,
}: EditTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest step when steps are added
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  }, [steps.length]);

  const hasContent = steps.length > 0 || sourceFileId;

  if (!hasContent) {
    return (
      <div className="flex h-full items-center justify-center border-t border-border px-4">
        <p className="text-xs text-muted-foreground">Edit timeline will appear here as you work</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center border-t border-border px-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 py-2 min-w-max">
        <span className="shrink-0 text-xs font-medium text-muted-foreground mr-1">Timeline</span>

        {/* Original source step */}
        {sourceFileId && (
          <button
            onClick={onOriginalSelect}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors shrink-0 ${
              isOriginalActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            <Film className="h-3 w-3" />
            Original
          </button>
        )}

        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1.5">
            {/* Chevron before each step (always — Original or previous step provides the left side) */}
            {(i > 0 || sourceFileId) && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            )}
            <TimelineStep
              toolCall={step}
              isActive={activeJobId === step.job_id}
              onClick={() => step.job_id && onStepSelect(step.job_id)}
            />
          </div>
        ))}

        <div ref={endRef} />
      </div>
    </div>
  );
}
