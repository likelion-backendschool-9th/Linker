import { ApiError } from '@/lib/api/api-error';
import { MOCK_ROLE_COOKIE, parseMockRole, type MockRole } from '@/lib/auth/mock-viewer';

import { fail, type MockContext, type MockRoute, type ParamName } from './core/define';
import { buildViewer } from './core/viewer';
import { routes } from './routes';

/**
 * Stands in for Spring while mocks are on (blueprint §1-2). Called by `apiFetch` on the server and in
 * the browser. Server and browser keep separate in-memory state: a write made in the browser is
 * gone on the next full page load, and server renders never see it.
 */

const BROWSER_DELAY_MS = 150;

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

function setBrowserRole(role: MockRole) {
  if (typeof window === 'undefined') return;
  adminOtpLastActiveAt = null;
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
  if (entry.route.only === 'developer' && role === 'recruiter') {
    fail(403, 'DEVELOPER_ONLY', '개발자 계정만 쓸 수 있어요');
  }
}

export async function mockFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const parsed = new URL(url, 'http://mock.local');
  const method = (init.method ?? 'GET').toUpperCase();
  const entry = find(method, parsed.pathname);

  if (typeof window !== 'undefined') await new Promise((r) => setTimeout(r, BROWSER_DELAY_MS));

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

  const result = await entry.route.handle(ctx);
  // Callers must not mutate fixtures, and server → client props must be serializable
  return (result === undefined ? undefined : structuredClone(result)) as T;
}
