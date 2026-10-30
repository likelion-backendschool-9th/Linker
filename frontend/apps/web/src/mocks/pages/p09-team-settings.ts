import { daysFromNow, del, fail, get, newId, patch, post, type MockRoute } from '../core/define';
import { findTeam, TEAM_MEMBERS, TEAMS } from '../fixtures/teams';

/** 09 Team settings & members: `TeamSettingsController` */

type InviteLink = { id: number; code: string; expiresAt: string; createdBy: string };
const inviteLinks: Record<number, InviteLink[]> = {
  1: [{ id: 1, code: 'demo-valid', expiresAt: daysFromNow(5), createdBy: '한서준' }],
};

function teamOr404(id: string) {
  const team = findTeam(id);
  if (!team) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return team;
}

// Buttons the screen may enable per role (04 ch. 6 table)
function permissions(role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const admin = role !== 'MEMBER';
  const owner = role === 'OWNER';
  return {
    editInfo: admin,
    manageRepos: admin,
    createInviteLink: admin,
    manageMembers: admin,
    changeRoles: owner,
    transferOwnership: owner,
    completeProject: admin,
    archive: owner,
    deleteTeam: owner,
    leave: !owner,
  };
}

export const routes: MockRoute[] = [
  get('/api/v1/user/teams/:teamId/settings', ({ params }) => {
    const team = teamOr404(params.teamId);
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      orgLogin: team.orgLogin,
      orgAvatarUrl: team.orgAvatarUrl,
      status: team.status,
      plan: team.plan,
      myRole: team.myRole,
      permissions: permissions(team.myRole),
      repos: team.repos,
      board: {
        id: 'board-1',
        name: 'Linker',
        url: `https://github.com/orgs/${team.orgLogin}/projects/1`,
      },
      aiSummaryEnabled: team.plan === 'FLEX',
      completedAt: team.completedAt,
      // Free teams: 6 members (POL-T-1)
      memberLimit: team.plan === 'FLEX' ? null : 6,
    };
  }),
  get('/api/v1/user/teams/:teamId/members', ({ params }) => {
    const team = teamOr404(params.teamId);
    const items = TEAM_MEMBERS[team.id] ?? [];
    return { items, count: items.length, limit: team.plan === 'FLEX' ? null : 6 };
  }),
  get('/api/v1/user/teams/:teamId/invite-links', ({ params }) => ({
    items: inviteLinks[Number(params.teamId)] ?? [],
  })),
  post('/api/v1/user/teams/:teamId/invite-links', ({ params }) => {
    const link: InviteLink = {
      id: newId(),
      code: `mock-${newId()}`,
      expiresAt: daysFromNow(7),
      createdBy: '한서준',
    };
    (inviteLinks[Number(params.teamId)] ??= []).push(link);
    return link;
  }),
  del('/api/v1/user/teams/:teamId/invite-links/:linkId', ({ params }) => {
    const list = inviteLinks[Number(params.teamId)];
    if (list)
      inviteLinks[Number(params.teamId)] = list.filter((l) => l.id !== Number(params.linkId));
    return undefined;
  }),
  post('/api/v1/user/teams/:teamId/members/:userId/github-invitation', ({ params }) => {
    // Only the GitHub org owner may send it; the daily limit comes back as an error
    if (params.userId === '5')
      fail(429, 'GITHUB_INVITE_LIMIT', '오늘은 GitHub 초대를 더 보낼 수 없어요');
    return { sent: true };
  }),
  post('/api/v1/user/teams/:teamId/repos', ({ params, body }) => {
    const team = teamOr404(params.teamId);
    const repo = {
      id: Number(body.repoId ?? newId()),
      name: String(body.name ?? 'new-repo'),
      fullName: `${team.orgLogin}/${String(body.name ?? 'new-repo')}`,
      private: false,
    };
    team.repos.push(repo);
    return repo;
  }),
  del('/api/v1/user/teams/:teamId/repos/:repoId', ({ params }) => {
    const team = teamOr404(params.teamId);
    team.repos = team.repos.filter((repo) => repo.id !== Number(params.repoId));
    return undefined;
  }),

  // 2nd pass
  patch('/api/v1/user/teams/:teamId', ({ params, body }) => {
    const team = teamOr404(params.teamId);
    Object.assign(team, {
      name: body.name ?? team.name,
      description: body.description ?? team.description,
    });
    return team;
  }),
  patch('/api/v1/user/teams/:teamId/members/:userId/role', ({ params, body }) => {
    const member = TEAM_MEMBERS[Number(params.teamId)]?.find(
      (m) => m.user.id === Number(params.userId),
    );
    if (member) member.role = body.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    return undefined;
  }),
  del('/api/v1/user/teams/:teamId/members/me', ({ params }) => {
    const team = teamOr404(params.teamId);
    if (team.myRole === 'OWNER')
      fail(409, 'OWNER_CANNOT_LEAVE', '오너는 먼저 소유권을 넘겨 주세요');
    return undefined;
  }),
  del('/api/v1/user/teams/:teamId/members/:userId', ({ params }) => {
    const list = TEAM_MEMBERS[Number(params.teamId)];
    if (list)
      TEAM_MEMBERS[Number(params.teamId)] = list.filter((m) => m.user.id !== Number(params.userId));
    return undefined;
  }),
  post('/api/v1/user/teams/:teamId/ownership-transfers', () => ({ transferId: newId() })),
  post('/api/v1/user/teams/:teamId/ownership-transfers/:transferId/accept', () => undefined),
  post('/api/v1/user/teams/:teamId/completion', ({ params }) => {
    const team = teamOr404(params.teamId);
    team.status = 'COMPLETED';
    team.completedAt = new Date().toISOString();
    return undefined;
  }),
  del('/api/v1/user/teams/:teamId/completion', ({ params }) => {
    const team = teamOr404(params.teamId);
    team.status = 'ACTIVE';
    team.completedAt = null;
    return undefined;
  }),
  post('/api/v1/user/teams/:teamId/archive', ({ params }) => {
    teamOr404(params.teamId).status = 'ARCHIVED';
    return undefined;
  }),
  del('/api/v1/user/teams/:teamId', ({ params }) => {
    const index = TEAMS.findIndex((team) => team.id === Number(params.teamId));
    if (index >= 0) TEAMS.splice(index, 1);
    return undefined;
  }),
];
