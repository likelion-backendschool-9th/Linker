import { importSPKI, jwtVerify } from 'jose';

import { GUEST, type Viewer } from './route-access';

/**
 * Reads the viewer from the session cookie's verified JWT claims (blueprint §4-1, ch. 15):
 * `typ` DEVELOPER | RECRUITER, `adm` operator, `onb` onboarding done, `st` status. No API call.
 * Missing key, cookie or a bad signature → guest. Claims only route screens; Spring checks permissions.
 */

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'linker_session';
const PUBLIC_KEY_PEM = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
const ALGORITHM = process.env.JWT_ALGORITHM ?? 'RS256';

let keyPromise: Promise<CryptoKey> | undefined;

function publicKey(): Promise<CryptoKey> | undefined {
  if (!PUBLIC_KEY_PEM) return undefined;
  keyPromise ??= importSPKI(PUBLIC_KEY_PEM, ALGORITHM);
  return keyPromise;
}

type SessionClaims = {
  typ?: 'DEVELOPER' | 'RECRUITER';
  adm?: boolean;
  onb?: boolean;
  st?: Viewer['status'];
};

export async function readViewerFromToken(token: string | undefined): Promise<Viewer> {
  const key = publicKey();
  if (!token || !key) return GUEST;
  try {
    const { payload } = await jwtVerify<SessionClaims>(token, await key, {
      algorithms: [ALGORITHM],
    });
    const role = payload.typ === 'RECRUITER' ? 'recruiter' : payload.adm ? 'operator' : 'developer';
    return { role, onboarded: payload.onb ?? true, status: payload.st ?? 'ACTIVE' };
  } catch {
    // Expired or tampered: treat as a guest; the API answers LOGIN_REQUIRED where it matters
    return GUEST;
  }
}
