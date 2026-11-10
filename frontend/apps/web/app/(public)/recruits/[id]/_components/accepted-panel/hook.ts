'use client';

import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/api-error';
import { toast } from '@/stores/toast-store';

import { sendGithubInvite, type InviteResult } from '../../_lib/detail-queries';

/** Retry only: the first GitHub org invite already went out with the invite (POL-R-4) */
export function useAcceptedPanel(result: InviteResult, applicantId: number) {
  const retry = useMutation({
    mutationFn: () => sendGithubInvite(result.teamId, applicantId),
    onSuccess: () => toast('GitHub 조직 초대를 보냈어요.'),
  });
  const retryError =
    retry.error instanceof ApiError
      ? retry.error.message
      : retry.isError
        ? 'GitHub 조직 초대를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return {
    githubSent: result.githubSent || retry.isSuccess,
    retryPending: retry.isPending,
    retryError,
    retry: () => {
      if (!retry.isPending && !retry.isSuccess) retry.mutate();
    },
  };
}
