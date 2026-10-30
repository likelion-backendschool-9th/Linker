import { fail, get, newId, post, put, type MockRoute } from '../core/define';
import { TEAMS } from '../fixtures/teams';

/** 08 Create team: `TeamCreateController` (5 steps: install → verify → repos → board → complete) */

const orgs = [
  { id: 501, login: 'my-new-org', avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=96' },
];

export const routes: MockRoute[] = [
  get('/api/v1/user/team-setup/install-url', () => ({
    installUrl: '/teams/new/callback?installation_id=777&setup_action=install&state=mock',
    state: 'mock',
  })),
  // Trust nothing from the return URL: the server re-checks with the user's token (POL-T-1)
  post(
    '/api/v1/user/team-setup/installations/verify',
    ({ body }) => {
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
    ({ body }) => ({
      id: newId(),
      name: String(body.name ?? '새 팀'),
      chatRoomId: newId(),
    }),
    { only: 'developer' },
  ),
  get('/api/v1/user/teams/:teamId/setup/repos', () => ({
    items: [
      { id: 901, name: 'web', fullName: 'my-new-org/web', private: false },
      { id: 902, name: 'api', fullName: 'my-new-org/api', private: false },
      { id: 903, name: 'infra', fullName: 'my-new-org/infra', private: true },
    ],
    // Repos the app wasn't installed on: link to grant access on GitHub
    notInstalledCount: 1,
  })),
  put('/api/v1/user/teams/:teamId/setup/repos', () => undefined),
  get('/api/v1/user/teams/:teamId/setup/boards', () => ({
    items: [
      {
        id: 'board-1',
        name: '로드맵',
        cardCount: 18,
        statusColumns: ['Backlog', 'Doing', 'Review', 'Done'],
      },
    ],
  })),
  post('/api/v1/user/teams/:teamId/setup/board', ({ body }) => {
    if (body.mode === 'EXISTING' && !body.statusMapping) {
      fail(400, 'STATUS_MAPPING_REQUIRED', '상태 매핑이 필요해요');
    }
    return { boardId: 'board-new', name: 'Linker' };
  }),
  // The org's default repo permission; "read" shows the write-permission notice (POL-T-1)
  get('/api/v1/user/teams/:teamId/setup/permission-check', () => ({
    basePermission: 'READ' as 'READ' | 'WRITE',
    settingsUrl: 'https://github.com/organizations/my-new-org/settings/member_privileges',
  })),
  post('/api/v1/user/teams/:teamId/setup/complete', () => ({ queued: true })),
];
