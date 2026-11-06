'use client';

import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useQueryStates } from 'nuqs';
import { useId } from 'react';

import { formatDate, todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { layoutWeek, shiftAnchor } from '../../_lib/calendar-grid';
import {
  anchorOf,
  calendarOptions,
  calendarParsers,
  calendarRange,
  issueFilterOptions,
} from './api';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** Month cells show this many bars, then "+N" (the day sheet lists them all) */
export const MONTH_LANES = 3;

export const dayNumber = (day: string) => Number(day.slice(8));
export const monthTitle = (anchor: string) =>
  `${anchor.slice(0, 4)}년 ${Number(anchor.slice(5, 7))}월`;

export function dayLabel(day: string) {
  const weekday = WEEKDAYS[parseISO(day).getDay()];
  return `${Number(day.slice(5, 7))}월 ${dayNumber(day)}일 ${weekday}요일`;
}

export function useCalendarView(teamId: string) {
  const [params, setParams] = useQueryStates(calendarParsers, { history: 'replace' });
  const anchor = anchorOf(params.date);
  const today = todayKst();
  const { weeks, from, to } = calendarRange(params.view, anchor);
  const calendar = useQuery(calendarOptions(teamId, from, to, params.assignee));
  const members = useQuery(issueFilterOptions(teamId));
  const daySheet = useOverlay('calendar-day');
  const assigneeId = useId();

  const issues = calendar.data?.items ?? [];
  const layouts = weeks.map((week) => layoutWeek(week, issues));
  const title =
    params.view === 'month'
      ? monthTitle(anchor)
      : `${formatDate(weeks[0]![0]!)} – ${formatDate(weeks[0]![6]!)}`;

  const go = (date: string) => void setParams({ date: date === today ? null : date });

  return {
    params,
    anchor,
    today,
    weeks,
    calendar,
    members,
    daySheet,
    assigneeId,
    issues,
    layouts,
    title,
    goPrev: () => go(shiftAnchor(params.view, anchor, -1)),
    goNext: () => go(shiftAnchor(params.view, anchor, 1)),
    goToday: () => go(today),
    setView: (view: 'month' | 'week') => void setParams({ view: view === 'month' ? null : view }),
    setAssignee: (value: string) => void setParams({ assignee: value || null }),
  };
}
