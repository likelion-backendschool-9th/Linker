'use client';

// client boundary: selected team in the URL and the my-issues query
import type { IssueListItem } from '@linker/api/openAPIDefinition.schemas';
import { ArrowUpRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate } from '@/lib/format/time';

import { IssueStatusBadge } from '../../../_components/issue-status-badge';
import type { IssueStatus } from '../../../_lib/issue-status';
import { MyIssuesTeamPicker } from '../my-issues-team-picker';
import { useMyIssuesSection } from './hook';
import styles from './MyIssuesSection.module.css';

type MyIssuesSectionProps = {
  /** Home preview: a UI limit on the rows shown, not a policy number. Omit for the full list. */
  previewRows?: number;
  /** Home preview: B's "내 이슈 전체 보기" destination */
  allIssuesHref?: Route;
};

/** My open issues in the selected team (07, POL-I-5): the home preview and the full list. */
export function MyIssuesSection({ previewRows, allIssuesHref }: MyIssuesSectionProps) {
  const { teams, team, issues, selectTeam } = useMyIssuesSection();
  const allIssuesLink = allIssuesHref && (
    <Link href={allIssuesHref} className={styles.allIssues}>
      내 이슈 전체 보기
      <ArrowUpRight aria-hidden className={styles.allIssuesIcon} />
    </Link>
  );

  if (teams.isPending) return <Skeleton count={3} />;
  // The team list's own region reports the failure on the home; only the entry link stays here
  if (teams.isError) {
    return allIssuesLink ?? <ErrorState onRetry={() => void teams.refetch()} />;
  }
  if (!team) return null;

  const titleId = 'my-issues-title';
  const items = issues.data?.items ?? [];
  const shown = previewRows === undefined ? items : items.slice(0, previewRows);

  return (
    <div className={styles.section}>
      <MyIssuesTeamPicker teams={teams.data.items} selected={team} onSelect={selectTeam} />
      <section aria-labelledby={titleId} className={styles.issues}>
        <h2 id={titleId} className={styles.title}>
          내 {team.name} 팀의 이슈
        </h2>
        {issues.isPending ? (
          <Skeleton count={3} />
        ) : issues.isError ? (
          <ErrorState onRetry={() => void issues.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState title="배정된 이슈가 없어요." />
        ) : (
          <ul>
            {shown.map((issue) => (
              <li key={issue.id}>
                <MyIssueRow teamId={team.id} issue={issue} />
              </li>
            ))}
          </ul>
        )}
        {allIssuesLink}
      </section>
    </div>
  );
}

function MyIssueRow({ teamId, issue }: { teamId: number; issue: IssueListItem }) {
  const titleId = `my-issue-${issue.id}-title`;
  const assignees = issue.assignees.map((user) => user.name).join(', ');
  return (
    <article aria-labelledby={titleId} className={styles.row}>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <h3 id={titleId} className={styles.issueTitle}>
            <Link href={`/teams/${teamId}/issues/${issue.id}` as Route} className={styles.link}>
              {issue.title}
            </Link>
          </h3>
          {/* NONE has no documented name: the badge shows only its gray dot, as on 11–15 */}
          <IssueStatusBadge
            status={issue.status as IssueStatus}
            statusColor={issue.statusColor}
            className={styles.statusBadge}
          />
        </div>
        <p className={styles.meta}>
          <span>#{issue.number}</span>
          <span className={styles.separator} aria-hidden />
          <span className={styles.metaText}>{issue.repoName}</span>
          {assignees && (
            <>
              <span className={styles.separator} aria-hidden />
              <span className={styles.metaText}>{assignees}</span>
            </>
          )}
        </p>
      </div>
      {issue.dueDate && (
        <p className={issue.overdue ? styles.overdue : styles.due}>
          {issue.overdue && <span>마감 지남</span>}
          <time dateTime={issue.dueDate}>{formatDate(issue.dueDate)}</time>
        </p>
      )}
    </article>
  );
}
