import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatDate } from '@/lib/format/time';

import type { IssueRow as IssueRowData } from '../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS } from '../../_lib/issue-status';
import styles from './issue-row.module.css';

type IssueRowProps = {
  teamId: string;
  issue: IssueRowData;
  /** Row action, e.g. "프로젝트에 추가" on the "일정 없음" tab */
  action?: ReactNode;
};

const MAX_AVATARS = 3;

/**
 * One issue: repo, number, title, status, assignees, due date, labels, overdue mark (07 TODO 11).
 * The title links to the issue detail (12).
 */
export function IssueRow({ teamId, issue, action }: IssueRowProps) {
  const titleId = `issue-${issue.id}-title`;
  const shown = issue.assignees.slice(0, MAX_AVATARS);
  const hidden = issue.assignees.length - shown.length;

  return (
    <article aria-labelledby={titleId} className={styles.row}>
      <p className={styles.repo}>
        {issue.repoName} #{issue.number}
      </p>
      <h2 id={titleId} className={styles.title}>
        <Link href={`/teams/${teamId}/issues/${issue.id}` as Route} className={styles.link}>
          {issue.title}
        </Link>
      </h2>

      <div className={styles.meta}>
        <span className={styles.status}>{ISSUE_STATUS_LABELS[issue.status]}</span>
        {issue.dueDate && (
          <span className={issue.overdue ? styles.overdue : styles.due}>
            마감 <time dateTime={issue.dueDate}>{formatDate(issue.dueDate)}</time>
            {issue.overdue && ' · 마감 지남'}
          </span>
        )}
        {issue.assignees.length > 0 ? (
          <span className={styles.assignees}>
            <span className="sr-only">
              담당자 {issue.assignees.map((user) => user.name).join(', ')}
            </span>
            {shown.map((user) => (
              <Image
                key={user.id}
                src={user.avatarUrl}
                alt=""
                width={24}
                height={24}
                sizes="24px"
                className={styles.avatar}
              />
            ))}
            {hidden > 0 && (
              <span className={styles.more} aria-hidden>
                +{hidden}
              </span>
            )}
          </span>
        ) : (
          <span className={styles.unassigned}>담당자 없음</span>
        )}
      </div>

      {issue.labels.length > 0 && (
        <ul className={styles.labels} aria-label="라벨">
          {issue.labels.map((label) => (
            <li key={label.name} className={styles.label}>
              {/* GitHub's label color is data, so it's inline; the name always carries the meaning */}
              <span
                className={styles.swatch}
                style={{ backgroundColor: `#${label.color.replace(/^#/, '')}` }}
                aria-hidden
              />
              {label.name}
            </li>
          ))}
        </ul>
      )}

      {issue.scheduleSyncFailed && (
        <p className={styles.warning}>일정이 GitHub에 반영되지 않았어요</p>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}
