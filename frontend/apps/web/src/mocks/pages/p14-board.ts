import { get, type MockRoute } from '../core/define';
import { STATUS_LABELS, type IssueStatus } from '../fixtures/issues';
import { findTeam } from '../fixtures/teams';
import { filterIssues, issueRow } from './p11-issue-list';

/** 14 Status board: `BoardController`. Moves go through 12's status API. */

const COLUMNS: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'OTHER'];

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/board', (ctx) => {
    const issues = filterIssues(ctx, ctx.params.teamId!).filter((item) => item.inProject);
    const team = findTeam(ctx.params.teamId);
    return {
      // Repo write permission and an active team; team 2 is read-only for the mock user (like 11, 12)
      canWrite: team !== undefined && team.id !== 2 && team.status !== 'READ_ONLY',
      columns: COLUMNS.map((status) => ({
        status,
        label: STATUS_LABELS[status],
        cards: issues.filter((item) => item.status === status).map(issueRow),
      })),
    };
  }),
];
