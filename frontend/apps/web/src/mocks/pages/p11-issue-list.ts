import {
  dateOnly,
  fail,
  get,
  paginate,
  post,
  type MockContext,
  type MockRoute,
} from '../core/define';
import { ISSUES, isOverdue, LABELS, type IssueStatus, type MockIssue } from '../fixtures/issues';
import { findTeam, TEAM_MEMBERS, type MockTeam } from '../fixtures/teams';

/** 11 Issue list: `IssueListController`. `issueRow` and `filterIssues` are borrowed by 14 and 15. */

/** List row / board card shape (09 WBS §1-3 rule 4: DTOs belong to the page) */
export function issueRow(item: MockIssue) {
  return {
    id: item.id,
    number: item.number,
    repoId: item.repoId,
    repoName: item.repoName,
    title: item.title,
    status: item.status,
    state: item.state,
    // Assignees who aren't current team members show as "팀 밖 사용자" (04 ch. 7 exceptions)
    assignees: item.assignees.map((user) => ({
      ...user,
      inTeam: (TEAM_MEMBERS[item.teamId] ?? []).some((m) => m.user.id === user.id),
    })),
    labels: item.labels,
    startDate: item.startDate,
    dueDate: item.dueDate,
    overdue: isOverdue(item),
    inProject: item.inProject,
    // "일정이 GitHub에 반영되지 않았어요" flag (POL-I sync failure)
    scheduleSyncFailed: item.number === 9,
  };
}

/** Same filters for list, board and calendar: repo, status, assignee, label, open */
export function filterIssues(ctx: MockContext, teamId: string) {
  const { query } = ctx;
  const repo = query.get('repo');
  const status = query.get('status') as IssueStatus | null;
  const assignee = query.get('assignee');
  const labelName = query.get('label');
  const open = query.get('open');
  return ISSUES.filter((item) => item.teamId === Number(teamId))
    .filter((item) => !repo || String(item.repoId) === repo)
    .filter((item) => !status || item.status === status)
    .filter((item) => !assignee || item.assignees.some((a) => a.login === assignee))
    .filter((item) => !labelName || item.labels.some((l) => l.name === labelName))
    .filter((item) => open !== 'true' || item.state === 'OPEN');
}

function teamOr404(id: string) {
  const team = findTeam(id);
  if (!team) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return team;
}

/** Repo write permission (POL-I-2) and an active team; team 2 is read-only for the mock user, like 12 */
function canWrite(team: MockTeam) {
  return team.id !== 2 && team.status !== 'READ_ONLY' && team.status !== 'ARCHIVED';
}

let lastRefreshAt = 0;

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/issues', (ctx) => {
    const team = teamOr404(ctx.params.teamId!);
    const items = filterIssues(ctx, ctx.params.teamId!)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(issueRow);
    return { ...paginate(items, ctx.query), total: items.length, canWrite: canWrite(team) };
  }),
  get('/api/v1/user/teams/:teamId/issues/unscheduled', ({ params, query }) => {
    const team = teamOr404(params.teamId);
    const items = ISSUES.filter(
      (item) => item.teamId === team.id && (!item.inProject || !item.dueDate),
    ).map(issueRow);
    return { ...paginate(items, query), total: items.length, canWrite: canWrite(team) };
  }),
  get('/api/v1/user/teams/:teamId/issue-filters', ({ params }) => {
    const team = teamOr404(params.teamId);
    return {
      repos: team.repos.map(({ id, name }) => ({ id, name })),
      labels: LABELS,
      members: (TEAM_MEMBERS[team.id] ?? []).map((m) => m.user),
      statuses: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as IssueStatus[],
    };
  }),
  // Once per minute (POL-I sync): the second call inside a minute is rejected.
  // Takes the screen's `view` and filters so only that screen's issues are re-fetched (04 ch. 7 "Sync").
  post('/api/v1/user/teams/:teamId/issues/refresh', ({ params }) => {
    teamOr404(params.teamId);
    const waitMs = 60_000 - (Date.now() - lastRefreshAt);
    if (waitMs > 0) {
      fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요', {
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }
    lastRefreshAt = Date.now();
    return { refreshedAt: new Date().toISOString() };
  }),
  post('/api/v1/user/teams/:teamId/issues/:issueId/project-item', ({ params }) => {
    const item = ISSUES.find((i) => i.id === Number(params.issueId));
    if (item) item.inProject = true;
    return undefined;
  }),

  // `[Included]` Progress card: Flex teams only (POL-T-7)
  get('/api/v1/user/teams/:teamId/progress', ({ params }) => {
    const team = teamOr404(params.teamId);
    if (team.plan !== 'FLEX') {
      fail(
        403,
        'PLAN_LIMIT',
        'Flex를 구독하면 팀 달성률과 최근 14일 추이를 그래프로 볼 수 있어요.',
        {
          reason: 'PROGRESS_GRAPH',
        },
      );
    }
    const issues = ISSUES.filter((i) => i.teamId === team.id);
    const count = (status: IssueStatus) => issues.filter((i) => i.status === status).length;
    const done = count('DONE');
    const total = issues.length - count('OTHER');
    const open = issues.filter((i) => i.state === 'OPEN');
    const dueSoon = dateOnly(3);
    // Last 14 days of snapshots, oldest first; today is drawn from current state (POL-T-7)
    const history = Array.from({ length: 14 }, (_, index) => {
      const day = 13 - index;
      const finished = Math.max(0, done - Math.floor(day / 5));
      return {
        date: dateOnly(-day),
        todo: Math.max(0, count('TODO') + Math.floor(day / 4)),
        inProgress: count('IN_PROGRESS'),
        blocked: count('BLOCKED'),
        done: finished,
      };
    });
    return {
      completion: { done, total, rate: total ? Math.round((done / total) * 100) : 0 },
      counts: {
        todo: count('TODO'),
        inProgress: count('IN_PROGRESS'),
        blocked: count('BLOCKED'),
        done,
      },
      history,
      // Load per assignee, no ranking (POL-T-7)
      openByAssignee: (TEAM_MEMBERS[team.id] ?? []).map((m) => ({
        user: m.user,
        openCount: open.filter((i) => i.assignees.some((a) => a.id === m.user.id)).length,
      })),
      overdueCount: open.filter(isOverdue).length,
      dueSoonCount: open.filter(
        (i) => i.dueDate && i.dueDate >= dateOnly(0) && i.dueDate <= dueSoon,
      ).length,
    };
  }),
];
