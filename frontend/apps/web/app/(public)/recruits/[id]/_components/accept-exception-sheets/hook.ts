'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { RECRUIT } from '@/lib/policy';

import {
  acceptApplication,
  applicantsOptions,
  type AcceptResult,
  type RecruitDetail,
} from '../../_lib/detail-queries';

export function useAcceptExceptionSheets() {
  const teamRequired = useOverlay('recruit-team-required');
  const roleFull = useOverlay('recruit-role-full');
  return { teamRequired, roleFull };
}

type UseRoleFullBodyArgs = {
  recruit: RecruitDetail;
  applicationId: string;
  overlay: OverlayControl;
};

export function useRoleFullBody({ recruit, applicationId, overlay }: UseRoleFullBodyArgs) {
  const viewer = useViewer();
  const client = useQueryClient();
  const recruitId = String(recruit.id);
  const applicants = useQuery(applicantsOptions(viewer.login, recruitId));
  const row = applicants.data?.items.find((item) => item.id === Number(applicationId));
  const role = recruit.roles.find((item) => item.id === row?.roleId);
  const atMax = role !== undefined && role.headcount >= RECRUIT.headcountPerRole.max;
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);

  const accept = useMutation({
    mutationFn: () =>
      acceptApplication(recruitId, Number(applicationId), { increaseHeadcount: true }),
    onSuccess: async (result) => {
      setAccepted(result);
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

  return {
    row,
    role,
    atMax,
    accepted,
    accept,
    headcountMax: RECRUIT.headcountPerRole.max,
    close: () => overlay.close(),
    acceptWithIncrease: () => {
      if (!accept.isPending && row) accept.mutate();
    },
  };
}
