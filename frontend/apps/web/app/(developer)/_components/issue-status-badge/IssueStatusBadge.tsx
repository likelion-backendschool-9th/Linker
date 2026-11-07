import {
  ISSUE_STATUS_LABELS,
  boardStatusColorVar,
  type BoardStatusColor,
  type IssueStatus,
} from '../../_lib/issue-status';
import styles from './IssueStatusBadge.module.css';

/**
 * Shared status chip for 07 / 11–15. Color comes from the board mapping (`statusColor`);
 * the label is always shown so status is never color-only.
 */
export function IssueStatusBadge({
  status,
  statusColor,
  className,
}: {
  status: IssueStatus;
  statusColor?: BoardStatusColor | null;
  className?: string;
}) {
  return (
    <span
      className={className ? `${styles.badge} ${className}` : styles.badge}
      style={{ ['--status-color' as string]: boardStatusColorVar(statusColor) }}
    >
      <span className={styles.dot} aria-hidden="true" />
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}
