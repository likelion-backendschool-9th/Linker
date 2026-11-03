import type { ClientViewer } from '@/lib/auth/viewer-context';
import type { UserStatus } from '@/lib/auth/route-access';

/** Fields from `GET /api/v1/user/me` that change which screens the viewer may open. */
export type AccountClaims = {
  userType: 'DEVELOPER' | 'RECRUITER';
  isAdmin: boolean;
  status: UserStatus;
  suspendedUntil: string | null;
};

/** True when the layout's viewer already matches the latest `/me` claims. */
export function accountClaimsMatch(viewer: ClientViewer, claims: AccountClaims): boolean {
  const role =
    claims.userType === 'RECRUITER' ? 'recruiter' : claims.isAdmin ? 'operator' : 'developer';
  return (
    viewer.role === role &&
    viewer.status === claims.status &&
    viewer.suspendedUntil === claims.suspendedUntil
  );
}
