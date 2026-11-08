'use client';

// client boundary: dnd-kit draggable card and its status menu
import { useDraggable } from '@dnd-kit/core';
import type { Route } from 'next';
import Link from 'next/link';

import { formatDate } from '@/lib/format/time';

import type { IssueRow } from '../../../_lib/issue-queries';
import {
  boardStatusColorVar,
  ISSUE_STATUS_LABELS,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../_lib/issue-status';
import { BOARD_MENU_STATUSES } from '../../_lib/board-sort';
import { BoardMenu } from '../board-menu';
import styles from './BoardCard.module.css';

const STATUS_ITEMS = BOARD_MENU_STATUSES.map((status) => ({
  value: status,
  label: ISSUE_STATUS_LABELS[status],
}));

/** Status name on the card; NONE (no Status value on GitHub) reads as 기타 like OTHER */
const statusName = (status: IssueStatus | 'NONE') =>
  status === 'NONE' ? ISSUE_STATUS_LABELS.OTHER : ISSUE_STATUS_LABELS[status];

type BoardCardProps = {
  teamId: string;
  card: IssueRow;
  /** Shown status: the move in progress, else the card's own */
  status: IssueStatus;
  statusColor: BoardStatusColor;
  canWrite: boolean;
  /** A move of this card is waiting for GitHub */
  moving: boolean;
  onMove: (status: IssueStatus) => void;
  /** Pressing the status field without write permission */
  onBlocked: () => void;
};

/**
 * Card of Figma 14 (214:104): "{담당자} 담당" + due date, repo #번호, title (opens 12), labels and the
 * status field whose menu moves the card (368:3741). With write permission the whole card can be dragged
 * (long press on touch); the status menu is the keyboard and screen-reader way to move it.
 */
export function BoardCard({
  teamId,
  card,
  status,
  statusColor,
  canWrite,
  moving,
  onMove,
  onBlocked,
}: BoardCardProps) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canWrite || moving,
  });
  const titleId = `board-card-${card.id}`;

  return (
    <article
      ref={setNodeRef}
      aria-labelledby={titleId}
      aria-busy={moving}
      className={styles.card}
      data-dragging={isDragging}
      data-draggable={canWrite}
      {...listeners}
    >
      <CardContent teamId={teamId} card={card} titleId={titleId} />
      <BoardMenu
        label={`${card.title} 상태`}
        appearance="status"
        items={STATUS_ITEMS}
        value={status}
        onSelect={(value) => onMove(value as IssueStatus)}
        blocked={moving ? () => undefined : canWrite ? undefined : onBlocked}
        triggerLabel={`상태 ${statusName(status)}, ${card.title}`}
      >
        <StatusName status={status} statusColor={statusColor} />
      </BoardMenu>
    </article>
  );
}

/** The card as it follows the pointer while dragging (no links or controls) */
export function BoardCardPreview({
  card,
  statusColor,
}: {
  card: IssueRow;
  statusColor: BoardStatusColor;
}) {
  return (
    <div className={styles.card} data-overlay="true" aria-hidden>
      <CardContent card={card} />
      <div className={styles.statusPreview}>
        <span
          className={styles.dot}
          style={{ backgroundColor: boardStatusColorVar(statusColor) }}
        />
        {statusName(card.status)}
      </div>
    </div>
  );
}

function CardContent({
  teamId,
  card,
  titleId,
}: {
  teamId?: string;
  card: IssueRow;
  titleId?: string;
}) {
  const names = card.assignees.map((user) => user.name).join(', ');
  const outside = card.assignees.filter((user) => !user.inTeam).map((user) => user.name);

  return (
    <>
      <div className={styles.head}>
        {names ? (
          <p className={styles.assignees}>
            {names} 담당
            {outside.length > 0 && (
              <span className="sr-only">, {outside.join(', ')}은(는) 팀 밖 사용자</span>
            )}
          </p>
        ) : (
          <span />
        )}
        {card.dueDate && (
          <time dateTime={card.dueDate} className={card.overdue ? styles.overdue : styles.due}>
            {card.overdue && <span className="sr-only">마감 지남, </span>}
            {formatDate(card.dueDate)}
          </time>
        )}
      </div>
      <div className={styles.body}>
        <div>
          <p className={styles.repo}>
            <span className={styles.repoName}>{card.repoName}</span>
            <span>#{card.number}</span>
          </p>
          {teamId && titleId ? (
            <h3 id={titleId} className={styles.title}>
              <Link href={`/teams/${teamId}/issues/${card.id}` as Route} className={styles.link}>
                {card.title}
              </Link>
            </h3>
          ) : (
            <p className={styles.title}>{card.title}</p>
          )}
        </div>
        {card.labels.length > 0 && (
          <ul className={styles.labels} aria-label="라벨">
            {card.labels.map((label) => (
              <li key={label.name} className={styles.label}>
                {label.name}
              </li>
            ))}
          </ul>
        )}
        {card.scheduleSyncFailed && (
          <span className="sr-only">일정이 GitHub에 반영되지 않았어요</span>
        )}
      </div>
    </>
  );
}

function StatusName({
  status,
  statusColor,
}: {
  status: IssueStatus;
  statusColor: BoardStatusColor;
}) {
  return (
    <>
      <span
        aria-hidden
        className={styles.dot}
        style={{ backgroundColor: boardStatusColorVar(statusColor) }}
      />
      {statusName(status)}
    </>
  );
}
