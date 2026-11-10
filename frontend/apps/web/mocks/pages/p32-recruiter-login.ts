import { fail, get, post, type MockRoute } from '../core/define';

/**
 * 32 Recruiter login & password reset: `AuthController`.
 * Login: `jihyun.song@nextlab.example` / `password1234`. Reset link token `valid-token` works; `expired-token` doesn't.
 */

let failedAttempts = 0;

export const routes: MockRoute[] = [
  post('/api/v1/public/recruiter-auth/login', ({ body, setMockRole }) => {
    if (failedAttempts >= 5) {
      fail(429, 'LOGIN_LOCKED', '비밀번호를 5번 틀려 10분 동안 로그인할 수 없어요', {
        lockMinutes: 10,
      });
    }
    if (body.email !== 'jihyun.song@nextlab.example' || body.password !== 'password1234') {
      failedAttempts += 1;
      fail(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 맞지 않아요', {
        remainingAttempts: 5 - failedAttempts,
      });
    }
    failedAttempts = 0;
    setMockRole('recruiter');
    return { restored: false, returnTo: String(body.returnTo ?? '/feed') };
  }),
  // Same answer whether or not the email is registered (POL ch. 3)
  post('/api/v1/public/recruiter-auth/password-reset-requests', () => ({ sent: true })),
  get('/api/v1/public/recruiter-auth/password-reset/:token', ({ params }) => ({
    valid: params.token === 'valid-token',
  })),
  post('/api/v1/public/recruiter-auth/password-reset', ({ body }) => {
    if (body.token !== 'valid-token')
      fail(410, 'TOKEN_EXPIRED', '링크가 만료됐어요. 다시 요청해 주세요');
    return undefined;
  }),
];
