'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import {
  applicantsOptions,
  type ApplicationStatus,
  type RecruitDetail,
} from '../../_lib/detail-queries';

/** What the author sees per status; pending also shows days left until the 14-day expiry */
export const APPLICANT_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: '검토 중',
  ACCEPTED: '수락함',
  REJECTED: '거절함',
  EXPIRED: '만료됨',
};

export function useApplicantList(recruit: RecruitDetail) {
  const viewer = useViewer();
  const applicants = useQuery(applicantsOptions(viewer.login, String(recruit.id)));
  const [roleId, setRoleId] = useQueryState(
    'role',
    parseAsInteger.withOptions({ history: 'replace' }),
  );

  const all = applicants.data?.items ?? [];
  const items = roleId === null ? all : all.filter((item) => item.roleId === roleId);

  return {
    applicants,
    all,
    items,
    roleId,
    setRoleId: (next: number | null) => void setRoleId(next),
  };
}

export function useApplicantCard() {
  const sheet = useOverlay('recruit-application');
  return {
    openApplication: (id: number) => sheet.open(String(id)),
  };
}
