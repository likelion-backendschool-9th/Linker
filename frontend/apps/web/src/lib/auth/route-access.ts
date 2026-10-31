/**
 * The one place that encodes 04 Policy ch. 2 "Access by role" (blueprint §4-2).
 * Read by `proxy.ts` (every request) and group layouts (`enforce-access.ts`). Spring does the real permission check.
 * When the policy changes, edit only this file. Static paths come before dynamic ones (`/posts/new` before `/posts/[id]`).
 */

export type Role = 'guest' | 'developer' | 'recruiter' | 'operator';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWING';

export type Viewer = {
  role: Role;
  /** `onb` claim; guests count as onboarded */
  onboarded: boolean;
  /** `st` claim; SUSPENDED isn't blocked here, only shown as a banner */
  status: UserStatus | null;
};

export const GUEST: Viewer = { role: 'guest', onboarded: true, status: null };

/** login = login-prompt sheet over /feed + returnTo · home = /feed · notFound = 404 */
export type Deny = 'login' | 'home' | 'notFound';
export type AccessResult = 'allow' | 'onboarding' | Deny;

type AccessRule = {
  page: string;
  match: RegExp;
  allow: readonly Role[] | 'all';
  deny?: Deny | Partial<Record<Role, Deny>>;
};

const MEMBERS = ['developer', 'recruiter', 'operator'] as const;
const DEVELOPERS = ['developer', 'operator'] as const;
/** 04 ch. 2: guests on a × URL get the login prompt; logged-in users go to the feed */
const DEVELOPERS_DENY = { guest: 'login', recruiter: 'home' } as const;

export const ROUTE_ACCESS: readonly AccessRule[] = [
  { page: '01', match: /^\/$/, allow: ['guest'], deny: 'home' },
  { page: '01', match: /^\/auth\/callback$/, allow: 'all' },
  { page: '02', match: /^\/onboarding$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '03', match: /^\/legal\/[^/]+$/, allow: 'all' },
  { page: '04', match: /^\/u\/[^/]+$/, allow: 'all' },
  { page: '05', match: /^\/settings\/profile$/, allow: MEMBERS, deny: 'login' },
  { page: '29', match: /^\/settings\/subscription$/, allow: MEMBERS, deny: 'login' },
  { page: '06', match: /^\/settings$/, allow: MEMBERS, deny: 'login' },
  { page: '07', match: /^\/workspace$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '08', match: /^\/teams\/new(\/callback)?$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '09', match: /^\/teams\/[^/]+\/settings$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '11', match: /^\/teams\/[^/]+\/issues$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '13', match: /^\/teams\/[^/]+\/issues\/new$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  {
    page: '12',
    match: /^\/teams\/[^/]+\/issues\/[^/]+$/,
    allow: DEVELOPERS,
    deny: DEVELOPERS_DENY,
  },
  { page: '14', match: /^\/teams\/[^/]+\/board$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '15', match: /^\/teams\/[^/]+\/calendar$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '10', match: /^\/invite\/[^/]+$/, allow: 'all' },
  { page: '16', match: /^\/chats$/, allow: MEMBERS, deny: 'login' },
  { page: '17', match: /^\/chats\/[^/]+$/, allow: MEMBERS, deny: 'login' },
  { page: '18', match: /^\/notifications$/, allow: MEMBERS, deny: 'login' },
  { page: '20', match: /^\/recruits\/new$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '20', match: /^\/recruits\/[^/]+\/edit$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '19', match: /^\/recruits$/, allow: 'all' },
  { page: '21', match: /^\/recruits\/[^/]+$/, allow: 'all' },
  { page: '22', match: /^\/posts\/new$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '22', match: /^\/posts\/[^/]+\/edit$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '23', match: /^\/posts\/[^/]+$/, allow: 'all' },
  { page: '24', match: /^\/feed$/, allow: 'all' },
  // 25–27: hidden from everyone but operators, guests included
  { page: '25', match: /^\/admin(\/.*)?$/, allow: ['operator'], deny: 'notFound' },
  { page: '28', match: /^\/subscribe(\/(success|fail))?$/, allow: MEMBERS, deny: 'login' },
  { page: '30', match: /^\/me\/stats$/, allow: DEVELOPERS, deny: DEVELOPERS_DENY },
  { page: '31', match: /^\/recruiter\/signup$/, allow: ['guest'], deny: 'home' },
  { page: '32', match: /^\/recruiter\/(login|reset)$/, allow: ['guest'], deny: 'home' },
  {
    page: '33',
    match: /^\/recruiter\/offers$/,
    allow: ['recruiter'],
    deny: { guest: 'login', developer: 'home', operator: 'home' },
  },
];

/** Paths an onboarding-incomplete developer may still open: (auth), /legal/*, /onboarding (blueprint §4-2) */
const ONBOARDING_EXEMPT =
  /^\/($|auth\/callback$|recruiter\/(signup|login|reset)$|legal\/|onboarding$)/;

export function findRule(pathname: string): AccessRule | undefined {
  return ROUTE_ACCESS.find((rule) => rule.match.test(pathname));
}

export function resolveAccess(pathname: string, viewer: Viewer): AccessResult {
  const rule = findRule(pathname);
  // Keep operations routes hidden even from developers who have not completed onboarding.
  if (rule && rule.allow !== 'all' && !rule.allow.includes(viewer.role)) {
    const deny = typeof rule.deny === 'string' ? rule.deny : rule.deny?.[viewer.role];
    return deny ?? (viewer.role === 'guest' ? 'login' : 'home');
  }

  // Recruiters have no onboarding (31 replaces it), so only developers are sent there
  const needsOnboarding =
    !viewer.onboarded && (viewer.role === 'developer' || viewer.role === 'operator');
  if (needsOnboarding && !ONBOARDING_EXEMPT.test(pathname)) return 'onboarding';

  // Unknown paths fall through to Next's own 404
  if (!rule || rule.allow === 'all' || rule.allow.includes(viewer.role)) return 'allow';

  const deny = typeof rule.deny === 'string' ? rule.deny : rule.deny?.[viewer.role];
  return deny ?? (viewer.role === 'guest' ? 'login' : 'home');
}
