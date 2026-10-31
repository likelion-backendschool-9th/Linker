import type { IssueStatus } from '../../../_lib/issue-status';
import type { FormAnswers } from './form-body';

/**
 * What 13 keeps on the device while writing and after a failed send (04 ch. 2 "Network and failures",
 * 7 days). `null` assignees/labels = still the template's defaults.
 */
export type IssueDraft = {
  repoId: number;
  templateKey: string;
  title: string;
  body: string;
  answers: FormAnswers;
  assigneeIds: number[] | null;
  labels: string[] | null;
  startDate: string | null;
  dueDate: string | null;
  status: IssueStatus;
};

export const issueDraftKey = (teamId: string) => `draft:issue:team-${teamId}`;
