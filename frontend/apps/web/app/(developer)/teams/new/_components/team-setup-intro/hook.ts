'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api/api-error';
import { postToNative } from '@/lib/bridge/native';
import { toast } from '@/stores/toast-store';

import { installDestination } from '../../_lib/install-destination';
import { getInstallUrl } from './api';
import { useViewer } from '@/lib/auth/viewer-context';
import { createdSetupTeamKey, verifiedInstallationKey } from '../../_lib/installation';

export function useTeamInstall() {
  const router = useRouter();
  const client = useQueryClient();
  const viewer = useViewer();
  return useMutation({
    onMutate: () => {
      client.removeQueries({ queryKey: verifiedInstallationKey(viewer.login) });
      client.removeQueries({ queryKey: createdSetupTeamKey(viewer.login) });
    },
    mutationFn: async () =>
      installDestination(await getInstallUrl({ cache: 'no-store' }), window.location.origin),
    onSuccess: (destination) => {
      if (destination.origin === window.location.origin) {
        router.push(`${destination.pathname}${destination.search}` as Route);
        return;
      }
      // Installation is not the login bridge flow. Never pass a session JWT to native.
      if (!postToNative({ type: 'OPEN_EXTERNAL', url: destination.href })) {
        window.location.assign(destination.href);
      }
    },
    onError: (error) => {
      // Account/plan/GitHub failures are already handled by the common mutation cache.
      if (
        error instanceof ApiError &&
        [
          'LOGIN_REQUIRED',
          'PLAN_LIMIT',
          'RATE_LIMITED',
          'SUSPENDED',
          'GITHUB_UNAVAILABLE',
        ].includes(error.code)
      )
        return;
      toast(error instanceof ApiError ? error.message : '잠시 후 다시 시도해 주세요.', {
        tone: 'alert',
      });
    },
  });
}
