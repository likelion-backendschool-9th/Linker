import { fail, post, type MockRoute } from '../core/define';

/**
 * 31 Recruiter sign-up: `RecruiterSignupController`. Email code is always `123456`.
 * Try `someone@gmail.com` (free domain) and `taken@nextlab.example` (already registered).
 */

const FREE_DOMAINS = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'kakao.com',
  'hanmail.net',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
];
const CODE = '123456';

export const routes: MockRoute[] = [
  post('/api/v1/public/recruiter-signup/email-codes', ({ body }) => {
    const email = String(body.email ?? '').toLowerCase();
    const domain = email.split('@')[1] ?? '';
    if (!domain) fail(400, 'INVALID_EMAIL', '이메일 형식이 맞지 않아요');
    if (FREE_DOMAINS.includes(domain)) {
      fail(400, 'FREE_EMAIL_DOMAIN', '회사 메일로만 가입할 수 있어요. 개인 메일은 쓸 수 없어요.');
    }
    if (email === 'taken@nextlab.example') {
      fail(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요');
    }
    return { sent: true, resendAfterSeconds: 60, validMinutes: 10 };
  }),
  post('/api/v1/public/recruiter-signup/email-codes/verify', ({ body }) => {
    if (String(body.code) !== CODE) {
      fail(400, 'CODE_MISMATCH', '인증 코드가 맞지 않아요', { remainingAttempts: 4 });
    }
    return {
      signupToken: 'mock-signup-token',
      emailDomain: String(body.email ?? '').split('@')[1] ?? '',
    };
  }),
  post('/api/v1/public/recruiter-signup', ({ body, setMockRole }) => {
    if (body.signupToken !== 'mock-signup-token')
      fail(400, 'TOKEN_INVALID', '이메일 인증을 다시 해 주세요');
    const password = String(body.password ?? '');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      fail(400, 'PASSWORD_WEAK', '비밀번호는 8자 이상, 영문과 숫자를 포함해야 해요');
    }
    setMockRole('recruiter');
    return { login: 'r-1001' };
  }),
];
