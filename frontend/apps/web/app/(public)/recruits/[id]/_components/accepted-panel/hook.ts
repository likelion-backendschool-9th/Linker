'use client';

import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/api-error';
import { toast } from '@/stores/toast-store';

import { sendGithubInvite, type AcceptResult } from '../../_lib/detail-queries';

export function useAcceptedPanel(result: AcceptResult, applicantId: number) {
  const invite = useMutation({
    mutationFn: () => sendGithubInvite(result.teamId, applicantId),
    onSuccess: () => toast('GitHub 조직 초대를 보냈어요.'),
  });
  const inviteError =
    invite.error instanceof ApiError
      ? invite.error.message
      : invite.isError
        ? 'GitHub 조직 초대를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return {
    invitePending: invite.isPending,
    inviteSuccess: invite.isSuccess,
    inviteError,
    sendInvite: () => {
      if (!invite.isPending && !invite.isSuccess) invite.mutate();
    },
  };
}
