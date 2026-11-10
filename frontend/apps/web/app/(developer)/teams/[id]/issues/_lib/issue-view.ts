import { parseAsString, parseAsStringLiteral } from 'nuqs/server';

import { ISSUE } from '@/lib/policy';

import type { IssueListView } from '../../_lib/issue-queries';

/** 전체 / 일정 없음 of 11 (the "일정 없음" chip), kept in the URL as `?view=` */
export const ISSUE_VIEWS = ['all', 'unscheduled'] as const satisfies readonly IssueListView[];

export const issueViewParser = parseAsStringLiteral(ISSUE_VIEWS).withDefault('all');

export function parseIssueView(value: string | string[] | undefined): IssueListView {
  return ISSUE_VIEWS.find((view) => view === value) ?? 'all';
}

/** Longest title search of the 11 search box (POL-I-6); the server rejects longer text. */
export const ISSUE_SEARCH_MAX_LENGTH = ISSUE.searchMaxLength;

/** Title search of 11, kept in the URL as `?q=` (11 only: 14 and 15 have no search box) */
export const issueSearchParser = parseAsString;

export function parseIssueSearch(value: string | string[] | undefined): string | null {
  const text = typeof value === 'string' ? value.trim().slice(0, ISSUE_SEARCH_MAX_LENGTH) : '';
  return text === '' ? null : text;
}
