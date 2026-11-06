import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { createLoader, parseAsString, parseAsStringLiteral } from 'nuqs/server';

import { apiFetch } from '@/lib/api/api-fetch';
import { todayKst } from '@/lib/format/time';

import type { IssueRow } from '../../_lib/issue-queries';
import { CALENDAR_VIEWS, isDay, visibleWeeks, type CalendarView } from './calendar-grid';

/** Provisional 15 `IssueController` contract (WBS 15) */
export type CalendarResponse = { from: string; to: string; items: IssueRow[] };

/** `?view=month|week&date=yyyy-MM-dd`; `assignee` is 11's filter parameter */
export const calendarParsers = {
  view: parseAsStringLiteral(CALENDAR_VIEWS).withDefault('month'),
  date: parseAsString,
  assignee: parseAsString,
};

export const loadCalendarParams = createLoader(calendarParsers);

/** The day the screen shows: the URL's date when it's a real day, otherwise today in KST */
export const anchorOf = (date: string | null) => (isDay(date) ? date : todayKst());

export function calendarRange(view: CalendarView, anchor: string) {
  const weeks = visibleWeeks(view, anchor);
  return { weeks, from: weeks[0]![0]!, to: weeks.at(-1)!.at(-1)! };
}

export function calendarOptions(teamId: string, from: string, to: string, assignee: string | null) {
  return queryOptions({
    // Under ['issues', teamId] so changes in 12, 13, 14 refresh the calendar
    queryKey: ['issues', teamId, 'calendar', from, to, assignee] as const,
    // Keep the old month on screen while the next one loads
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ from, to });
      if (assignee) query.set('assignee', assignee);
      return apiFetch<CalendarResponse>(
        `/api/v1/user/teams/${encodeURIComponent(teamId)}/calendar?${query}`,
        { signal },
      );
    },
  });
}
