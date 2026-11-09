'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  acceptApplication,
  applicantsOptions,
  sendGithubInvite,
  type ApplicantRow,
  type ApplicationStatus,
  type RecruitDetail,
} from '../../_lib/detail-queries';

/**
 * Drawer row labels (초대 is the bottom CTA only):
 * PENDING → 거절 action · ACCEPTED → 대기 (stays) · REJECTED/EXPIRED → 완료 (leave list)
 */
export const APPLICANT_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: '거절',
  ACCEPTED: '대기',
  REJECTED: '완료',
  EXPIRED: '완료',
};

export function useApplicantsSheet() {
  return useOverlay('recruit-applicants');
}

export function useApplicantList(recruit: RecruitDetail) {
  const viewer = useViewer();
  const applicants = useQuery(applicantsOptions(viewer.login, String(recruit.id)));
  const [roleId, setRoleId] = useQueryState(
    'role',
    parseAsInteger.withOptions({ history: 'replace' }),
  );

  // 완료(거절·만료)는 목록에서 빠지고, 대기(초대됨)와 미처리만 남음
  const visible = (applicants.data?.items ?? []).filter(
    (item) => item.status === 'PENDING' || item.status === 'ACCEPTED',
  );
  const all = visible;
  const items = roleId === null ? all : all.filter((item) => item.roleId === roleId);

  return {
    applicants,
    all,
    items,
    roleId,
    setRoleId: (next: number | null) => void setRoleId(next),
  };
}

export function isInviteable(recruit: RecruitDetail, item: ApplicantRow | null) {
  if (!item || item.status !== 'PENDING') return false;
  const role = recruit.roles.find((entry) => entry.id === item.roleId);
  return (role?.remaining ?? 0) > 0;
}

/** Invite / reject actions for the applicants drawer */
export function useApplicantActions(recruit: RecruitDetail) {
  const client = useQueryClient();
  const recruitId = String(recruit.id);
  const roleFull = useOverlay('recruit-role-full');
  const rejectSheet = useOverlay('recruit-reject');

  const invite = useMutation({
    mutationFn: async (item: ApplicantRow) => {
      const result = await acceptApplication(recruitId, item.id);
      if (result.needsGithubInvite) {
        await sendGithubInvite(result.teamId, item.applicant.id);
      }
      return result;
    },
    onSuccess: async (result) => {
      toast(
        result.needsGithubInvite
          ? '조직 초대를 보냈어요.'
          : '팀으로 초대했어요. 팀 채팅에 들어갔어요.',
      );
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    onError: (error, item) => {
      if (error instanceof ApiError && error.code === 'ROLE_FULL') {
        roleFull.open(String(item.id));
      }
    },
  });

  return {
    invitePending: invite.isPending,
    invite: (item: ApplicantRow) => {
      if (!invite.isPending && isInviteable(recruit, item)) invite.mutate(item);
    },
    openReject: (applicationId: number) => rejectSheet.open(String(applicationId)),
  };
}
