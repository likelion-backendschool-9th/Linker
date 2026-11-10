'use client';

// client boundary: URL status filter and sort (nuqs), board query, dnd-kit moves
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import {
  boardStatusColorVar,
  ISSUE_STATUS_LABELS,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../_lib/issue-status';
import { BOARD_MENU_STATUSES, BOARD_SORT_LABELS, BOARD_SORTS } from '../../_lib/board-sort';
import { BoardCard, BoardCardPreview } from '../board-card';
import { BoardMenu } from '../board-menu';
import styles from './BoardView.module.css';
import { useBoardView } from './hook';

const STATUS_ITEMS = BOARD_MENU_STATUSES.map((status) => ({
  value: status,
  label: ISSUE_STATUS_LABELS[status],
}));
const SORT_ITEMS = BOARD_SORTS.map((sort) => ({ value: sort, label: BOARD_SORT_LABELS[sort] }));

/**
 * 14 Status board (07 TODO 14, POL-I-4), Figma 14 (200:1028): "필터" (one status column, 368:3562) and
 * "최신순 / 오래 된 순" (368:3414) menus, then the status columns side by side (pan, no scrollbar).
 * Cards move by dragging (write permission only) or by their status menu (368:3741).
 */
export function BoardView({ teamId }: { teamId: string }) {
  const {
    board,
    canWrite,
    columns,
    statusFilter,
    sort,
    selectStatus,
    selectSort,
    moves,
    dragging,
    dndId,
    sensors,
    collision,
    announcements,
    announcement,
    statusOf,
    statusColorOf,
    move,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onBlocked,
  } = useBoardView(teamId);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <BoardMenu
          label="상태 필터"
          appearance="control"
          items={STATUS_ITEMS}
          value={statusFilter}
          active={statusFilter !== null}
          onSelect={selectStatus}
          triggerLabel={
            statusFilter
              ? `상태 필터, ${ISSUE_STATUS_LABELS[statusFilter]} 칸만 보는 중`
              : '상태 필터'
          }
        >
          필터
        </BoardMenu>
        <BoardMenu
          label="정렬"
          appearance="control"
          items={SORT_ITEMS}
          value={sort}
          onSelect={selectSort}
          triggerLabel={`정렬, ${BOARD_SORT_LABELS[sort]}`}
        >
          {BOARD_SORT_LABELS[sort]}
        </BoardMenu>
      </div>

      {board.isPending ? (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            보드를 불러오고 있어요.
          </p>
          <Skeleton count={3} />
        </div>
      ) : board.isError && !board.data ? (
        <ErrorState onRetry={() => void board.refetch()} />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          // Slow enough near the edge to stop at the next column on a phone
          autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 3 }}
          collisionDetection={collision}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable: '카드의 상태 메뉴로도 칸을 옮길 수 있어요.',
            },
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className={styles.columns}>
            {columns.map((column) => (
              <BoardColumn
                key={column.status}
                teamId={teamId}
                canWrite={canWrite}
                status={column.status}
                statusColor={column.statusColor}
                count={column.cards.length}
              >
                {column.cards.length > 0 && (
                  <ul className={styles.cards}>
                    {column.cards.map((card) => (
                      <li key={card.id}>
                        <BoardCard
                          teamId={teamId}
                          card={card}
                          status={statusOf(card)}
                          statusColor={statusColorOf(card)}
                          canWrite={canWrite}
                          moving={moves[card.id] !== undefined}
                          onMove={(to) => void move(card, to)}
                          onBlocked={onBlocked}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </BoardColumn>
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <BoardCardPreview card={dragging} statusColor={statusColorOf(dragging)} />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/**
 * Column of Figma 14 (214:92): status-colored top line, "{상태} N개" + "+" (이슈 작성, 13; write permission
 * only, like 07·11), its cards
 */
function BoardColumn({
  teamId,
  canWrite,
  status,
  statusColor,
  count,
  children,
}: {
  teamId: string;
  canWrite: boolean;
  status: IssueStatus;
  statusColor: BoardStatusColor;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: status === 'OTHER' });
  const headingId = `board-column-${status}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={styles.column}
      data-over={isOver}
      style={{ '--column-status-color': boardStatusColorVar(statusColor) } as CSSProperties}
    >
      <div className={styles.columnHead}>
        <h2 id={headingId} className={styles.columnTitle}>
          {ISSUE_STATUS_LABELS[status]} <span className={styles.count}>{count}개</span>
        </h2>
        {canWrite && (
          <Link href={`/teams/${teamId}/issues/new` as Route} className={styles.create}>
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
      {children}
    </section>
  );
}
