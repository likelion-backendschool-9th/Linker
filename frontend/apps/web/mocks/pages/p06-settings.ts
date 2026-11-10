import { fail, get, patch, post, type MockRoute } from '../core/define';
import { TEAMS } from '../fixtures/teams';
import { ME, RECRUITER } from '../fixtures/users';

/** 06 Settings: `AccountController / AuthController / NotificationController` */

const settings = { pushEnabled: true, notificationEmail: 'sjsk6849@naver.com' };

export const routes: MockRoute[] = [
  get('/api/v1/user/me/settings', ({ viewer }) => {
    const recruiter = viewer.role === 'recruiter';
    return {
      // Recruiters have no GitHub link (04 ch. 3)
      github: recruiter ? null : { login: ME.login, connected: true },
      notificationEmail: recruiter ? RECRUITER.email : settings.notificationEmail,
      pushEnabled: settings.pushEnabled,
      plan: recruiter
        ? { name: 'FREE', label: '무료', kind: 'SCOUT' }
        : { name: 'FLEX', label: 'Flex 5/6명', kind: 'FLEX' },
    };
  }),
  patch('/api/v1/user/me/settings/notifications', ({ body }) => {
    settings.pushEnabled = Boolean(body.pushEnabled);
    return settings;
  }),
  patch('/api/v1/user/me/email', ({ body }) => {
    settings.notificationEmail = String(body.email ?? settings.notificationEmail);
    return settings;
  }),
  post('/api/v1/user/auth/logout', ({ setMockRole }) => {
    setMockRole('guest');
    return undefined;
  }),
  // Teams I own must be transferred or deleted before withdrawing (04 ch. 3)
  get('/api/v1/user/me/withdrawal-check', ({ viewer }) => ({
    ownedTeams:
      viewer.role === 'recruiter'
        ? []
        : TEAMS.filter((team) => team.myRole === 'OWNER').map(({ id, name }) => ({ id, name })),
  })),
  post('/api/v1/user/me/withdrawal', ({ viewer, setMockRole }) => {
    if (viewer.role !== 'recruiter' && TEAMS.some((team) => team.myRole === 'OWNER')) {
      fail(409, 'OWNED_TEAMS_EXIST', '오너인 팀을 먼저 넘기거나 삭제해 주세요');
    }
    setMockRole('guest');
    return { deletesOn: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) };
  }),
  patch('/api/v1/recruiter/me/password', ({ body }) => {
    if (String(body.currentPassword) !== 'password1234') {
      fail(400, 'INVALID_PASSWORD', '현재 비밀번호가 맞지 않아요');
    }
    return undefined;
  }),
];
