'use client';

// client boundary: selected team in the URL and the my-issues query
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { ArrowRightUpLinearIcon } from '@solar-icons/static/linear/arrow-right-up';
import type { Route } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { IssueSummaryRow } from '../../../_components/issue-summary-row';
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
      {/* Figma solar:arrow-left-up-linear, mirrored = arrow-right-up (package SVG string) */}
      <span
        aria-hidden
        className={styles.allIssuesIcon}
        dangerouslySetInnerHTML={{ __html: ArrowRightUpLinearIcon }}
      />
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
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            내 {team.name} 팀의 이슈
          </h2>
          {['ACTIVE', 'COMPLETED'].includes(team.status) && (
            <Link href={`/teams/${team.id}/issues/new` as Route} className={styles.create}>
              {/* Figma solar:add-bold (package SVG string) */}
              <span
                aria-hidden
                className={styles.createIcon}
                dangerouslySetInnerHTML={{ __html: AddBoldIcon }}
              />
              <span className="sr-only">이슈 작성</span>
            </Link>
          )}
        </div>
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
                <IssueSummaryRow teamId={team.id} issue={issue} />
              </li>
            ))}
          </ul>
        )}
        {allIssuesLink}
      </section>
    </div>
  );
}
