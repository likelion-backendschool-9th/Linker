import { fail, get, newId, post, put, type MockRoute } from '../core/define';
import { TEAMS, TEAM_MEMBERS, findTeam } from '../fixtures/teams';
import { ME } from '../fixtures/users';

/** 08 Create team: `TeamController / GithubController` (5 steps: install → verify → repos → board → complete) */

const orgs = [
  { id: 501, login: 'my-new-org', avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=96' },
];
const createdByInstallation = new Map<string, number>();
const initialRepos = [
  { id: 901, name: 'backend', fullName: 'my-new-org/backend', private: false },
  { id: 902, name: 'frontend', fullName: 'my-new-org/frontend', private: false },
  { id: 903, name: 'bookstore', fullName: 'my-new-org/bookstore', private: true },
];

const initialBoards = ['ShowMoa', 'Linker', 'planit'].map((name, index) => ({
  id: `board-${index + 1}`,
  name,
  cardCount: index === 0 ? 18 : 0,
  statusColumns: ['Backlog', 'Doing', 'Blocked', 'Done'],
  statusOptions: [
    { id: 'opt-backlog', name: 'Backlog', color: 'GRAY' },
    { id: 'opt-doing', name: 'Doing', color: 'BLUE' },
    { id: 'opt-blocked', name: 'Blocked', color: 'RED' },
    { id: 'opt-done', name: 'Done', color: 'GREEN' },
  ],
}));
const savedBoards = new Map<number, { board: (typeof initialBoards)[number]; created: boolean }>();

function setupTeam(id: string) {
  const team = findTeam(id);
  if (!team) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  if (team.myRole !== 'OWNER') fail(403, 'FORBIDDEN', '팀 오너만 사용할 수 있어요');
  return team;
}

function availableRepos(id: string) {
  const team = findTeam(id);
  if (!team) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  if (team.myRole === 'MEMBER') fail(403, 'FORBIDDEN', '팀 관리자만 사용할 수 있어요');
  return team.orgLogin === orgs[0]!.login
    ? initialRepos
    : [
        ...team.repos,
        { id: 903, name: 'infra', fullName: `${team.orgLogin}/infra`, private: true },
      ];
}

export const routes: MockRoute[] = [
  get('/api/v1/user/team-setup/install-url', () => ({
    installUrl: '/teams/new/callback?installation_id=777&setup_action=install&state=mock',
    state: 'mock',
  })),
  // Trust nothing from the return URL: the server re-checks with the user's token (POL-T-1)
  post(
    '/api/v1/user/team-setup/installations/verify',
    ({ body }) => {
      if (body.state !== 'mock')
        fail(400, 'VALIDATION_ERROR', '설치 요청이 만료됐거나 올바르지 않아요. 다시 시작해 주세요');
      const installationId = String(body.installationId ?? '777');
      if (installationId === '0') return { result: 'REQUESTED_FROM_OWNER' as const };
      if (installationId === '1') {
        return { result: 'ALREADY_LINKED' as const, teamId: TEAMS[0]!.id };
      }
      return { result: 'INSTALLED' as const, org: orgs[0], installationId };
    },
    { only: 'developer' },
  ),
  post(
    '/api/v1/user/teams',
    ({ body }) => {
      if (body.installationId !== '777')
        fail(403, 'FORBIDDEN', 'GitHub App 설치 상태를 다시 확인해 주세요');
      const name = String(body.name ?? '').trim();
      if (!name || name.length > 255) fail(400, 'VALIDATION_ERROR', '팀 이름을 확인해 주세요');
      const existing = createdByInstallation.get('777');
      const previous = existing ? findTeam(String(existing)) : undefined;
      if (previous)
        return { id: previous.id, name: previous.name, chatRoomId: previous.chatRoomId };
      const id = newId();
      const chatRoomId = newId();
      const now = new Date().toISOString();
      TEAMS.push({
        id,
        name,
        description: String(body.description ?? ''),
        orgLogin: orgs[0]!.login,
        orgAvatarUrl: orgs[0]!.avatarUrl,
        status: 'ACTIVE',
        plan: 'FREE',
        myRole: 'OWNER',
        chatRoomId,
        repos: [],
        completedAt: null,
        createdAt: now,
      });
      // A new owner has no inferred PO/BE/FE label (page-09's pending mock extension).
      const owner = {
        user: ME,
        role: 'OWNER' as const,
        jobLabel: null,
        joinedAt: now,
        inGithubOrg: true,
      };
      TEAM_MEMBERS[id] = [owner];
      createdByInstallation.set('777', id);
      return { id, name, chatRoomId };
    },
    { only: 'developer' },
  ),
  get('/api/v1/user/teams/:teamId/setup/repos', ({ params }) => ({
    items: availableRepos(params.teamId),
    // As in Spring, installation-scoped listing cannot establish inaccessible repo counts.
    notInstalledCount: null,
    settingsUrl: `https://github.com/organizations/${findTeam(params.teamId)!.orgLogin}/settings/installations`,
  })),
  put('/api/v1/user/teams/:teamId/setup/repos', ({ params, body }) => {
    const allowed = availableRepos(params.teamId);
    const ids = body.repoIds;
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !allowed.some((repo) => repo.id === id))
    ) {
      fail(403, 'FORBIDDEN', 'App 접근이 허용된 저장소만 연결할 수 있어요');
    }
    setupTeam(params.teamId).repos = allowed.filter((repo) => ids.includes(repo.id));
    return undefined;
  }),
  get('/api/v1/user/teams/:teamId/setup/boards', ({ params }) => {
    const team = setupTeam(params.teamId);
    const linked = savedBoards.get(team.id);
    return { items: linked?.created ? [...initialBoards, linked.board] : initialBoards };
  }),
  post('/api/v1/user/teams/:teamId/setup/board', ({ params, body }) => {
    const team = setupTeam(params.teamId);
    const linked = savedBoards.get(team.id);
    if (body.mode === 'NEW') {
      if (linked && !linked.created)
        fail(409, 'STATE_CONFLICT', '기존에 연결한 보드를 선택해 주세요');
      if (linked) return { boardId: linked.board.id, name: linked.board.name };
      const board = {
        id: `board-new-${team.id}`,
        name: 'Linker',
        cardCount: 0,
        statusColumns: ['Todo', 'In Progress', 'Blocked', 'Done'],
        statusOptions: [
          { id: 'new-todo', name: 'Todo', color: 'GRAY' },
          { id: 'new-progress', name: 'In Progress', color: 'BLUE' },
          { id: 'new-blocked', name: 'Blocked', color: 'RED' },
          { id: 'new-done', name: 'Done', color: 'GREEN' },
        ],
      };
      savedBoards.set(team.id, { board, created: true });
      return { boardId: board.id, name: board.name };
    }
    const board = [...initialBoards, ...(linked ? [linked.board] : [])].find(
      (item) => item.id === body.boardId,
    );
    if (body.mode !== 'EXISTING' || !board) fail(400, 'VALIDATION_ERROR', '보드를 선택해 주세요');
    const mapping = body.statusMapping;
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping))
      fail(400, 'VALIDATION_ERROR', '상태 매핑이 필요해요');
    const statuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
    if (
      !statuses.every((status) => Object.values(mapping).includes(status)) ||
      Object.entries(mapping).some(
        ([id, status]) =>
          !board.statusOptions.some((option) => option.id === id) ||
          ![...statuses, 'OTHER'].includes(String(status)),
      )
    )
      fail(400, 'VALIDATION_ERROR', '네 가지 상태를 모두 연결해 주세요');
    savedBoards.set(team.id, {
      board,
      created: (linked?.created && linked.board.id === board.id) || false,
    });
    return { boardId: board.id, name: board.name };
  }),
  // The org's default repo permission; "read" shows the write-permission notice (POL-T-1)
  get('/api/v1/user/teams/:teamId/setup/permission-check', ({ params }) => ({
    basePermission: 'READ' as 'READ' | 'WRITE',
    settingsUrl: `https://github.com/organizations/${setupTeam(params.teamId).orgLogin}/settings/member_privileges`,
  })),
  post('/api/v1/user/teams/:teamId/setup/complete', ({ params }) => {
    const team = setupTeam(params.teamId);
    if (!team.repos.length || !savedBoards.has(team.id))
      fail(400, 'VALIDATION_ERROR', '저장소와 보드를 먼저 연결해 주세요');
    return { queued: true, state: 'QUEUED' as const, failedStep: null };
  }),
];
