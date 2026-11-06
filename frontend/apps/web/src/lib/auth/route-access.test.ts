import { findRule, GUEST, resolveAccess, type Role, type Viewer } from './route-access';

const as = (role: Role, onboarded = true): Viewer => ({
  role,
  onboarded,
  status: role === 'guest' ? null : 'ACTIVE',
});

describe('resolveAccess', () => {
  it.each([
    // [path, guest, developer, recruiter, operator]
    ['/', 'allow', 'home', 'home', 'home'],
    ['/auth/callback', 'allow', 'allow', 'allow', 'allow'],
    ['/feed', 'allow', 'allow', 'allow', 'allow'],
    ['/user/ada', 'allow', 'allow', 'allow', 'allow'],
    ['/posts/12', 'allow', 'allow', 'allow', 'allow'],
    ['/posts/new', 'login', 'allow', 'home', 'allow'],
    ['/posts/12/edit', 'login', 'allow', 'home', 'allow'],
    ['/recruits/new', 'login', 'allow', 'home', 'allow'],
    ['/workspace', 'login', 'allow', 'home', 'allow'],
    ['/workspace/issues', 'login', 'allow', 'home', 'allow'],
    ['/teams/3/issues/new', 'login', 'allow', 'home', 'allow'],
    ['/chats', 'login', 'allow', 'allow', 'allow'],
    ['/settings/subscription', 'login', 'allow', 'allow', 'allow'],
    ['/admin', 'notFound', 'notFound', 'notFound', 'allow'],
    ['/admin/reports', 'notFound', 'notFound', 'notFound', 'allow'],
    ['/recruiter/login', 'allow', 'home', 'home', 'home'],
    ['/recruiter/offers', 'login', 'home', 'allow', 'home'],
    ['/onboarding', 'login', 'allow', 'home', 'allow'],
  ] as const)('%s', (path, guest, developer, recruiter, operator) => {
    expect(resolveAccess(path, GUEST)).toBe(guest);
    expect(resolveAccess(path, as('developer'))).toBe(developer);
    expect(resolveAccess(path, as('recruiter'))).toBe(recruiter);
    expect(resolveAccess(path, as('operator'))).toBe(operator);
  });

  it('matches static paths before dynamic ones', () => {
    expect(findRule('/posts/new')?.page).toBe('22');
    expect(findRule('/recruits/new')?.page).toBe('20');
    expect(findRule('/teams/1/issues/new')?.page).toBe('13');
  });

  it('sends onboarding-incomplete developers to /onboarding except exempt paths', () => {
    const newcomer = as('developer', false);
    expect(resolveAccess('/feed', newcomer)).toBe('onboarding');
    expect(resolveAccess('/admin/reports', newcomer)).toBe('notFound');
    expect(resolveAccess('/legal/terms', newcomer)).toBe('allow');
    expect(resolveAccess('/onboarding', newcomer)).toBe('allow');
    expect(resolveAccess('/auth/callback', newcomer)).toBe('allow');
  });

  it('never sends recruiters to onboarding', () => {
    expect(resolveAccess('/feed', as('recruiter', false))).toBe('allow');
  });

  it('lets unknown paths through to the 404 page', () => {
    expect(resolveAccess('/nope', GUEST)).toBe('allow');
  });
});
