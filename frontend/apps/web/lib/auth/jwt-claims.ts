import { type UserStatus, type Viewer } from './route-access';

/**
 * Screen-routing claims (blueprint ch. 15). The server still decides permissions.
 * The live cookie is an opaque `linker_session` until a signed JWT is issued.
 * Reissue that cookie on onboarding completion, suspension, unsuspension, and operator assignment.
 * The value stays in an httpOnly cookie. The native bridge receives only userId and userType.
 */
export const JWT_CLAIM = {
  subject: 'sub',
  memberType: 'typ',
  operator: 'adm',
  onboarded: 'onb',
  status: 'st',
} as const;

export const MEMBER_TYPES = ['DEVELOPER', 'RECRUITER'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

/** `st` values the proxy branches on. A deleted member has no session. */
export const ROUTING_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'WITHDRAWING',
] as const satisfies readonly UserStatus[];

export const CLAIM_REISSUE = [
  'onboarding-complete',
  'suspended',
  'unsuspended',
  'operator-assigned',
] as const;

export type JwtClaims = {
  typ?: MemberType;
  adm?: boolean;
  onb?: boolean;
  st?: UserStatus;
};

type MemberFlags = {
  userType: MemberType;
  isAdmin: boolean;
  onboarded: boolean;
  status: UserStatus;
};

/** Same role rule for a verified JWT and for `GET /api/v1/user/me`. */
export function viewerFromMember(member: MemberFlags): Viewer {
  const role =
    member.userType === 'RECRUITER' ? 'recruiter' : member.isAdmin ? 'operator' : 'developer';
  return { role, onboarded: member.onboarded, status: member.status };
}

/** Missing `onb` counts as finished. Missing `st` counts as active. `typ` other than recruiter is a developer. */
export function viewerFromJwtClaims(claims: JwtClaims): Viewer {
  return viewerFromMember({
    userType: claims.typ === 'RECRUITER' ? 'RECRUITER' : 'DEVELOPER',
    isAdmin: claims.adm === true,
    onboarded: claims.onb ?? true,
    status: claims.st ?? 'ACTIVE',
  });
}
