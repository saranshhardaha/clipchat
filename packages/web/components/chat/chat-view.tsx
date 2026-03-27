'use client';

import { useState, useMemo } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useJob } from '@/hooks/use-job';
import { VideoPlayer } from './video-player';
import { EditTimeline } from './edit-timeline';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';

interface ChatViewProps {
  initialSessionId?: string;
}

export function ChatView({ initialSessionId }: ChatViewProps) {
  const { messages, isStreaming, sendMessage } = useChat(initialSessionId);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [playerFileId, setPlayerFileId] = useState<string | null>(null);
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);

  // All tool calls across all messages (for the timeline)
  const allToolCalls = useMemo(
    () => messages.flatMap((m) => m.toolCalls),
    [messages]
  );

  // Last tool call job (fallback when nothing is actively selected)
  const lastJobId = allToolCalls[allToolCalls.length - 1]?.job_id ?? null;
  const effectiveJobId = activeJobId ?? lastJobId;

  const { data: effectiveJob } = useJob(effectiveJobId ?? undefined);
  const autoFileId =
    effectiveJob?.status === 'completed'
      ? (effectiveJob.output?.output_file as string | undefined) ?? null
      : null;

  // Priority: manual "Load in Player" > active job output > uploaded source
  const displayFileId = playerFileId ?? autoFileId ?? sourceFileId;

  const isOriginalActive = displayFileId === sourceFileId && displayFileId !== null;

  const playerLabel = playerFileId
    ? 'Custom'
    : autoFileId && displayFileId === autoFileId
      ? 'Edited'
      : sourceFileId && isOriginalActive
        ? 'Original'
        : undefined;

  function handleOriginalSelect() {
    setPlayerFileId(sourceFileId);
    setActiveJobId(null);
  }

  function handleStepSelect(jobId: string) {
    setActiveJobId(jobId);
    setPlayerFileId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Video Player — 40% height */}
      <div className="h-[40%] min-h-[200px] shrink-0 bg-black">
        <VideoPlayer fileId={displayFileId} label={playerLabel} />
      </div>

      {/* Edit Timeline — fixed 72px */}
      <div className="h-[72px] shrink-0">
        <EditTimeline
          steps={allToolCalls}
          activeJobId={activeJobId}
          onStepSelect={handleStepSelect}
          sourceFileId={sourceFileId}
          isOriginalActive={isOriginalActive}
          onOriginalSelect={handleOriginalSelect}
        />
      </div>

      {/* Messages — flex-grow fills remaining space */}
      <MessageList
        messages={messages}
        onLoadInPlayer={setPlayerFileId}
      />

      {/* Chat Input */}
      <ChatInput
        onSend={sendMessage}
        isStreaming={isStreaming}
        onFileUploaded={setSourceFileId}
      />
    </div>
  );
}
