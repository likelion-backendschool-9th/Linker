import { parseAsStringLiteral } from 'nuqs/server';

import type { IssueListView } from '../../_lib/issue-queries';

/** 전체 / 일정 없음 tab of 11, kept in the URL as `?view=` */
export const ISSUE_VIEWS = ['all', 'unscheduled'] as const satisfies readonly IssueListView[];

export const issueViewParser = parseAsStringLiteral(ISSUE_VIEWS).withDefault('all');

export function parseIssueView(value: string | string[] | undefined): IssueListView {
  return ISSUE_VIEWS.find((view) => view === value) ?? 'all';
}
