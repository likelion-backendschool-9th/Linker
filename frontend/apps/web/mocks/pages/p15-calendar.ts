import { get, type MockRoute } from '../core/define';
import { ISSUES } from '../fixtures/issues';
import { issueRow } from './p11-issue-list';

/** 15 Calendar: `IssueController`. Issues without a due date are left out (they live under "일정 없음"). */

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/calendar', ({ params, query }) => {
    const from = query.get('from') ?? '0000-01-01';
    const to = query.get('to') ?? '9999-12-31';
    const assignee = query.get('assignee');
    const items = ISSUES.filter((item) => item.teamId === Number(params.teamId))
      .filter((item) => item.inProject && item.dueDate)
      // Overlaps the range: starts before `to` and ends after `from`
      .filter((item) => (item.startDate ?? item.dueDate!) <= to && item.dueDate! >= from)
      .filter((item) => !assignee || item.assignees.some((a) => a.login === assignee))
      .map(issueRow);
    return { from, to, items };
  }),
];
