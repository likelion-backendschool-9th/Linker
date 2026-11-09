import type { IssueRow } from '../../_lib/issue-queries';
import { isDay, issuesOnDay, layoutWeek, shiftAnchor, spanOf, visibleWeeks } from './calendar-grid';

const issue = (id: number, startDate: string | null, dueDate: string | null) =>
  ({ id, startDate, dueDate, title: `#${id}` }) as IssueRow;

it('shows whole weeks starting on Monday', () => {
  const month = visibleWeeks('month', '2026-11-15');
  expect(month[0]![0]).toBe('2026-10-26'); // Monday
  expect(month.at(-1)!.at(-1)).toBe('2026-12-06');
  expect(month).toHaveLength(6);
  expect(visibleWeeks('week', '2026-11-04')).toEqual([
    [
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ],
  ]);
});

it('moves by a month or a week', () => {
  expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28');
  expect(shiftAnchor('week', '2026-11-04', -1)).toBe('2026-10-28');
});

it('accepts only real calendar days from the URL', () => {
  expect(isDay('2026-11-04')).toBe(true);
  expect(isDay('2026-02-30')).toBe(false);
  expect(isDay('11/04')).toBe(false);
});

it('draws a due date alone as a dot, and leaves out issues without a due date (POL-I-3)', () => {
  expect(spanOf(issue(1, null, '2026-11-03'))).toEqual({
    start: '2026-11-03',
    end: '2026-11-03',
    dot: true,
  });
  expect(spanOf(issue(2, '2026-11-01', null))).toBeNull();
});

it('splits bars at week edges and stacks overlapping ones in lanes', () => {
  const week = visibleWeeks('week', '2026-11-04')[0]!;
  const { segments, lanes } = layoutWeek(week, [
    issue(1, '2026-10-29', '2026-11-03'), // from last week, ends Tuesday
    issue(2, '2026-11-02', '2026-11-10'), // Monday, into next week
    issue(3, null, '2026-11-05'), // dot on Thursday
    issue(4, '2026-11-04', '2026-11-04'),
  ]);
  const byId = Object.fromEntries(segments.map((s) => [s.issue.id, s]));
  expect(byId[1]).toMatchObject({ startCol: 0, span: 2, starts: false, ends: true, lane: 1 });
  expect(byId[2]).toMatchObject({ startCol: 0, span: 7, starts: true, ends: false, lane: 0 });
  expect(byId[4]).toMatchObject({ startCol: 2, span: 1, lane: 1 });
  expect(byId[3]).toMatchObject({ startCol: 3, span: 1, dot: true, lane: 1 });
  expect(lanes).toBe(2);
});

it('lists the issues covering a day', () => {
  const items = [
    issue(1, '2026-11-01', '2026-11-05'),
    issue(2, null, '2026-11-03'),
    issue(3, null, null),
  ];
  expect(issuesOnDay('2026-11-03', items).map((i) => i.id)).toEqual([1, 2]);
  expect(issuesOnDay('2026-11-06', items)).toEqual([]);
});
