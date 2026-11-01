'use client';

// Own region: the author's "지원자" tab, filtered by role (07 TODO 21)
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { parseAsInteger, useQueryState } from 'nuqs';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { ApplicationStatus } from '../../_lib/recruit-list-queries';
import { applicantsOptions, type ApplicantRow, type RecruitDetail } from '../_lib/detail-queries';
import styles from './applicant-list.module.css';

/** What the author sees per status; pending also shows days left until the 14-day expiry */
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: '검토 중',
  ACCEPTED: '수락함',
  REJECTED: '거절함',
  EXPIRED: '만료됨',
};

export function ApplicantList({ recruit }: { recruit: RecruitDetail }) {
  const viewer = useViewer();
  const applicants = useQuery(applicantsOptions(viewer.login, String(recruit.id)));
  const [roleId, setRoleId] = useQueryState(
    'role',
    parseAsInteger.withOptions({ history: 'replace' }),
  );

  if (applicants.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">지원자를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (applicants.isError) return <ErrorState onRetry={() => void applicants.refetch()} />;

  const all = applicants.data.items;
  const items = roleId === null ? all : all.filter((item) => item.roleId === roleId);

  return (
    <section aria-label="지원자 목록" className={styles.panel}>
      <div role="group" aria-label="역할별 보기" className={styles.filters}>
        <button
          type="button"
          className={styles.filter}
          aria-pressed={roleId === null}
          onClick={() => void setRoleId(null)}
        >
          전체 {all.length}
        </button>
        {recruit.roles.map((role) => (
          <button
            key={role.id}
            type="button"
            className={styles.filter}
            aria-pressed={roleId === role.id}
            onClick={() => void setRoleId(role.id)}
          >
            {role.name} {all.filter((item) => item.roleId === role.id).length}
          </button>
        ))}
      </div>

      {recruit.status === 'CLOSED' && (
        <p className={styles.note}>
          모집은 마감했지만 검토 중인 지원은 계속 수락하거나 거절할 수 있어요.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? '아직 지원자가 없어요.' : '이 역할에는 지원자가 없어요.'}
          description="지원이 오면 알림으로 알려 드릴게요."
        />
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <ApplicantCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicantCard({ item }: { item: ApplicantRow }) {
  const sheet = useOverlay('recruit-application');
  const nameId = `applicant-${item.id}-name`;
  return (
    <article aria-labelledby={nameId} className={styles.card}>
      <div className={styles.head}>
        <Image
          src={item.applicant.avatarUrl}
          alt=""
          width={48}
          height={48}
          sizes="48px"
          className={styles.avatar}
        />
        <div className={styles.who}>
          <h3 id={nameId} className={styles.name}>
            {item.applicant.name}
          </h3>
          <p className={styles.meta}>
            {item.roleName} 지원 · <RelativeTime value={item.appliedAt} />
          </p>
        </div>
        <span className={item.status === 'PENDING' ? styles.pending : styles.status}>
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      {item.status === 'PENDING' && (
        <p className={styles.expiry}>{item.daysLeft}일 뒤 자동으로 만료돼요</p>
      )}
      <div className={styles.action}>
        <Button variant="outline" onClick={() => sheet.open(String(item.id))}>
          지원서 보기
          <span className="sr-only">: {item.applicant.name}</span>
        </Button>
      </div>
    </article>
  );
}
