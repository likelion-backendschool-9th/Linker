'use client';

import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useQueryStates } from 'nuqs';
import { useEffect, useId, useRef, useState } from 'react';

import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { BoardStatusColor, IssueStatus } from '../../../../../_lib/issue-status';
import { layoutWeek } from '../../_lib/calendar-grid';
import {
  anchorOf,
  calendarOptions,
  calendarParsers,
  calendarRange,
  issueFilterParsers,
} from './api';

/** Figma 15 weekday row: the week starts on Monday */
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** The week row has room for three bar lanes (Figma 234:219); the day sheet lists them all */
export const MONTH_LANES = 3;

/** Status chips of Figma 234:219, in its order. Fallback colors when no issue of that status is on screen */
export const LEGEND: { status: IssueStatus; fallback: BoardStatusColor }[] = [
  { status: 'TODO', fallback: 'GRAY' },
  { status: 'IN_PROGRESS', fallback: 'BLUE' },
  { status: 'DONE', fallback: 'GREEN' },
  { status: 'BLOCKED', fallback: 'RED' },
];

export const dayNumber = (day: string) => Number(day.slice(8));
export const monthTitle = (anchor: string) =>
  `${anchor.slice(0, 4)}년 ${Number(anchor.slice(5, 7))}월`;
export const weekdayName = (day: string) => WEEKDAY_NAMES[parseISO(day).getDay()]!;

export function useCalendarView(teamId: string) {
  const [{ date }, setParams] = useQueryStates(calendarParsers, { history: 'replace' });
  const [filters] = useQueryStates(issueFilterParsers);
  const anchor = anchorOf(date);
  const today = todayKst();
  const { weeks, from, to } = calendarRange('month', anchor);
  // Only `assignee` goes to the API; the other filters of 11 narrow what came back
  const calendar = useQuery(calendarOptions(teamId, from, to, filters.assignee));
  const daySheet = useOverlay('calendar-day');
  const dateSheet = useOverlay('calendar-date');

  const issues = (calendar.data?.items ?? []).filter(
    (issue) =>
      (!filters.repo || String(issue.repoId) === filters.repo) &&
      (!filters.status || issue.status === filters.status) &&
      (!filters.label || issue.labels.some((label) => label.name === filters.label)) &&
      (!filters.open || issue.state === 'OPEN'),
  );
  const layouts = weeks.map((week) => layoutWeek(week, issues));
  const legend = LEGEND.map(({ status, fallback }) => ({
    status,
    color: issues.find((issue) => issue.status === status)?.statusColor ?? fallback,
  }));

  return {
    anchor,
    today,
    weeks,
    calendar,
    issues,
    layouts,
    legend,
    daySheet,
    dateSheet,
    title: monthTitle(anchor),
    /** Month picked in the date sheet: the 1st, or today's own date when it is the current month */
    goToMonth: (year: number, month: number) => {
      const first = `${year}-${String(month).padStart(2, '0')}-01`;
      return setParams({ date: first.slice(0, 7) === today.slice(0, 7) ? null : first });
    },
  };
}

/** Small note popover of the "?" button (14's dropdown look): closes on Esc and outside press */
export function useHelpPopover() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !popoverRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, buttonRef, popoverRef, popoverId, toggle: () => setOpen((value) => !value) };
}
