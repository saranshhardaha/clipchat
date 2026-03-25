'use client';

import { useQuery } from '@tanstack/react-query';
import { getJob, type Job } from '@/lib/engine-client';

export function useJob(jobId: string | undefined) {
  return useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    staleTime: 2000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      // Ramp from 2s to 5s after 10 polls (long video operations)
      const count = query.state.dataUpdateCount ?? 0;
      return count < 10 ? 2000 : 5000;
    },
  });
}
