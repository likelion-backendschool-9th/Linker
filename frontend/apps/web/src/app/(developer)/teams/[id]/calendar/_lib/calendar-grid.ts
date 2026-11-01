import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import type { IssueRow } from '../../_lib/issue-queries';

/**
 * Calendar math on `yyyy-MM-dd` strings, the issues' date format (KST calendar dates, POL-I-4).
 * Only calendar days are added and compared, so the result is the same on a UTC server and a KST browser.
 * Weeks start on Sunday.
 */

export const CALENDAR_VIEWS = ['month', 'week'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const DAY = 'yyyy-MM-dd';
const WEEK = { weekStartsOn: 0 } as const;

const toDay = (date: Date) => format(date, DAY);

export function isDay(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // `?date=2026-02-30` from a hand-edited URL must not crash the page
  const date = parseISO(value);
  return isValid(date) && toDay(date) === value;
}

/** The days on screen, whole weeks (month: the weeks touching the month) */
export function visibleWeeks(view: CalendarView, anchor: string): string[][] {
  const date = parseISO(anchor);
  const first = view === 'month' ? startOfWeek(startOfMonth(date), WEEK) : startOfWeek(date, WEEK);
  const last = view === 'month' ? endOfWeek(endOfMonth(date), WEEK) : endOfWeek(date, WEEK);
  const weeks: string[][] = [];
  for (let day = first; day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => toDay(addDays(day, index))));
  }
  return weeks;
}

/** The anchor one month / week earlier or later */
export function shiftAnchor(view: CalendarView, anchor: string, by: 1 | -1): string {
  const date = parseISO(anchor);
  return toDay(view === 'month' ? addMonths(date, by) : addWeeks(date, by));
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** Start and end of an issue on the calendar; a due date alone is a one-day dot. No due date → not shown. */
export function spanOf(issue: IssueRow): { start: string; end: string; dot: boolean } | null {
  if (!issue.dueDate) return null;
  const start =
    issue.startDate && issue.startDate <= issue.dueDate ? issue.startDate : issue.dueDate;
  return { start, end: issue.dueDate, dot: !issue.startDate };
}

export type Segment = {
  issue: IssueRow;
  lane: number;
  /** 0 = Sunday */
  startCol: number;
  span: number;
  /** The issue starts / ends inside this week (rounded bar ends) */
  starts: boolean;
  ends: boolean;
  dot: boolean;
};

/** The pieces of the issues' bars in one week, stacked in lanes so they never overlap */
export function layoutWeek(
  week: string[],
  issues: IssueRow[],
): { segments: Segment[]; lanes: number } {
  const first = week[0]!;
  const last = week[6]!;
  const pieces = issues
    .map((issue) => ({ issue, span: spanOf(issue) }))
    .filter(
      (item): item is { issue: IssueRow; span: NonNullable<ReturnType<typeof spanOf>> } =>
        item.span !== null && item.span.start <= last && item.span.end >= first,
    )
    .map(({ issue, span }) => {
      const startCol = span.start < first ? 0 : week.indexOf(span.start);
      const endCol = span.end > last ? 6 : week.indexOf(span.end);
      return {
        issue,
        startCol,
        span: endCol - startCol + 1,
        starts: span.start >= first,
        ends: span.end <= last,
        dot: span.dot,
      };
    })
    // Earlier first, then longer first: long bars stay on top lanes
    .sort((a, b) => a.startCol - b.startCol || b.span - a.span || a.issue.id - b.issue.id);

  const laneEnds: number[] = [];
  const segments = pieces.map((piece) => {
    let lane = laneEnds.findIndex((end) => end < piece.startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = piece.startCol + piece.span - 1;
    return { ...piece, lane };
  });
  return { segments, lanes: laneEnds.length };
}

/** Issues whose bar covers this day (the day sheet) */
export function issuesOnDay(day: string, issues: IssueRow[]): IssueRow[] {
  return issues.filter((issue) => {
    const span = spanOf(issue);
    return span !== null && span.start <= day && day <= span.end;
  });
}
