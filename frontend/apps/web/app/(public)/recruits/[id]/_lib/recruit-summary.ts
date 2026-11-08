import { daysUntil } from '@/lib/format/time';

import type { RecruitSummary } from './detail-queries';

/**
 * "백엔드 1명 · 디자이너 1명 남음 · D-5": remaining slots per role and the deadline, for the
 * description and share preview of 21 (blueprint §8-3) and the OG image once it's built.
 */
export function recruitSummary(recruit: Pick<RecruitSummary, 'roles' | 'deadline' | 'status'>) {
  const days = daysUntil(recruit.deadline);
  if (recruit.status === 'CLOSED' || days < 0) return '모집 마감';
  const open = recruit.roles.filter((role) => role.remaining > 0);
  const roles =
    open.length > 0
      ? `${open.map((role) => `${role.name} ${role.remaining}명`).join(' · ')} 남음`
      : '모집 완료';
  return `${roles} · ${days === 0 ? '오늘 마감' : `D-${days}`}`;
}
