'use client';

import { useRef, useEffect, useState } from 'react';
import { Video, AlertTriangle } from 'lucide-react';

interface VideoPlayerProps {
  fileId: string | null;
  label?: string;
}

export function VideoPlayer({ fileId, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      setLoadError(false);
      videoRef.current.load();
    }
  }, [fileId]);

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

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-black/50 text-muted-foreground">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive opacity-70" />
          <p className="text-sm">Could not load video</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={`/api/files/${fileId}/content`}
        controls
        className="h-full w-full object-contain bg-black"
        onError={() => setLoadError(true)}
      />
      {label && (
        <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}
