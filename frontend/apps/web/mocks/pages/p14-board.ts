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
    const readOnlyTeam = team?.status === 'READ_ONLY' || team?.status === 'ARCHIVED';
    // Team 2 is an active team whose mock user has no repo push. Moves stay open; "+" does not.
    const canWrite = team !== undefined && team.id !== 2 && !readOnlyTeam;
    return {
      canWrite,
      writePermissionReason: canWrite
        ? null
        : readOnlyTeam
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
