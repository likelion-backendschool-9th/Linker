import { importSPKI, jwtVerify } from 'jose';

import { USE_MOCKS } from '@/lib/mock-mode';

import { viewerFromJwtClaims, type JwtClaims } from './jwt-claims';
import { MOCK_ROLE_COOKIE, parseMockRole, viewerFromMockRole } from './mock-viewer';
import { GUEST, type Viewer } from './route-access';

/**
 * Reads who is calling from the session cookie (blueprint §4-1).
 * The live cookie from `SessionCookies` is an opaque secret, not a claim set. Role, onboarding and
 * suspension then come from `GET /api/v1/user/me` in the group layouts. A compact JWT is verified
 * with `typ`, `adm`, `onb` and `st` when `JWT_PUBLIC_KEY` is set. A bad signature is a guest.
 * Claims only route screens; Spring checks permissions.
 * With mocks on (blueprint §1-2) the cookie is the mock role instead of a session secret.
 */

export const SESSION_COOKIE = USE_MOCKS
  ? MOCK_ROLE_COOKIE
  : (process.env.SESSION_COOKIE_NAME ?? 'linker_session');
const PUBLIC_KEY_PEM = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
const ALGORITHM = process.env.JWT_ALGORITHM ?? 'RS256';

/** Compact JWS: three non-empty segments. The opaque `linker_session` value has none. */
export function isCompactJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export type CookieViewer = { kind: 'viewer'; viewer: Viewer } | { kind: 'opaque' };

let keyPromise: Promise<CryptoKey> | undefined;

function publicKey(): Promise<CryptoKey> | undefined {
  if (!PUBLIC_KEY_PEM) return undefined;
  keyPromise ??= importSPKI(PUBLIC_KEY_PEM, ALGORITHM);
  return keyPromise;
}

export async function readCookieViewer(token: string | undefined): Promise<CookieViewer> {
  if (USE_MOCKS) return { kind: 'viewer', viewer: viewerFromMockRole(parseMockRole(token)) };
  if (!token) return { kind: 'viewer', viewer: GUEST };
  // Opaque session (current AuthController). Layouts resolve the member with GET /me.
  const key = publicKey();
  if (!isCompactJwt(token) || !key) return { kind: 'opaque' };
  try {
    const { payload } = await jwtVerify<JwtClaims>(token, await key, {
      algorithms: [ALGORITHM],
    });
    return { kind: 'viewer', viewer: viewerFromJwtClaims(payload) };
  } catch {
    // Expired or tampered: treat as a guest; the API answers LOGIN_REQUIRED where it matters
    return { kind: 'viewer', viewer: GUEST };
  }
}
