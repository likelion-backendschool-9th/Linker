import { ApiError } from '@/lib/api/api-error';
import { MOCK_ROLE_COOKIE, parseMockRole, type MockRole } from '@/lib/auth/mock-viewer';
import { ADMIN } from '@/lib/policy';

import { fail, type MockContext, type MockRoute, type ParamName } from './core/define';
import { buildViewer } from './core/viewer';
import { persistCreatedIssues, syncCreatedIssues } from './fixtures/issues';
import { persistCreatedRecruiterRooms, syncCreatedRecruiterRooms } from './fixtures/recruiter-rooms';
import { routes } from './routes';

/**
 * Stands in for Spring while mocks are on (blueprint §1-2). Called by `apiFetch` on the server and in
 * the browser. Most fixtures stay process-local; created issues sync via cookie (see `syncCreatedIssues`).
 */

const BROWSER_DELAY_MS = 150;
/** Dev only: `localStorage.setItem('linker_mock_delay_ms', '12000')` slows every mock response, e.g. to
 *  see the 10 s timeout screen. Remove the key to go back to normal. */
function browserDelayMs() {
  try {
    const custom = Number(window.localStorage.getItem('linker_mock_delay_ms'));
    return Number.isFinite(custom) && custom > 0 ? custom : BROWSER_DELAY_MS;
  } catch {
    return BROWSER_DELAY_MS;
  }
}
const ADMIN_OTP_IDLE_MS = ADMIN.otpIdleMinutes * 60 * 1000;
let adminOtpLastActiveAt: number | null = null;
let adminOtpRole: MockRole | null = null;

type Compiled = { route: MockRoute; regex: RegExp; paramNames: string[]; dynamic: number };

const compiled: Compiled[] = routes.map((route) => {
  const paramNames: string[] = [];
  const pattern = route.path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      paramNames.push(segment.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { route, regex: new RegExp(`^${pattern}$`), paramNames, dynamic: paramNames.length };
});

function find(method: string, pathname: string) {
  // Static segments beat `:param` ones, so `/issues/new` never lands on `/issues/:issueId`
  return compiled
    .filter((entry) => entry.route.method === method && entry.regex.test(pathname))
    .sort((a, b) => a.dynamic - b.dynamic)[0];
}

async function readRoleCookie(): Promise<MockRole> {
  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');
    return parseMockRole((await cookies()).get(MOCK_ROLE_COOKIE)?.value);
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${MOCK_ROLE_COOKIE}=([^;]*)`));
  return parseMockRole(match?.[1]);
}

function resetAdminOtp(role: MockRole | null) {
  adminOtpLastActiveAt = null;
  adminOtpRole = role;
}

function setBrowserRole(role: MockRole) {
  if (typeof window === 'undefined') return;
  resetAdminOtp(role);
  if (role === 'guest') document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
  else document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/; samesite=lax`;
}

/** Permission by URL prefix, like the real API (WBS §1-2) */
function authorize(entry: Compiled, ctx: MockContext) {
  const { role, me } = ctx.viewer;
  const path = entry.route.path;
  if (
    path.startsWith('/api/v1/user/') ||
    path.startsWith('/api/v1/recruiter/') ||
    path.startsWith('/api/v1/admin/')
  ) {
    if (!me) fail(401, 'LOGIN_REQUIRED', '로그인이 필요해요');
  }
  if (path.startsWith('/api/v1/recruiter/') && role !== 'recruiter') {
    fail(403, 'FORBIDDEN', '채용 담당자만 쓸 수 있어요');
  }
  if (path.startsWith('/api/v1/admin/') && role !== 'operator') {
    fail(403, 'FORBIDDEN', '운영자만 쓸 수 있어요');
  }
  if (adminOtpRole !== role) resetAdminOtp(role);
  if (path.startsWith('/api/v1/admin/') && path !== '/api/v1/admin/otp/verify') {
    const now = Date.now();
    if (adminOtpLastActiveAt === null || now - adminOtpLastActiveAt >= ADMIN_OTP_IDLE_MS) {
      adminOtpLastActiveAt = null;
      fail(403, 'OTP_REQUIRED', '운영자 OTP 인증이 필요해요');
    }
    adminOtpLastActiveAt = now;
  }
  if (entry.route.only === 'developer' && role === 'recruiter') {
    fail(403, 'DEVELOPER_ONLY', '개발자 계정만 쓸 수 있어요');
  }
}

function otpVerified(result: unknown): boolean {
  return typeof result === 'object' && result !== null && 'verified' in result && result.verified === true;
}

export async function mockFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const parsed = new URL(url, 'http://mock.local');
  const method = (init.method ?? 'GET').toUpperCase();
  const entry = find(method, parsed.pathname);

  if (typeof window !== 'undefined') await new Promise((r) => setTimeout(r, browserDelayMs()));

  if (!entry) {
    console.warn(`[mock] no mock for ${method} ${parsed.pathname}`);
    throw new ApiError(404, {
      code: 'MOCK_NOT_IMPLEMENTED',
      message: `목업이 없는 API예요: ${method} ${parsed.pathname}`,
    });
  }

  const match = entry.regex.exec(parsed.pathname)!;
  const params = Object.fromEntries(
    entry.paramNames.map((name, index) => [name, decodeURIComponent(match[index + 1]!)]),
  ) as Record<ParamName, string>;
  let body: Record<string, unknown> = {};
  if (typeof init.body === 'string' && init.body) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const ctx: MockContext = {
    params,
    query: parsed.searchParams,
    body,
    viewer: buildViewer(init.credentials === 'omit' ? 'guest' : await readRoleCookie()),
    setMockRole: setBrowserRole,
  };
  authorize(entry, ctx);

  await syncCreatedIssues();
  await syncCreatedRecruiterRooms();
  const result = await entry.route.handle(ctx);
  persistCreatedIssues();
  persistCreatedRecruiterRooms();
  if (entry.route.path === '/api/v1/admin/otp/verify' && otpVerified(result)) {
    adminOtpLastActiveAt = Date.now();
  }
  // Callers must not mutate fixtures, and server → client props must be serializable
  return (result === undefined ? undefined : structuredClone(result)) as T;
}
