'use client';

import { useQuery } from '@tanstack/react-query';
import type { FileRecord } from '@/lib/engine-client';

interface FilesListResponse {
  files: FileRecord[];
  limit: number;
  offset: number;
}

export function useFilesList(limit = 50, offset = 0) {
  return useQuery<FilesListResponse>({
    queryKey: ['files', limit, offset],
    queryFn: async () => {
      const res = await fetch(`/api/files?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch files');
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
