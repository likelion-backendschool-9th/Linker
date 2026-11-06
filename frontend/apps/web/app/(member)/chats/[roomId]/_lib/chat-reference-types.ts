export type IssueReference = { number: number; repoId: number };
export type ChatIssueCard = { canView: false; title: string } | {
  issueId: number;
  teamId: number;
  number: number;
  repoId: number;
  repoName: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'OTHER';
  canView: true;
};
export type ChatReferences = {
  mentionedUserIds: number[];
  mentionAll: boolean;
  issueRefs: IssueReference[];
};
