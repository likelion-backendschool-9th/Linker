/** Board status of an issue (04 POL-I-3). OTHER = a board column not mapped to the four. */
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number] | 'OTHER';

/** UI copy of the four statuses (04 POL-I-3) and the unmapped column (07 TODO 14) */
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  TODO: '작업 전',
  IN_PROGRESS: '작업 중',
  BLOCKED: '작업 중단',
  DONE: '작업 완료',
  OTHER: '기타',
};

/**
 * GitHub Projects Status option color enum (board_status_mappings.color).
 * OTHER / NONE and missing values resolve to GRAY on the server.
 */
export const BOARD_STATUS_COLORS = [
  'BLUE',
  'GRAY',
  'GREEN',
  'ORANGE',
  'PINK',
  'PURPLE',
  'RED',
  'YELLOW',
] as const;
export type BoardStatusColor = (typeof BOARD_STATUS_COLORS)[number];

const BOARD_STATUS_COLOR_VAR: Record<BoardStatusColor, string> = {
  BLUE: 'var(--color-board-status-blue)',
  GRAY: 'var(--color-board-status-gray)',
  GREEN: 'var(--color-board-status-green)',
  ORANGE: 'var(--color-board-status-orange)',
  PINK: 'var(--color-board-status-pink)',
  PURPLE: 'var(--color-board-status-purple)',
  RED: 'var(--color-board-status-red)',
  YELLOW: 'var(--color-board-status-yellow)',
};

/** CSS color token for a board Status option color. Never invents hex in components. */
export function boardStatusColorVar(color: BoardStatusColor | null | undefined): string {
  return BOARD_STATUS_COLOR_VAR[color && color in BOARD_STATUS_COLOR_VAR ? color : 'GRAY'];
}
