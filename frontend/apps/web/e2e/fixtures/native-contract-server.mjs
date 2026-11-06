import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

// Test-only HTTP contract double. It does not implement GitHub OAuth or Expo delivery.
const origin = 'http://localhost:3137';
const states = new Map();
const sessions = new Map();
let calls = [];
let nativeReports = [];
let newUser = false;

createServer(async (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
    res.writeHead(403).end();
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  const url = new URL(req.url, origin);
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  let raw = '';
  for await (const part of req) raw += part;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === '/__test/reset') {
    calls = [];
    nativeReports = [];
    states.clear();
    sessions.clear();
    newUser = body.newUser ?? false;
    return send(204);
  }
  if (url.pathname === '/__test/calls') return send(200, calls);
  if (url.pathname === '/__test/native-reports') {
    if (req.method === 'POST') nativeReports.push(body);
    return send(200, nativeReports);
  }
  calls.push({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    hasCookie: Boolean(req.headers.cookie),
    body:
      url.pathname.endsWith('/callback') || url.pathname.endsWith('/push-tokens')
        ? { ...body }
        : undefined,
  });
  if (url.pathname === '/api/v1/public/auth/github/authorize-url') {
    const state = randomUUID();
    states.set(state, url.searchParams.get('returnTo') ?? '/workspace');
    return send(200, { authorizeUrl: `https://github.com/login?state=${state}`, state });
  }
  if (url.pathname === '/api/v1/public/auth/github/callback') {
    if (body.code !== 'contract-code' || !states.has(body.state)) {
      return send(401, {
        code: 'UNAUTHORIZED',
        message: '로그인을 완료하지 못했어요. 다시 시도해 주세요.',
      });
    }
    const returnTo = states.get(body.state);
    states.delete(body.state);
    const token = `contract-opaque-${randomUUID()}`;
    sessions.set(token, {
      userId: 701,
      login: 'bridge-contract',
      userType: 'DEVELOPER',
      isAdmin: false,
      status: 'ACTIVE',
      onboarded: !newUser,
      suspendedUntil: null,
    });
    res.setHeader(
      'Set-Cookie',
      `linker_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    );
    return send(200, { isNew: newUser, restored: false, returnTo });
  }
  const token = /(?:^|;\s*)linker_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  const me = sessions.get(token);
  if (url.pathname === '/api/v1/user/me') {
    return me ? send(200, me) : send(401, { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' });
  }
  if (url.pathname === '/api/v1/user/me/settings') {
    return me
      ? send(200, {
          github: { login: me.login, connected: true },
          notificationEmail: 'native-contract@example.test',
          pushEnabled: true,
          plan: { name: 'FREE', label: '무료', kind: 'PRO' },
        })
      : send(401, { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' });
  }
  if (url.pathname === '/api/v1/user/auth/logout' && req.method === 'POST') {
    sessions.delete(token);
    res.setHeader('Set-Cookie', 'linker_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return send(204);
  }
  if (url.pathname === '/api/v1/user/me/teams') {
    return send(200, { items: [], teamLimit: 10, teamCount: 0 });
  }
  if (url.pathname === '/api/v1/user/me/issues') return send(200, { items: [] });
  if (url.pathname === '/api/v1/user/onboarding') {
    return send(200, {
      done: false,
      step: 'AGREEMENTS',
      defaults: {
        name: '브리지 검증',
        bio: '',
        blogUrl: '',
        techStack: [],
        lookingForTeam: false,
        jobStatus: 'OFF',
      },
      emailRequired: false,
      termsVersion: '2026-10-01',
    });
  }
  if (url.pathname === '/api/v1/user/notifications/unread-count') return send(200, { count: 0 });
  if (
    url.pathname === '/api/v1/user/push-tokens' ||
    url.pathname.startsWith('/api/v1/user/push-tokens/')
  ) {
    return me ? send(204) : send(401, { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' });
  }
  if (url.pathname === '/api/v1/public/tech-tags') return send(200, []);
  if (url.pathname === '/api/v1/public/job-categories') return send(200, []);
  if (url.pathname.startsWith('/api/v1/public/sitemap/')) {
    const kind = url.pathname.split('/').at(-1);
    const page = Number(url.searchParams.get('page') ?? 1);
    const paths = { users: '/users/bridge-contract', posts: '/posts/701', recruits: '/recruits/701' };
    if (!(kind in paths)) return send(400, { code: 'VALIDATION_ERROR' });
    return send(200, {
      kind,
      page,
      items: page === 1 ? [{ id: 701, url: paths[kind], updatedAt: '2026-11-03T00:00:00Z' }] : [],
    });
  }
  if (url.pathname === '/health') return send(200, { ok: true });
  return send(404, { code: 'NOT_FOUND', message: '대상을 찾을 수 없어요' });
}).listen(Number(process.env.LINKER_CONTRACT_API_PORT ?? 4188), () =>
  console.log('Native contract fixture ready'),
);
