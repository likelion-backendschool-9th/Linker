'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import {
  acceptApplication,
  applicationOptions,
  type AcceptResult,
  type RecruitDetail,
} from '../../_lib/detail-queries';

export function useApplicationSheet() {
  return useOverlay('recruit-application');
}

type UseApplicationBodyArgs = {
  recruit: RecruitDetail;
  applicationId: string;
  overlay: OverlayControl;
};

export function useApplicationBody({ recruit, applicationId, overlay }: UseApplicationBodyArgs) {
  const viewer = useViewer();
  const client = useQueryClient();
  const recruitId = String(recruit.id);
  const application = useQuery(applicationOptions(viewer.login, recruitId, applicationId));
  const rejectSheet = useOverlay('recruit-reject');
  const teamRequired = useOverlay('recruit-team-required');
  const roleFull = useOverlay('recruit-role-full');
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);

  const accept = useMutation({
    mutationFn: () => acceptApplication(recruitId, Number(applicationId)),
    onSuccess: async (result) => {
      setAccepted(result);
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    onError: (error) => {
      // The two exceptions with their own sheet (04 ch. 5); PLAN_LIMIT opens the shared limit sheet
      if (error instanceof ApiError && error.code === 'TEAM_REQUIRED') teamRequired.open();
      if (error instanceof ApiError && error.code === 'ROLE_FULL') roleFull.open(applicationId);
    },
  });

  const acceptError =
    accept.error instanceof ApiError &&
    !['TEAM_REQUIRED', 'ROLE_FULL', 'PLAN_LIMIT'].includes(accept.error.code)
      ? accept.error.message
      : accept.isError && !(accept.error instanceof ApiError)
        ? '수락하지 못했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return {
    application,
    accepted,
    acceptPending: accept.isPending,
    acceptError,
    openReject: () => rejectSheet.open(applicationId),
    acceptApplication: () => {
      if (!accept.isPending) accept.mutate();
    },
    close: () => overlay.close(),
  };
}
