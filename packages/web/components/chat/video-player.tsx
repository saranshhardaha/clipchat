'use client';

import { Video } from 'lucide-react';

interface VideoPlayerProps {
  fileId: string | null;
}

export function VideoPlayer({ fileId }: VideoPlayerProps) {
  if (!fileId) {
    return (
      <div className="flex h-full items-center justify-center bg-black/50 text-muted-foreground">
        <div className="text-center space-y-2">
          <Video className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">Upload a video and ask Claude to edit it</p>
        </div>
      </div>
    );
  }

  return (
    <video
      key={fileId}
      src={`/api/files/${fileId}/content`}
      controls
      className="h-full w-full object-contain bg-black"
    />
  );
}
