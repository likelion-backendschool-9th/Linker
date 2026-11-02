'use client';

// Overlay: the issue filters of 11, reused by 14 and 15 (07 TODO 11)
import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useId, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { issueFilterParsers, type IssueFilters } from '../_lib/issue-filters';
import { issueFilterOptions } from '../_lib/issue-queries';
import { ISSUE_STATUS_LABELS, ISSUE_STATUSES } from '../../../_lib/issue-status';
import styles from './issue-filter-sheet.module.css';

type IssueFilterSheetProps = {
  teamId: string;
  /** The board shows every status as a column, so it hides the status filter */
  showStatus?: boolean;
};

const ALL = '';
const CLEARED: IssueFilters = {
  repo: null,
  status: null,
  assignee: null,
  label: null,
  open: false,
};

/**
 * Choices are a draft until "결과 보기": the sheet closes with `history.back()`, which would undo
 * URL changes made while it was open, so the filters are written after it has closed (`closeAnd`).
 * Closing any other way (X, back, scrim) keeps the current filters.
 */
export function IssueFilterSheet({ teamId, showStatus = true }: IssueFilterSheetProps) {
  const overlay = useOverlay('issue-filter');
  return (
    <OverlaySheet
      overlay={overlay}
      title="필터"
      description="조건을 고르고 결과 보기를 누르면 목록에 적용돼요."
    >
      {/* Mounted on open, so the draft starts from the URL each time */}
      {overlay.isOpen && <FilterFields teamId={teamId} showStatus={showStatus} overlay={overlay} />}
    </OverlaySheet>
  );
}

function FilterFields({
  teamId,
  showStatus,
  overlay,
}: IssueFilterSheetProps & { overlay: OverlayControl }) {
  const [filters, setFilters] = useQueryStates(issueFilterParsers, { history: 'replace' });
  const [draft, setDraft] = useState<IssueFilters>(filters);
  const options = useQuery(issueFilterOptions(teamId));
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const change = (patch: Partial<IssueFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));

  if (options.isError) {
    return (
      <ErrorState
        title="필터 항목을 불러오지 못했어요"
        onRetry={() => {
          void options.refetch();
        }}
      />
    );
  }

  return (
    <form
      className={styles.fields}
      aria-busy={options.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        void overlay.closeAnd(() => setFilters({ ...draft, open: draft.open || null }));
      }}
    >
      <div className={styles.field}>
        <label htmlFor={field('repo')} className={styles.label}>
          레포
        </label>
        <select
          id={field('repo')}
          className={styles.select}
          value={draft.repo ?? ALL}
          onChange={(event) => change({ repo: event.target.value || null })}
        >
          <option value={ALL}>전체</option>
          {options.data?.repos.map((repo) => (
            <option key={repo.id} value={String(repo.id)}>
              {repo.name}
            </option>
          ))}
        </select>
      </div>

      {showStatus && (
        <div className={styles.field}>
          <label htmlFor={field('status')} className={styles.label}>
            상태
          </label>
          <select
            id={field('status')}
            className={styles.select}
            value={draft.status ?? ALL}
            onChange={(event) =>
              change({
                status: ISSUE_STATUSES.find((status) => status === event.target.value) ?? null,
              })
            }
          >
            <option value={ALL}>전체</option>
            {ISSUE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ISSUE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor={field('assignee')} className={styles.label}>
          담당자
        </label>
        <select
          id={field('assignee')}
          className={styles.select}
          value={draft.assignee ?? ALL}
          onChange={(event) => change({ assignee: event.target.value || null })}
        >
          <option value={ALL}>전체</option>
          {options.data?.members.map((member) => (
            <option key={member.id} value={member.login}>
              {member.name} (@{member.login})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={field('label')} className={styles.label}>
          라벨
        </label>
        <select
          id={field('label')}
          className={styles.select}
          value={draft.label ?? ALL}
          onChange={(event) => change({ label: event.target.value || null })}
        >
          <option value={ALL}>전체</option>
          {options.data?.labels.map((label) => (
            <option key={label.name} value={label.name}>
              {label.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.check}>
        <input
          id={field('open')}
          type="checkbox"
          className={styles.checkbox}
          checked={draft.open}
          onChange={(event) => change({ open: event.target.checked })}
        />
        <label htmlFor={field('open')}>열린 이슈만 보기</label>
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => setDraft(CLEARED)}>
          필터 초기화
        </Button>
        <Button type="submit">결과 보기</Button>
      </div>
    </form>
  );
}
