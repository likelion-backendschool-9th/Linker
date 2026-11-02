'use client';

// Overlay: assignees (07 TODO 12, POL-I-2), reused by 13
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { ISSUE } from '@/lib/policy';

import type { AssigneeCandidates } from '../../_lib/issue-detail-queries';
import type { IssueAssignee } from '../../_lib/issue-queries';
import { saveErrorMessage } from './save-error';
import styles from './issue-sheets.module.css';

type IssueAssigneeSheetProps<Key extends readonly unknown[]> = {
  value: IssueAssignee[];
  /** Who can be picked: 12's `assignee-candidates` */
  candidates: UseQueryOptions<AssigneeCandidates, Error, AssigneeCandidates, Key>;
  onSave: (userIds: number[]) => Promise<unknown>;
};

export function IssueAssigneeSheet<Key extends readonly unknown[]>({
  value,
  candidates,
  onSave,
}: IssueAssigneeSheetProps<Key>) {
  const overlay = useOverlay('issue-assignees');
  return (
    <OverlaySheet
      overlay={overlay}
      title="담당자"
      description={`이 레포에 접근할 수 있고 GitHub 조직 초대를 수락한 팀원만 고를 수 있어요. 최대 ${ISSUE.assigneesMax}명까지예요.`}
    >
      {overlay.isOpen && (
        <AssigneeForm
          value={value}
          candidates={candidates}
          onSave={onSave}
          onDone={overlay.close}
        />
      )}
    </OverlaySheet>
  );
}

function AssigneeForm<Key extends readonly unknown[]>({
  value,
  candidates,
  onSave,
  onDone,
}: IssueAssigneeSheetProps<Key> & { onDone: () => void }) {
  const query = useQuery(candidates);
  const [selected, setSelected] = useState<number[]>(() => value.map((user) => user.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = query.data?.max ?? ISSUE.assigneesMax;

  if (query.isError) {
    return (
      <ErrorState
        title="담당자 목록을 불러오지 못했어요"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) {
    return (
      <LoadingIndicator label="담당자 목록을 불러오고 있어요." variant="inline">
        <Skeleton variant="line" count={3} />
      </LoadingIndicator>
    );
  }

  // Current assignees who can't be picked now (left the team, or haven't accepted the GitHub org
  // invite) stay listed and checked, so saving never drops them silently (04 ch. 7 exceptions)
  const kept = value.filter((user) => !query.data.items.some((item) => item.id === user.id));
  const rows = [
    ...query.data.items.map((user) => ({ user, hint: `@${user.login}` })),
    ...kept.map((user) => ({
      user,
      hint: `@${user.login} · ${user.inTeam ? 'GitHub 조직 초대 수락 전' : '팀 밖 사용자'}`,
    })),
  ];
  const full = selected.length >= max;

  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        try {
          await onSave(selected);
          onDone();
        } catch (failure) {
          setError(saveErrorMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">담당자 고르기</legend>
        {rows.length === 0 ? (
          <p className={styles.note}>고를 수 있는 팀원이 없어요.</p>
        ) : (
          <div className={styles.options}>
            {rows.map(({ user, hint }) => {
              const checked = selected.includes(user.id);
              return (
                <label key={user.id} className={styles.option}>
                  <input
                    type="checkbox"
                    className={styles.control}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, user.id]
                          : current.filter((id) => id !== user.id),
                      )
                    }
                  />
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    sizes="32px"
                    className={styles.avatar}
                  />
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>{user.name}</span>
                    <span className={styles.optionHint}>{hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <p className={styles.note} aria-live="polite">
        {selected.length}/{max}명 선택{full ? ' · 더 고르려면 한 명을 빼 주세요.' : ''}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" aria-disabled={pending} pending={pending} pendingLabel="저장하는 중…" >
          저장
        </Button>
      </div>
    </form>
  );
}
