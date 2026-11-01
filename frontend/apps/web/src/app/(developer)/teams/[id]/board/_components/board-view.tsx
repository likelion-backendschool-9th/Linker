'use client';

// Client boundary: drag and drop (dnd-kit), optimistic moves with rollback, the status sheet
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { IssueFilterButton } from '../../_components/issue-filter-button';
import { IssueStatusSheet } from '../../_components/issue-sheets/issue-status-sheet';
import { saveStatus } from '../../_lib/issue-detail-queries';
import { issueFilterParsers } from '../../_lib/issue-filters';
import { issueKeys, type IssueRow } from '../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS, type IssueStatus } from '../../_lib/issue-status';
import { boardOptions } from '../_lib/board-queries';
import styles from './board-view.module.css';

/** 04 ch. 12 "No GitHub permission" */
const NO_PERMISSION = '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.';

/** Columns a card can be dropped into: the four Linker statuses. "기타" only shows unmapped values. */
const isTarget = (status: IssueStatus) => status !== 'OTHER';

// Pointer first (mouse, touch), the active card's rect for the keyboard
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/** ← / → move the picked-up card to the previous / next column (dnd-kit KeyboardSensor) */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const rects = droppableContainers
    .getEnabled()
    .map((container) => droppableRects.get(container.id))
    .filter((rect) => rect !== undefined)
    .sort((a, b) => a.left - b.left);
  const center = collisionRect.left + collisionRect.width / 2;
  const target =
    event.code === 'ArrowRight'
      ? rects.find((rect) => rect.left > center)
      : rects.reverse().find((rect) => rect.left + rect.width < center);
  if (!target) return undefined;
  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + (target.height - collisionRect.height) / 2,
  };
};

/** 14 Status board (07 TODO 14, POL-I-4) */
export function BoardView({ teamId }: { teamId: string }) {
  const viewer = useViewer();
  const client = useQueryClient();
  const [filters] = useQueryStates(issueFilterParsers);
  const board = useQuery(boardOptions(teamId, filters));
  const statusSheet = useOverlay('issue-status');
  // Optimistic moves (blueprint §9-3): shown right away, dropped again when GitHub refuses
  const [moves, setMoves] = useState<Record<number, IssueStatus>>({});
  const [dragging, setDragging] = useState<IssueRow | null>(null);
  // dnd-kit numbers its accessibility ids per page load; a React id keeps server and client equal
  const dndId = useId();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long press on touch screens, so a swipe still scrolls the columns (07 TODO 14)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  if (board.isError && !board.data) return <ErrorState onRetry={() => void board.refetch()} />;
  if (!board.data) return null;

  const canWrite = board.data.canWrite && viewer.status !== 'SUSPENDED';
  const cards = board.data.columns.flatMap((column) => column.cards);
  const statusOf = (card: IssueRow) => moves[card.id] ?? card.status;
  const columns = board.data.columns.map((column) => ({
    ...column,
    cards: cards.filter((card) => statusOf(card) === column.status),
  }));
  const labelOf = (status: IssueStatus) => ISSUE_STATUS_LABELS[status];
  const titleOf = (id: number | string) =>
    cards.find((card) => String(card.id) === String(id))?.title ?? '카드';

  /** Move first, then GitHub; on failure the card goes back and the reason is shown (POL-I-4) */
  async function move(card: IssueRow, to: IssueStatus) {
    const from = statusOf(card);
    if (from === to) return;
    setMoves((current) => ({ ...current, [card.id]: to }));
    try {
      await saveStatus(teamId, String(card.id), to);
      await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
      toast(`"${card.title}"을(를) ${labelOf(to)}(으)로 옮겼어요.`);
    } catch (error) {
      const reason =
        error instanceof ApiError && error.code === 'GITHUB_PERMISSION'
          ? NO_PERMISSION
          : 'GitHub에 반영하지 못했어요.';
      toast(`${reason} 카드를 원래 자리로 돌려놨어요.`, { tone: 'alert' });
      throw error;
    } finally {
      setMoves((current) => {
        const next = { ...current };
        delete next[card.id];
        return next;
      });
    }
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `${titleOf(active.id)} 카드를 들었어요. 왼쪽·오른쪽 방향키로 칸을 고르고 스페이스로 내려놓으세요.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} 카드가 ${labelOf(over.id as IssueStatus)} 칸 위에 있어요.`
        : `${titleOf(active.id)} 카드가 칸 밖에 있어요.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} 카드를 ${labelOf(over.id as IssueStatus)} 칸에 놓았어요.`
        : `${titleOf(active.id)} 카드를 놓지 않았어요.`,
    onDragCancel: ({ active }) => `${titleOf(active.id)} 카드 옮기기를 취소했어요.`,
  };

  function onDragStart({ active }: DragStartEvent) {
    setDragging(cards.find((card) => card.id === active.id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const card = cards.find((item) => item.id === active.id);
    const to = over?.id as IssueStatus | undefined;
    if (!card || !to || !isTarget(to)) return;
    void move(card, to).catch(() => undefined);
  }

  const sheetCard = cards.find((card) => String(card.id) === statusSheet.id);

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
        onDragCancel={() => setDragging(null)}
      >
        <div className={styles.columns} data-dragging={dragging !== null}>
          {columns
            .filter((column) => column.status !== 'OTHER' || column.cards.length > 0)
            .map((column) => (
              <BoardColumnView
                key={column.status}
                status={column.status}
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
                          onChangeStatus={() => {
                            if (!canWrite) {
                              toast(NO_PERMISSION, { tone: 'alert' });
                              return;
                            }
                            statusSheet.open(String(card.id));
                          }}
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
        onSave={async (status) => {
          if (sheetCard) await move(sheetCard, status);
        }}
      />
    </>
  );
}

function BoardColumnView({
  status,
  count,
  children,
}: {
  status: IssueStatus;
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
    >
      <h2 id={headingId} className={styles.columnTitle}>
        {ISSUE_STATUS_LABELS[status]}
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
