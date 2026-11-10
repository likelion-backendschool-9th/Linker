import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';

import { viewerFromMember } from './jwt-claims';
import { SESSION_COOKIE } from './read-role';
import { GUEST, type UserStatus, type Viewer } from './route-access';

/**
 * `GET /api/v1/user/me` (WBS AuthController, `MeResponse`).
 * `isAdmin` is the admins-row flag. The report page asks for OTP before loading cases.
 * Hand-written until the controller is in OpenAPI; then replace with the orval type and function.
 */
export type Session = {
  userId: number;
  login: string;
  userType: 'DEVELOPER' | 'RECRUITER';
  isAdmin: boolean;
  status: UserStatus;
  onboarded: boolean;
  /** ISO date; null when not suspended or suspended permanently */
  suspendedUntil: string | null;
};

/** The member for this request, or null for guests. One API call per request (React `cache()`). */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;
  try {
    return await apiFetch<Session>('/api/v1/user/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export function viewerFromSession(session: Session | null): Viewer {
  if (!session) return GUEST;
  return viewerFromMember({
    userType: session.userType,
    isAdmin: session.isAdmin,
    onboarded: session.onboarded,
    status: session.status,
  });
}
