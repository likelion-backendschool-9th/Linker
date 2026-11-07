'use client';

import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatDate } from '@/lib/format/time';

import { IssueFilterButton } from '../../../_components/issue-filter-button';
import { IssueStatusSheet } from '../../../_components/issue-sheets/issue-status-sheet';
import type { IssueRow } from '../../../_lib/issue-queries';
import { IssueStatusBadge } from '../../../../../_components/issue-status-badge';
import {
  boardStatusColorVar,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../_lib/issue-status';
import styles from './BoardView.module.css';
import { isTarget, useBoardView } from './hook';

/** 14 Status board (07 TODO 14, POL-I-4) */
export function BoardView({ teamId }: { teamId: string }) {
  const {
    board,
    canWrite,
    columns,
    moves,
    dragging,
    dndId,
    sensors,
    collision,
    announcements,
    statusOf,
    sheetCard,
    move,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onChangeStatus,
  } = useBoardView(teamId);

  if (board.isError && !board.data) return <ErrorState onRetry={() => void board.refetch()} />;
  if (!board.data) return null;

  return (
    <>
      <div className={styles.toolbar}>
        <IssueFilterButton />
        {canWrite ? (
          <p className={styles.hint}>
            카드의 손잡이를 끌거나(모바일은 길게 누르기) &quot;상태 바꾸기&quot;로 옮겨요.
          </p>
        ) : (
          <p className={styles.notice}>
            이 레포에 쓸 권한이 없어 보기만 할 수 있어요. 레포 관리자에게 권한을 요청해 주세요.
          </p>
        )}
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        // Slow enough near the edge to stop at the next column on a phone
        autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 3 }}
        collisionDetection={collision}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              '스페이스나 엔터로 카드를 들고, 왼쪽·오른쪽 방향키로 칸을 옮긴 뒤 스페이스나 엔터로 내려놓아요. Esc로 취소해요.',
          },
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className={styles.columns} data-dragging={dragging !== null}>
          {columns
            .filter((column) => column.status !== 'OTHER' || column.cards.length > 0)
            .map((column) => (
              <BoardColumnView
                key={column.status}
                status={column.status}
                statusColor={column.statusColor}
                count={column.cards.length}
              >
                {column.cards.length === 0 ? (
                  <p className={styles.empty}>이슈 없음</p>
                ) : (
                  <ul className={styles.cards}>
                    {column.cards.map((card) => (
                      <li key={card.id}>
                        <BoardCard
                          teamId={teamId}
                          card={card}
                          status={statusOf(card)}
                          canWrite={canWrite}
                          moving={moves[card.id] !== undefined}
                          onChangeStatus={() => onChangeStatus(card)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </BoardColumnView>
            ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className={styles.overlayCard}>
              <p className={styles.cardTitle}>{dragging.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <IssueStatusSheet
        value={sheetCard ? statusOf(sheetCard) : 'TODO'}
        statusColors={Object.fromEntries(
          columns
            .filter((column) => column.status !== 'OTHER')
            .map((column) => [column.status, column.statusColor]),
        )}
        onSave={async (status) => {
          if (sheetCard) await move(sheetCard, status);
        }}
      />
    </>
  );
}

function BoardColumnView({
  status,
  statusColor,
  count,
  children,
}: {
  status: IssueStatus;
  statusColor: BoardStatusColor;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !isTarget(status) });
  const headingId = `board-column-${status}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={styles.column}
      data-over={isOver}
      style={{ ['--column-status-color' as string]: boardStatusColorVar(statusColor) }}
    >
      <h2 id={headingId} className={styles.columnTitle}>
        <IssueStatusBadge status={status} statusColor={statusColor} />
        <span className={styles.count}>
          {count}
          <span className="sr-only">개</span>
        </span>
      </h2>
      {status === 'OTHER' && (
        <p className={styles.hint}>보드의 상태 칸이 네 가지에 대응되지 않은 이슈예요.</p>
      )}
      {children}
    </section>
  );
}

const MAX_AVATARS = 3;

/** Card: title, assignees, due date, labels, "중단" mark, overdue in red (07 TODO 14) */
function BoardCard({
  teamId,
  card,
  status,
  canWrite,
  moving,
  onChangeStatus,
}: {
  teamId: string;
  card: IssueRow;
  status: IssueStatus;
  canWrite: boolean;
  moving: boolean;
  onChangeStatus: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canWrite || moving,
  });
  const titleId = `board-card-${card.id}`;
  const shown = card.assignees.slice(0, MAX_AVATARS);

  return (
    <article
      ref={setNodeRef}
      aria-labelledby={titleId}
      aria-busy={moving}
      className={styles.card}
      data-dragging={isDragging}
    >
      <div className={styles.cardTop}>
        <p className={styles.repo}>
          {card.repoName} #{card.number}
        </p>
        {status === 'BLOCKED' && <span className={styles.blocked}>중단</span>}
      </div>
      <h3 id={titleId} className={styles.cardTitle}>
        <Link href={`/teams/${teamId}/issues/${card.id}` as Route} className={styles.cardLink}>
          {card.title}
        </Link>
      </h3>
      <div className={styles.meta}>
        {card.dueDate && (
          <span className={card.overdue ? styles.overdue : styles.due}>
            마감 <time dateTime={card.dueDate}>{formatDate(card.dueDate)}</time>
            {card.overdue && ' · 마감 지남'}
          </span>
        )}
        {card.assignees.length > 0 && (
          <span className={styles.assignees}>
            <span className="sr-only">
              담당자{' '}
              {card.assignees
                .map((user) => (user.inTeam ? user.name : `${user.name}(팀 밖 사용자)`))
                .join(', ')}
            </span>
            {shown.map((user) => (
              <Image
                key={user.id}
                src={user.avatarUrl}
                alt=""
                width={20}
                height={20}
                sizes="20px"
                className={styles.avatar}
              />
            ))}
            {card.assignees.length > shown.length && (
              <span className={styles.more} aria-hidden>
                +{card.assignees.length - shown.length}
              </span>
            )}
          </span>
        )}
      </div>
      {card.labels.length > 0 && (
        <ul className={styles.labels} aria-label="라벨">
          {card.labels.map((label) => (
            <li key={label.name} className={styles.label}>
              {/* GitHub's label color is data, so it's inline; the name carries the meaning */}
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
      {card.scheduleSyncFailed && (
        <p className={styles.warning}>일정이 GitHub에 반영되지 않았어요</p>
      )}
      <div className={styles.cardActions}>
        {canWrite && (
          <button
            type="button"
            className={styles.handle}
            {...attributes}
            {...listeners}
            aria-label={`${card.title} 옮기기`}
          >
            <GripVertical aria-hidden />
          </button>
        )}
        <Button
          variant="soft"
          className={styles.statusButton}
          aria-disabled={!canWrite || moving}
          onClick={() => !moving && onChangeStatus()}
        >
          상태 바꾸기
          <span className="sr-only">: {card.title}</span>
        </Button>
      </div>
    </article>
  );
}
