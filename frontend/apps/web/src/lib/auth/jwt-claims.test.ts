import { CLAIM_REISSUE, JWT_CLAIM, MEMBER_TYPES, ROUTING_STATUSES, viewerFromJwtClaims } from './jwt-claims';
import type { UserStatus } from './route-access';

describe('JWT claim contract', () => {
  it('keeps the blueprint claim names', () => {
    expect(JWT_CLAIM).toEqual({
      subject: 'sub',
      memberType: 'typ',
      operator: 'adm',
      onboarded: 'onb',
      status: 'st',
    });
    expect(MEMBER_TYPES).toEqual(['DEVELOPER', 'RECRUITER']);
  });

  it('routes only ACTIVE, SUSPENDED, and WITHDRAWING', () => {
    const statuses: Record<UserStatus, true> = {
      ACTIVE: true,
      SUSPENDED: true,
      WITHDRAWING: true,
    };
    expect(Object.keys(statuses).sort()).toEqual([...ROUTING_STATUSES].sort());
  });

  it('names the moments that reissue the cookie', () => {
    expect(CLAIM_REISSUE).toEqual([
      'onboarding-complete',
      'suspended',
      'unsuspended',
      'operator-assigned',
    ]);
  });

  it('maps recruiter, operator, and developer the same way as /me', () => {
    expect(viewerFromJwtClaims({ typ: 'RECRUITER', adm: true })).toMatchObject({
      role: 'recruiter',
      onboarded: true,
      status: 'ACTIVE',
    });
    expect(viewerFromJwtClaims({ typ: 'DEVELOPER', adm: true, onb: true })).toMatchObject({
      role: 'operator',
    });
    expect(
      viewerFromJwtClaims({ typ: 'DEVELOPER', adm: false, onb: false, st: 'SUSPENDED' }),
    ).toEqual({ role: 'developer', onboarded: false, status: 'SUSPENDED' });
  });
});
