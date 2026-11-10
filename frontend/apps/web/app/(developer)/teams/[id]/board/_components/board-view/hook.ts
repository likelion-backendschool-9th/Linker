'use client';

import {
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
} from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useQueryState, useQueryStates } from 'nuqs';
import { useId, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { toast } from '@/stores/toast-store';

import { issueFilterParsers } from '../../../_lib/issue-filters';
import type { IssueRow } from '../../../_lib/issue-queries';
import {
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../_lib/issue-status';
import { boardSortParser, BOARD_SORTS, sortCards } from '../../_lib/board-sort';
import { boardOptions, issueKeys, saveStatus } from './api';

/** 04 ch. 12 "No GitHub permission" */
export const NO_PERMISSION = '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.';

/** Columns a card can be dropped into: the four Linker statuses. "기타" only shows unmapped values. */
const isTarget = (status: string): status is (typeof ISSUE_STATUSES)[number] =>
  ISSUE_STATUSES.some((item) => item === status);

// Pointer first (mouse, touch), then the dragged card's rect
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export function useBoardView(teamId: string) {
  const viewer = useViewer();
  const client = useQueryClient();
  const [filters, setFilters] = useQueryStates(issueFilterParsers, { history: 'replace' });
  const [sort, setSort] = useQueryState('sort', boardSortParser.withOptions({ history: 'replace' }));
  const board = useQuery(boardOptions(teamId, filters));
  // Optimistic moves (blueprint §9-3): shown right away, dropped again when GitHub refuses
  const [moves, setMoves] = useState<Record<number, IssueStatus>>({});
  const [dragging, setDragging] = useState<IssueRow | null>(null);
  // Screen-reader note after a move (the card leaves the column the user was in)
  const [announcement, setAnnouncement] = useState('');
  // dnd-kit numbers its accessibility ids per page load; a React id keeps server and client equal
  const dndId = useId();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long press on touch screens, so a swipe still scrolls the columns (07 TODO 14)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const canWrite = Boolean(board.data?.canWrite && viewer.status !== 'SUSPENDED');
  const serverColumns = board.data?.columns ?? [];
  const cards = serverColumns.flatMap((column) => column.cards);
  // The column a card came in (NONE cards sit in 기타 with their own status)
  const homeOf = new Map(
    serverColumns.flatMap((column) => column.cards.map((card) => [card.id, column.status])),
  );
  const columnOf = (card: IssueRow) => moves[card.id] ?? homeOf.get(card.id) ?? card.status;
  const colorOf = new Map(serverColumns.map((column) => [column.status, column.statusColor]));
  const statusOf = (card: IssueRow): IssueStatus => moves[card.id] ?? card.status;
  const statusColorOf = (card: IssueRow): BoardStatusColor =>
    moves[card.id] !== undefined
      ? (colorOf.get(moves[card.id]!) ?? card.statusColor)
      : card.statusColor;

  const columns = serverColumns
    .map((column) => ({
      ...column,
      cards: sortCards(
        cards.filter((card) => columnOf(card) === column.status),
        sort,
      ),
    }))
    // 기타 only when it has cards; the "필터" menu keeps one status column
    .filter((column) => column.status !== 'OTHER' || column.cards.length > 0)
    .filter((column) => filters.status === null || column.status === filters.status);

  const labelOf = (status: IssueStatus) => ISSUE_STATUS_LABELS[status];
  const titleOf = (id: number | string) =>
    cards.find((card) => String(card.id) === String(id))?.title ?? '카드';

  /** Move first, then GitHub; on failure the card goes back and the reason is shown (POL-I-4) */
  async function move(card: IssueRow, to: IssueStatus) {
    if (statusOf(card) === to || moves[card.id] !== undefined) return;
    setMoves((current) => ({ ...current, [card.id]: to }));
    try {
      await saveStatus(teamId, String(card.id), to);
      await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
      setAnnouncement(`${card.title} 카드를 ${labelOf(to)} 칸으로 옮겼어요.`);
    } catch (error) {
      const reason =
        error instanceof ApiError && error.code === 'GITHUB_PERMISSION'
          ? NO_PERMISSION
          : 'GitHub에 반영하지 못했어요.';
      toast(`${reason} 카드를 원래 자리로 돌려놨어요.`, { tone: 'error' });
    } finally {
      setMoves((current) => {
        const next = { ...current };
        delete next[card.id];
        return next;
      });
    }
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} 카드를 들었어요.`,
    onDragOver: ({ active, over }) =>
      over && isTarget(String(over.id))
        ? `${titleOf(active.id)} 카드가 ${labelOf(over.id as IssueStatus)} 칸 위에 있어요.`
        : `${titleOf(active.id)} 카드가 칸 밖에 있어요.`,
    onDragEnd: ({ active, over }) =>
      over && isTarget(String(over.id))
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
    const to = over ? String(over.id) : null;
    if (!card || !to || !isTarget(to)) return;
    void move(card, to);
  }

  /** "필터" menu: one status column; choosing it again shows every column */
  function selectStatus(value: string) {
    if (!isTarget(value)) return;
    void setFilters({ status: filters.status === value ? null : value });
  }

  function selectSort(value: string) {
    const next = BOARD_SORTS.find((item) => item === value);
    if (next) void setSort(next);
  }

  return {
    board,
    canWrite,
    columns,
    statusFilter: filters.status,
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
    onDragCancel: () => setDragging(null),
    onBlocked: () => toast(NO_PERMISSION, { tone: 'error' }),
  };
}
