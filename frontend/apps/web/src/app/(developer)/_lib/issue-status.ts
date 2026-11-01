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
