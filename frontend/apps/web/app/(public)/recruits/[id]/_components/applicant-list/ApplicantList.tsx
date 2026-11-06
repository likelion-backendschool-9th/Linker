'use client';

// Own region: the author's "지원자" tab, filtered by role (07 TODO 21)
import Image from 'next/image';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import type { ApplicantRow, RecruitDetail } from '../../_lib/detail-queries';
import styles from './ApplicantList.module.css';
import { APPLICANT_STATUS_LABELS, useApplicantCard, useApplicantList } from './hook';

export function ApplicantList({ recruit }: { recruit: RecruitDetail }) {
  const { applicants, all, items, roleId, setRoleId } = useApplicantList(recruit);

  if (applicants.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">지원자를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (applicants.isError) return <ErrorState onRetry={() => void applicants.refetch()} />;

  return (
    <section aria-label="지원자 목록" className={styles.panel}>
      <div role="group" aria-label="역할별 보기" className={styles.filters}>
        <button
          type="button"
          className={styles.filter}
          aria-pressed={roleId === null}
          onClick={() => setRoleId(null)}
        >
          전체 {all.length}
        </button>
        {recruit.roles.map((role) => (
          <button
            key={role.id}
            type="button"
            className={styles.filter}
            aria-pressed={roleId === role.id}
            onClick={() => setRoleId(role.id)}
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
  const { openApplication } = useApplicantCard();
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
          {APPLICANT_STATUS_LABELS[item.status]}
        </span>
      </div>
      {item.status === 'PENDING' && (
        <p className={styles.expiry}>{item.daysLeft}일 뒤 자동으로 만료돼요</p>
      )}
      <div className={styles.action}>
        <Button variant="outline" onClick={() => openApplication(item.id)}>
          지원서 보기
          <span className="sr-only">: {item.applicant.name}</span>
        </Button>
      </div>
    </article>
  );
}
