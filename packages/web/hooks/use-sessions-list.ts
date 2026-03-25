'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getSessions, type Session } from '@/lib/engine-client';

export function useSessionsList() {
  return useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: getSessions,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useInvalidateSessions() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ['sessions'] }), [qc]);
}
