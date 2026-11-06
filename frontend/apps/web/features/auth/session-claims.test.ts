import { accountClaimsMatch } from './session-claims';

const developer = {
  role: 'developer' as const,
  login: 'seojun-han',
  status: 'ACTIVE' as const,
  suspendedUntil: null,
};

describe('accountClaimsMatch', () => {
  it('matches a developer whose claims have not changed', () => {
    expect(
      accountClaimsMatch(developer, {
        userType: 'DEVELOPER',
        isAdmin: false,
        status: 'ACTIVE',
        suspendedUntil: null,
      }),
    ).toBe(true);
  });

  it('notices an operator assignment and a suspension change', () => {
    expect(
      accountClaimsMatch(developer, {
        userType: 'DEVELOPER',
        isAdmin: true,
        status: 'ACTIVE',
        suspendedUntil: null,
      }),
    ).toBe(false);
    expect(
      accountClaimsMatch(developer, {
        userType: 'DEVELOPER',
        isAdmin: false,
        status: 'SUSPENDED',
        suspendedUntil: '2026-12-01T00:00:00Z',
      }),
    ).toBe(false);
  });
});
