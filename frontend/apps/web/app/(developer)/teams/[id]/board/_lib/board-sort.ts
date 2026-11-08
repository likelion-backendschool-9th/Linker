import { parseAsStringLiteral } from 'nuqs/server';

import type { IssueRow } from '../../_lib/issue-queries';
import type { ISSUE_STATUSES } from '../../../../_lib/issue-status';

/**
 * "최신순 / 오래 된 순" of Figma 14 (368:3414). The board API has no sort and cards carry no creation date,
 * so the screen orders each column by the Linker issue id (the order issues reached Linker): newest = highest id.
 * Kept in the URL as `?sort=oldest`; the default "최신순" leaves the URL clean.
 */
export const BOARD_SORTS = ['latest', 'oldest'] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];

export const boardSortParser = parseAsStringLiteral(BOARD_SORTS).withDefault('latest');

/** Figma copy, verbatim */
export const BOARD_SORT_LABELS: Record<BoardSort, string> = {
  latest: '최신순',
  oldest: '오래 된 순',
};

/** Order of the four statuses in the "필터" and card status menus (Figma 368:3562, 368:3741) */
export const BOARD_MENU_STATUSES: readonly (typeof ISSUE_STATUSES)[number][] = [
  'IN_PROGRESS',
  'TODO',
  'DONE',
  'BLOCKED',
];

export function sortCards(cards: IssueRow[], sort: BoardSort): IssueRow[] {
  return [...cards].sort((a, b) => (sort === 'latest' ? b.id - a.id : a.id - b.id));
}
