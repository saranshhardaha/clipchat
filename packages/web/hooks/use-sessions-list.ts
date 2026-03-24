'use client';

import { useQuery } from '@tanstack/react-query';
import { getSessions, type Session } from '@/lib/engine-client';

export function useSessionsList() {
  return useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: getSessions,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
