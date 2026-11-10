import type { IssueListItem } from '@linker/api/openAPIDefinition.schemas';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatDate } from '@/lib/format/time';

import {
  boardStatusColorVar,
  ISSUE_STATUS_LABELS,
  type IssueStatus,
} from '../../_lib/issue-status';
import styles from './IssueSummaryRow.module.css';

type IssueSummaryRowProps = {
  teamId: number | string;
  issue: Omit<IssueListItem, 'syncStatus' | 'syncedAt'>;
  /** Heading level of the title inside its list section */
  headingLevel?: 'h2' | 'h3';
  /** Extra control at the end of the row, e.g. 11's "프로젝트에 추가" */
  action?: ReactNode;
  /** 15 day sheet (Figma 368:2753): no due date; assignee names stay for screen readers only */
  compact?: boolean;
  /** Replaces the link navigation, e.g. 15 closes its sheet first */
  onOpen?: (href: Route) => void;
};

/**
 * One issue row of Figma 7 (123:1966) and 11 (197:66): title + status dot, `#번호 · 저장소 · 담당자`,
 * due date on the right (red when overdue, no "마감 지남" text: 07 decision). The whole row opens the issue detail (12).
 */
export function IssueSummaryRow({
  teamId,
  issue,
  headingLevel: Heading = 'h3',
  action,
  compact = false,
  onOpen,
}: IssueSummaryRowProps) {
  const titleId = `issue-row-${issue.id}-title`;
  const href = `/teams/${teamId}/issues/${issue.id}` as Route;
  const assignees = issue.assignees.map((user) => user.name).join(', ');
  return (
    <article aria-labelledby={titleId} className={styles.row}>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <Heading id={titleId} className={styles.title}>
            <Link
              href={href}
              className={styles.link}
              onClick={
                onOpen
                  ? (event) => {
                      event.preventDefault();
                      onOpen(href);
                    }
                  : undefined
              }
            >
              {issue.title}
            </Link>
          </Heading>
          <IssueStatusDot status={issue.status} statusColor={issue.statusColor} />
        </div>
        <p className={styles.meta}>
          <span>#{issue.number}</span>
          <span className={styles.separator} aria-hidden />
          <span className={styles.metaText}>{issue.repoName}</span>
          {assignees && !compact && (
            <>
              <span className={styles.separator} aria-hidden />
              <span className={styles.metaText}>{assignees}</span>
            </>
          )}
          {assignees && compact && <span className="sr-only">{assignees} 담당</span>}
        </p>
        {issue.scheduleSyncFailed && (
          <span className="sr-only">일정이 GitHub에 반영되지 않았어요</span>
        )}
      </div>
      {issue.dueDate && !compact && (
        <time dateTime={issue.dueDate} className={issue.overdue ? styles.overdue : styles.due}>
          {formatDate(issue.dueDate)}
        </time>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}

// Dot only (Figma); the name is for screen readers. NONE has none.
function IssueStatusDot({ status, statusColor }: Pick<IssueListItem, 'status' | 'statusColor'>) {
  const name = status === 'NONE' ? null : ISSUE_STATUS_LABELS[status as IssueStatus];
  return (
    <>
      <span
        className={styles.statusDot}
        style={{ backgroundColor: boardStatusColorVar(statusColor) }}
        aria-hidden
      />
      {name && <span className="sr-only">{name}</span>}
    </>
  );
}
