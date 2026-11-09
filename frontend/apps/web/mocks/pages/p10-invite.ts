import { fail, get, post, type MockRoute } from '../core/define';
import { TEAMS } from '../fixtures/teams';

/**
 * 10 Accept invite: `TeamController`.
 * Codes to try: `demo-valid` (default), `demo-expired`, `demo-revoked`, `demo-member` (already a member),
 * `demo-full` (member limit), `demo-limit` (10 teams).
 * GET may include team detail for clients that need ids; page 10 UI does not render a preview (POL-T-2).
 */

const team = TEAMS[1]!;

function status(code: string) {
  if (code === 'demo-expired') return 'EXPIRED' as const;
  if (code === 'demo-revoked') return 'REVOKED' as const;
  return 'VALID' as const;
}

function participation(code: string) {
  const states = {
    'demo-member': 'ALREADY_MEMBER',
    'demo-full': 'TEAM_MEMBER_LIMIT',
    'demo-limit': 'TEAM_COUNT_LIMIT',
    'demo-accepted': 'ACCEPTED',
    'demo-read-only': 'READ_ONLY',
    'demo-archived': 'ARCHIVED',
  } as const;
  return { state: states[code as keyof typeof states] ?? 'ELIGIBLE' };
}

export const routes: MockRoute[] = [
  get('/api/v1/public/invites/:code', ({ params }) => ({
    code: params.code,
    status: status(params.code),
    team: { id: team.id },
    participation: participation(params.code),
  })),
  post(
    '/api/v1/user/invites/:code/accept',
    ({ params }) => {
      if (params.code === 'demo-member') fail(409, 'ALREADY_MEMBER', '이미 함께하는 팀이에요');
      if (params.code === 'demo-full') fail(409, 'TEAM_MEMBER_LIMIT', '팀 인원이 가득 찼어요');
      if (params.code === 'demo-limit')
        fail(409, 'TEAM_COUNT_LIMIT', '팀은 10개까지 참여할 수 있어요');
      if (status(params.code) !== 'VALID')
        fail(410, 'INVITE_INVALID', '더 이상 쓸 수 없는 초대 링크예요');
      return { teamId: team.id, orgLogin: team.orgLogin, needsGithubInvite: true };
    },
    { only: 'developer' },
  ),
];
