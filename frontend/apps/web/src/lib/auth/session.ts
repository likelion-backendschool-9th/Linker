import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';

import { SESSION_COOKIE } from './read-role';
import { GUEST, type UserStatus, type Viewer } from './route-access';

/**
 * `GET /api/v1/user/me` (09 WBS 00, AuthSessionController).
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
  const role =
    session.userType === 'RECRUITER' ? 'recruiter' : session.isAdmin ? 'operator' : 'developer';
  return { role, onboarded: session.onboarded, status: session.status };
}
