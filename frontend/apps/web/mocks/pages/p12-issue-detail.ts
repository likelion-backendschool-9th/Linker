import { fail, get, put, type MockRoute } from '../core/define';
import { findIssue, isOverdue, LABELS, type IssueStatus } from '../fixtures/issues';
import { TEAM_MEMBERS } from '../fixtures/teams';

/** 12 Issue detail: `IssueController`. Writes change the in-memory issue, so the board and list follow. */

function issueOr404(teamId: string, issueId: string) {
  const issue = findIssue(teamId, issueId);
  if (!issue) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return issue;
}

/** Writes need repo write permission (POL-I-2); team 2 is read-only for the mock user */
function requireWrite(teamId: string) {
  if (Number(teamId) === 2) {
    fail(
      403,
      'GITHUB_PERMISSION',
      '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
    );
  }
}

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/issues/:issueId', ({ params }) => {
    const issue = issueOr404(params.teamId!, params.issueId!);
    const members = TEAM_MEMBERS[issue.teamId] ?? [];
    return {
      ...issue,
      // Assignees no longer in the team show as "팀 밖 사용자" (04 ch. 7 exceptions)
      assignees: issue.assignees.map((user) => ({
        ...user,
        inTeam: members.some((m) => m.user.id === user.id),
      })),
      overdue: isOverdue(issue),
      canWrite: Number(params.teamId) !== 2,
      // `sync_status = FAILED`: "일정이 GitHub에 반영되지 않았어요" (same issue as the list mock)
      syncFailed: issue.number === 9,
      // Transferred on GitHub → the page follows to `movedToIssueId` (07 TODO 12)
      deletedOrMoved: null as null | 'DELETED' | 'MOVED',
      movedToIssueId: null as number | null,
    };
  }),
  // Members with repo access who accepted the org invite; max 10 assignees (POL-I-2)
  get('/api/v1/user/teams/:teamId/issues/:issueId/assignee-candidates', ({ params }) => ({
    items: (TEAM_MEMBERS[Number(params.teamId)] ?? [])
      .filter((m) => m.inGithubOrg)
      .map((m) => m.user),
    max: 10,
  })),
  put('/api/v1/user/teams/:teamId/issues/:issueId/assignees', ({ params, body }) => {
    requireWrite(params.teamId!);
    const issue = issueOr404(params.teamId!, params.issueId!);
    const ids = (body.userIds as number[] | undefined) ?? [];
    const members = TEAM_MEMBERS[Number(params.teamId)] ?? [];
    // Keeps assignees outside the team only if they stay selected; unknown ids are dropped
    const kept = issue.assignees.filter(
      (user) => ids.includes(user.id) && !members.some((m) => m.user.id === user.id),
    );
    issue.assignees = [
      ...members.filter((m) => ids.includes(m.user.id)).map((m) => m.user),
      ...kept,
    ];
    issue.updatedAt = new Date().toISOString();
    return {
      assignees: issue.assignees.map((user) => ({
        ...user,
        inTeam: members.some((m) => m.user.id === user.id),
      })),
    };
  }),
  get('/api/v1/user/teams/:teamId/issues/:issueId/label-options', () => ({ items: LABELS })),
  put('/api/v1/user/teams/:teamId/issues/:issueId/labels', ({ params, body }) => {
    requireWrite(params.teamId!);
    const issue = issueOr404(params.teamId!, params.issueId!);
    const names = (body.labels as string[] | undefined) ?? [];
    issue.labels = LABELS.filter((label) => names.includes(label.name));
    return { labels: issue.labels };
  }),
  put('/api/v1/user/teams/:teamId/issues/:issueId/schedule', ({ params, body }) => {
    requireWrite(params.teamId!);
    const issue = issueOr404(params.teamId!, params.issueId!);
    const start = (body.startDate as string | null | undefined) ?? null;
    const due = (body.dueDate as string | null | undefined) ?? null;
    if (start && due && start > due)
      fail(400, 'INVALID_SCHEDULE', '시작일은 마감일보다 빨라야 해요');
    issue.startDate = start;
    issue.dueDate = due;
    return { startDate: start, dueDate: due };
  }),
  // Done closes the issue, moving back reopens it (POL-I-3). Borrowed by 14.
  put('/api/v1/user/teams/:teamId/issues/:issueId/status', ({ params, body }) => {
    requireWrite(params.teamId!);
    const issue = issueOr404(params.teamId!, params.issueId!);
    const status = body.status as IssueStatus;
    issue.status = status;
    issue.state = status === 'DONE' ? 'CLOSED' : 'OPEN';
    issue.updatedAt = new Date().toISOString();
    return { status: issue.status, state: issue.state };
  }),
  get('/api/v1/user/teams/:teamId/issues/:issueId/sub-issues', ({ params }) => {
    const issue = issueOr404(params.teamId!, params.issueId!);
    const { total, done } = issue.subIssues;
    return {
      total,
      done,
      items: Array.from({ length: total }, (_, index) => ({
        number: issue.number * 10 + index,
        title: `${issue.title} - 하위 작업 ${index + 1}`,
        state: index < done ? 'CLOSED' : 'OPEN',
      })),
    };
  }),
];
