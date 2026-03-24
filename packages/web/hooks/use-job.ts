'use client';

import { useQuery } from '@tanstack/react-query';
import { getJob, type Job } from '@/lib/engine-client';

export function useJob(jobId: string | undefined) {
  return useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000;
    },
    staleTime: 0,
  });
}
