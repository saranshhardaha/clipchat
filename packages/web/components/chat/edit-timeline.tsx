'use client';

import { ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineStep } from './timeline-step';
import type { ToolCallCard } from '@/hooks/use-chat';

interface EditTimelineProps {
  steps: ToolCallCard[];
  activeJobId: string | null;
  onStepSelect: (jobId: string) => void;
}

export function EditTimeline({ steps, activeJobId, onStepSelect }: EditTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border-t border-border px-4">
        <p className="text-xs text-muted-foreground">Edit timeline will appear here as you work</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center border-t border-border px-3">
      <ScrollArea className="w-full" orientation="horizontal">
        <div className="flex items-center gap-1.5 py-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground mr-1">Timeline</span>
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
              <TimelineStep
                toolCall={step}
                isActive={activeJobId === step.job_id}
                onClick={() => step.job_id && onStepSelect(step.job_id)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
