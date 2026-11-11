'use client';

// Author applicants drawer: radio select → bottom 수락하기; row 거절 on the right
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import type { ApplicantRow, RecruitDetail } from '../../_lib/detail-queries';
import styles from './ApplicantList.module.css';
import { isInviteable, useApplicantActions, useApplicantList, useApplicantsSheet } from './hook';

/** Bottom-sheet drawer of applicants; open with `useOverlay('recruit-applicants')`. */
export function ApplicantsSheet({ recruit }: { recruit: RecruitDetail }) {
  const overlay = useApplicantsSheet();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <OverlaySheet
      overlay={overlay}
      title="지원자"
      description="지원자를 고른 뒤 초대하거나, 행에서 바로 거절할 수 있어요."
      describeHidden
      classNames={{ sheet: styles.sheet }}
    >
      {overlay.isOpen && (
        <ApplicantsBody
          key={recruit.id}
          recruit={recruit}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />
      )}
    </OverlaySheet>
  );
}

function ApplicantsBody({
  recruit,
  selectedId,
  setSelectedId,
}: {
  recruit: RecruitDetail;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
}) {
  const { applicants, all, items, roleId, setRoleId } = useApplicantList(recruit);
  const { invitePending, invite, openReject } = useApplicantActions(recruit);
  const selected = all.find((item) => item.id === selectedId) ?? null;
  const canInvite = isInviteable(recruit, selected);

  useEffect(() => {
    if (selectedId !== null && !all.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [all, selectedId, setSelectedId]);

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
    <div className={styles.layout}>
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
            모집은 마감했지만 검토 중인 지원은 계속 초대하거나 거절할 수 있어요.
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? '아직 지원자가 없어요.' : '이 역할에는 지원자가 없어요.'}
            description="지원이 오면 알림으로 알려 드릴게요."
          />
        ) : (
          <ul className={styles.list} role="radiogroup" aria-label="초대할 지원자">
            {items.map((item) => (
              <li key={item.id}>
                <ApplicantCard
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onReject={() => openReject(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.footer}>
        <Button
          block
          className={styles.inviteCta}
          aria-disabled={!canInvite || invitePending}
          onClick={() => selected && canInvite && invite(selected)}
        >
          {invitePending ? '수락하는 중…' : '수락하기'}
        </Button>
      </div>
    </div>
  );
}

function ApplicantCard({
  item,
  selected,
  onSelect,
  onReject,
}: {
  item: ApplicantRow;
  selected: boolean;
  onSelect: () => void;
  onReject: () => void;
}) {
  const nameId = `applicant-${item.id}-name`;
  const profileHref = `/user/${item.applicant.login}` as Route;
  const pending = item.status === 'PENDING';
  const radioId = `applicant-select-${item.id}`;

  return (
    <article aria-labelledby={nameId} className={styles.card}>
      <div className={styles.select}>
        <input
          id={radioId}
          type="radio"
          name="applicant-invite"
          className={styles.radio}
          checked={selected}
          disabled={!pending}
          aria-label={`${item.applicant.name} 선택`}
          onChange={onSelect}
        />
      </div>

      <Link
        href={profileHref}
        className={styles.profile}
        aria-label={`${item.applicant.name} 프로필 보기`}
      >
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
            {item.roleName} 지원
            {pending && <> · {item.daysLeft}일 뒤 만료</>}
          </p>
        </div>
      </Link>

      {pending ? (
        <button
          type="button"
          className={`${styles.statusPill} ${styles.reject}`}
          onClick={onReject}
        >
          거절
        </button>
      ) : (
        <span className={`${styles.statusPill} ${styles.waiting}`} aria-label="초대 대기 중">
          대기
        </span>
      )}
    </article>
  );
}
