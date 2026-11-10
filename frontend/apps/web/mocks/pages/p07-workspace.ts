import type { MyTeamsResponse } from '@linker/api/openAPIDefinition.schemas';

import { TEAM } from '@/lib/policy';

import { fail, get, type MockRoute } from '../core/define';
import { ISSUES } from '../fixtures/issues';
import { TEAM_MEMBERS, TEAMS } from '../fixtures/teams';
import { ME } from '../fixtures/users';
import { issueRow } from './p11-issue-list';

/** 07 Workspace home: `TeamController / IssueController` */

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
        joinedAt:
          TEAM_MEMBERS[team.id]?.find((member) => member.user.id === ME.id)?.joinedAt ??
          team.createdAt,
      }));
      return {
        items,
        teamLimit: TEAM.maxTeamsPerUser,
        teamCount: items.filter((team) => team.status !== 'ARCHIVED').length,
        nextCursor: null,
      } satisfies MyTeamsResponse;
    },
    { only: 'developer' },
  ),
  // `[Included]` open issues assigned to me in one of my teams: due date ascending, no due date last
  get(
    '/api/v1/user/me/issues',
    ({ query }) => {
      const raw = query.get('teamId');
      const teamId = raw === null ? Number.NaN : Number(raw);
      const isMine = (TEAM_MEMBERS[teamId] ?? []).some((member) => member.user.id === ME.id);
      if (!Number.isInteger(teamId) || !isMine) {
        fail(400, 'VALIDATION_ERROR', '내 팀만 선택할 수 있어요.');
      }
      return {
        teamId,
        items: ISSUES.filter(
          (i) =>
            i.teamId === teamId && i.state === 'OPEN' && i.assignees.some((a) => a.id === ME.id),
        )
          .sort(
            (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id - b.id,
          )
          .map(issueRow),
      };
    },
    { only: 'developer' },
  ),
];
