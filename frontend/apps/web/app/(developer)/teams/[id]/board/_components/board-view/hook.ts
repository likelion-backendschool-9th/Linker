'use client';

import {
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useId, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { issueFilterParsers } from '../../../_lib/issue-filters';
import type { IssueRow } from '../../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS, type IssueStatus } from '../../../../../_lib/issue-status';
import { boardOptions, issueKeys, saveStatus } from './api';

/** 04 ch. 12 "No GitHub permission" */
export const NO_PERMISSION = '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.';

/** Columns a card can be dropped into: the four Linker statuses. "기타" only shows unmapped values. */
export const isTarget = (status: IssueStatus) => status !== 'OTHER';

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

export function useBoardView(teamId: string) {
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

  const canWrite = Boolean(board.data?.canWrite && viewer.status !== 'SUSPENDED');
  const cards = board.data?.columns.flatMap((column) => column.cards) ?? [];
  const statusOf = (card: IssueRow) => moves[card.id] ?? card.status;
  const columns =
    board.data?.columns.map((column) => ({
      ...column,
      cards: cards.filter((card) => statusOf(card) === column.status),
    })) ?? [];
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

  function onChangeStatus(card: IssueRow) {
    if (!canWrite) {
      toast(NO_PERMISSION, { tone: 'alert' });
      return;
    }
    statusSheet.open(String(card.id));
  }

  const sheetCard = cards.find((card) => String(card.id) === statusSheet.id);

  return {
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
    statusSheet,
    sheetCard,
    move,
    onDragStart,
    onDragEnd,
    onDragCancel: () => setDragging(null),
    onChangeStatus,
  };
}
