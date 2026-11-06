'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Drop the previous viewer's queries and re-read the session cookie.
 * Login, onboarding completion, and a claim change (operator, suspension) all use this.
 */
export function useAccountSessionRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(() => {
    queryClient.clear();
    router.refresh();
  }, [queryClient, router]);
}
