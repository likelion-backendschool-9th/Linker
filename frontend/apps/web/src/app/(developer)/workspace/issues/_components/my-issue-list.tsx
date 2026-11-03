'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, todayKst } from '@/lib/format/time';

import { ISSUE_STATUS_LABELS } from '../../../_lib/issue-status';
import { myIssuesOptions, type MyIssue } from '../_lib/my-issues-queries';
import styles from './my-issue-list.module.css';

type MyIssueListProps = {
  /** `today` = due today in KST only (07 workspace home preview). Default = full list (I-5). */
  due?: 'all' | 'today';
};

/**
 * Issues assigned to me across all teams, by due date (07 TODO 07 "My issues", I-5).
 * Shows the team name; overdue is red and says "마감 지남"; tapping a title opens 12.
 * Workspace home passes `due="today"` to show only issues due today.
 */
export function MyIssueList({ due = 'all' }: MyIssueListProps) {
  const issues = useQuery(myIssuesOptions());

  if (issues.isPending) return <Skeleton count={3} />;
  if (issues.isError) return <ErrorState onRetry={() => void issues.refetch()} />;

  const today = todayKst();
  const items =
    due === 'today'
      ? issues.data.items.filter((issue) => issue.dueDate === today)
      : issues.data.items;
  if (items.length === 0) {
    return (
      <EmptyState title={due === 'today' ? '오늘 마감인 이슈가 없어요.' : '배정된 이슈가 없어요.'} />
    );
  }

  return (
    <section aria-labelledby="my-issues-count">
      <p id="my-issues-count" className={styles.count}>
        {due === 'today' ? `${items.length}개 · 오늘 마감` : `${items.length}개 · 마감일 빠른 순`}
      </p>
      <ul className={styles.list}>
        {items.map((issue) => (
          <li key={issue.id}>
            <MyIssueRow issue={issue} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyIssueRow({ issue }: { issue: MyIssue }) {
  const titleId = `my-issue-${issue.id}-title`;
  return (
    <article aria-labelledby={titleId} className={styles.row}>
      <p className={styles.team}>{issue.teamName}</p>
      <p className={styles.repo}>
        {issue.repoName} #{issue.number}
      </p>
      <h2 id={titleId} className={styles.title}>
        <Link href={`/teams/${issue.teamId}/issues/${issue.id}` as Route} className={styles.link}>
          {issue.title}
        </Link>
      </h2>
      <div className={styles.meta}>
        <span className={styles.status}>{ISSUE_STATUS_LABELS[issue.status]}</span>
        {issue.dueDate ? (
          <span className={issue.overdue ? styles.overdue : styles.due}>
            마감 <time dateTime={issue.dueDate}>{formatDate(issue.dueDate)}</time>
            {issue.overdue && ' · 마감 지남'}
          </span>
        ) : (
          <span className={styles.noDue}>마감일 없음</span>
        )}
      </div>
    </article>
  );
}
