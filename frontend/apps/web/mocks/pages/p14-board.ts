import { get, type MockRoute } from '../core/define';
import { mockStatusColor, STATUS_LABELS, type IssueStatus } from '../fixtures/issues';
import { findTeam } from '../fixtures/teams';
import { filterIssues, issueRow } from './p11-issue-list';

/** 14 Status board: `IssueController`. Moves go through 12's status API. */

const COLUMNS: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'OTHER'];

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/board', (ctx) => {
    const issues = filterIssues(ctx, ctx.params.teamId!).filter((item) => item.inProject);
    const team = findTeam(ctx.params.teamId);
    const canWrite = team !== undefined && team.id !== 2 && team.status !== 'READ_ONLY';
    return {
      // Repo write on any linked repo + writable team; team 2 is read-only for the mock user
      canWrite,
      writePermissionReason: canWrite
        ? null
        : team?.status === 'READ_ONLY' || team?.id === 2
          ? 'READ_ONLY_TEAM'
          : 'NO_REPOSITORY_WRITE_PERMISSION',
      columns: COLUMNS.map((status) => ({
        status,
        statusColor: mockStatusColor(status),
        label: STATUS_LABELS[status],
        cards: issues.filter((item) => item.status === status).map(issueRow),
      })),
    };
  }),
];
