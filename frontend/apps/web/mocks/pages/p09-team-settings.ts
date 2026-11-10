import { daysFromNow, del, fail, get, newId, patch, post, type MockRoute } from '../core/define';
import { findTeam, TEAM_MEMBERS, TEAMS } from '../fixtures/teams';
import { DEVELOPERS } from '../fixtures/users';
import { SUBSCRIPTION_PRICE } from '@/lib/policy';
import { routes as setupRoutes } from './p08-team-create';

/** 09 Team settings & members: `TeamController / GithubController` */

type InviteLink = { id: number; code: string; expiresAt: string; createdBy: string };
const githubInvited = new Set<string>();
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
    transferOwnership: false,
    completeProject: false,
    archive: owner,
    deleteTeam: owner,
    leave: role === 'MEMBER',
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
      repos: team.repos.map((repo) => ({ ...repo, githubRepoId: repo.id })),
      board: {
        id: 'board-1',
        name: 'Linker',
        url: `https://github.com/orgs/${team.orgLogin}/projects/1`,
      },
      aiSummaryEnabled: team.plan === 'FLEX',
      completedAt: team.completedAt,
      // Free teams: 6 members (POL-T-1)
      memberLimit: team.plan === 'FLEX' ? null : 6,
      availableRepos: [
        ...team.repos,
        { id: 990 + team.id, name: 'docs', fullName: `${team.orgLogin}/docs`, private: false },
      ],
      githubOrgOwner: team.myRole === 'OWNER',
      githubInvitationBlockedReason: null,
      billing: {
        managerName: '한서준',
        canManage: team.myRole === 'OWNER',
        nextAmount:
          team.plan === 'FLEX'
            ? SUBSCRIPTION_PRICE.flexMonthly +
              Math.max(
                0,
                (TEAM_MEMBERS[team.id]?.length ?? 0) - SUBSCRIPTION_PRICE.flexIncludedSeats,
              ) *
                SUBSCRIPTION_PRICE.flexExtraMember
            : null,
        nextBillingAt: team.plan === 'FLEX' ? daysFromNow(15) : null,
      },
      ownershipTransfer:
        team.id === 2 ? { id: 1, fromName: '이도윤', toName: '한서준', isRecipient: true } : null,
      ownershipClaim: null,
      completion: {
        canUndo: false,
        finalized: team.status === 'COMPLETED',
        canRestart: team.status === 'COMPLETED',
      },
    };
  }),
  get('/api/v1/user/teams/:teamId/members', ({ params }) => {
    const team = teamOr404(params.teamId);
    const items = TEAM_MEMBERS[team.id] ?? [];
    return {
      items: items.map((member) => ({
        userId: member.user.id,
        handle: member.user.login,
        githubLogin: member.user.login,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.joinedAt,
        githubOrgStatus: member.inGithubOrg
          ? 'MEMBER'
          : githubInvited.has(`${team.id}:${member.user.id}`)
            ? 'INVITED'
            : 'NOT_MEMBER',
      })),
      count: items.length,
      limit: team.plan === 'FLEX' ? null : 6,
    };
  }),
  get('/api/v1/user/teams/:teamId/invite-links', ({ params }) => ({
    items: (inviteLinks[Number(params.teamId)] ?? []).map(({ id, expiresAt, createdBy }) => ({
      id,
      expiresAt,
      createdBy,
    })),
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
  post('/api/v1/user/teams/:teamId/invite-links/:linkId/notify', ({ params, body }) => {
    const team = teamOr404(params.teamId);
    if (team.myRole === 'MEMBER') fail(403, 'TEAM_ROLE_REQUIRED', '팀 권한이 필요해요');
    const link = inviteLinks[team.id]?.find(
      (link) => link.id === Number(params.linkId) && link.code === body.code,
    );
    if (!link) fail(404, 'NOT_FOUND', '초대 정보를 찾을 수 없어요');
    if (new Date(link.expiresAt).getTime() <= Date.now())
      fail(410, 'INVITE_INVALID', '더 이상 쓸 수 없는 초대 링크예요');
    const handle = String(body.handle ?? '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase();
    const target = DEVELOPERS.find((user) => user.login.toLowerCase() === handle);
    if (!target) fail(404, 'NOT_FOUND', '초대할 개발자를 찾을 수 없어요');
    if (TEAM_MEMBERS[team.id]?.some((member) => member.user.id === target.id))
      fail(409, 'ALREADY_MEMBER', '이미 함께하는 팀이에요');
    return undefined;
  }),
  del('/api/v1/user/teams/:teamId/invite-links/:linkId', ({ params }) => {
    const list = inviteLinks[Number(params.teamId)];
    if (list)
      inviteLinks[Number(params.teamId)] = list.filter((l) => l.id !== Number(params.linkId));
    return undefined;
  }),
  post('/api/v1/user/teams/:teamId/members/:userId/github-invitation', ({ params }) => {
    const team = teamOr404(params.teamId);
    if (team.myRole !== 'OWNER') fail(403, 'TEAM_ROLE_REQUIRED', '팀 오너만 사용할 수 있어요');
    const member = TEAM_MEMBERS[team.id]?.find(
      (member) => member.user.id === Number(params.userId),
    );
    if (!member) fail(404, 'NOT_FOUND', '현재 팀원을 찾을 수 없어요');
    if (member.inGithubOrg) return { sent: false, status: 'MEMBER' };
    if (params.userId === '5')
      fail(429, 'GITHUB_INVITE_LIMIT', '오늘은 GitHub 초대를 더 보낼 수 없어요');
    githubInvited.add(`${team.id}:${member.user.id}`);
    return { sent: true, status: 'PENDING' };
  }),
  post('/api/v1/user/teams/:teamId/repos', (context) => {
    const team = teamOr404(context.params.teamId);
    // Reuse the setup mock's installed-repository list, just as the UI reuses that endpoint.
    const list = setupRoutes.find(
      (route) => route.method === 'GET' && route.path === '/api/v1/user/teams/:teamId/setup/repos',
    )!;
    const { items } = list.handle(context) as { items: typeof team.repos };
    const repo = items.find((item) => item.id === Number(context.body.repoId));
    if (!repo) fail(403, 'FORBIDDEN', 'App 접근이 허용된 저장소만 연결할 수 있어요');
    if (!team.repos.some((item) => item.id === repo.id)) team.repos.push({ ...repo });
    return undefined;
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
  del('/api/v1/user/teams/:teamId', ({ params, body }) => {
    if (body.confirmName !== teamOr404(params.teamId).name)
      fail(400, 'VALIDATION_ERROR', '팀 이름을 정확히 입력해 주세요');
    const index = TEAMS.findIndex((team) => team.id === Number(params.teamId));
    if (index >= 0) TEAMS.splice(index, 1);
    return undefined;
  }),
];
