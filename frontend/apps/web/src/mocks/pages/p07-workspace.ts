import { get, type MockRoute } from '../core/define';
import { ISSUES, isOverdue } from '../fixtures/issues';
import { TEAM_MEMBERS, TEAMS } from '../fixtures/teams';
import { ME } from '../fixtures/users';

/** 07 Workspace home: `WorkspaceController` */

export const routes: MockRoute[] = [
  get(
    '/api/v1/user/me/teams',
    () => {
      const items = TEAMS.map((team) => ({
        id: team.id,
        name: team.name,
        orgAvatarUrl: team.orgAvatarUrl,
        status: team.status,
        plan: team.plan,
        myRole: team.myRole,
        memberCount: TEAM_MEMBERS[team.id]?.length ?? 0,
        openIssueCount: ISSUES.filter((i) => i.teamId === team.id && i.state === 'OPEN').length,
        chatRoomId: team.chatRoomId,
        unreadCount: team.id === 1 ? 3 : 0,
      }));
      return { items, teamLimit: 10, teamCount: items.length };
    },
    { only: 'developer' },
  ),
  // `[Included]` issues assigned to me across all teams, by due date
  get(
    '/api/v1/user/me/issues',
    () => ({
      items: ISSUES.filter((i) => i.state === 'OPEN' && i.assignees.some((a) => a.id === ME.id))
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
        .map((i) => ({
          id: i.id,
          teamId: i.teamId,
          teamName: TEAMS.find((t) => t.id === i.teamId)?.name ?? '',
          number: i.number,
          title: i.title,
          status: i.status,
          dueDate: i.dueDate,
          overdue: isOverdue(i),
        })),
    }),
    { only: 'developer' },
  ),
];
