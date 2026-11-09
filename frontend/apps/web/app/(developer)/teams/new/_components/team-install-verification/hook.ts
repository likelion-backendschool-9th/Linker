'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useViewer } from '@/lib/auth/viewer-context';
import {
  installationRequest,
  isInstalledOrganization,
  verifiedInstallationKey,
} from '../../_lib/installation';
import { verifyInstallation } from './api';
import type { SetupOutcome } from '../team-setup-outcome';

export function useTeamInstallVerification() {
  const params = useSearchParams();
  const viewer = useViewer();
  const request = installationRequest(new URLSearchParams(params.toString()));
  const client = useQueryClient();
  const router = useRouter();
  // One-use state: deduplicate mounts, never retry or refetch a consumed callback.
  const verification = useQuery({
    queryKey: ['team-setup', 'verify', viewer.login, request],
    queryFn: () => verifyInstallation(request!, { cache: 'no-store' }),
    enabled: !!request,
    staleTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const result = verification.data;
  const state: SetupOutcome = !request
    ? 'INVALID_RETURN'
    : result?.result === 'INSTALLED' && !isInstalledOrganization(result)
      ? 'FAILED'
      : (result?.result ?? 'FAILED');

  useEffect(() => {
    if (isInstalledOrganization(result)) {
      client.setQueryData(verifiedInstallationKey(viewer.login), result);
      router.replace('/teams/new?step=2');
    }
  }, [result, client, router, viewer.login]);

  return { request, verification, result, state, router };
}
