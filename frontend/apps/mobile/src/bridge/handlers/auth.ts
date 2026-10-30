import * as WebBrowser from 'expo-web-browser';

import { AUTH_REDIRECT_URL } from '@/lib/config';
import { clearSession, saveSession } from '@/lib/secure-store';

import type { Handler } from '../context';
import { sendPushTokenIfGranted } from './push';

/** `linker://auth?code&state` → the web callback screen, which exchanges the code itself. */
export function authCallbackPath(url: string): string | null {
  if (!url.startsWith(AUTH_REDIRECT_URL)) return null;
  const query = url.split('?')[1];
  return query ? `/auth/callback?${query}` : null;
}

/** GitHub login in the system browser, back through the deep link (blueprint §12-3). */
export const authGithubStart: Handler<'AUTH_GITHUB_START'> = async (msg, ctx) => {
  const result = await WebBrowser.openAuthSessionAsync(msg.authorizeUrl, AUTH_REDIRECT_URL);
  const path = result.type === 'success' ? authCallbackPath(result.url) : null;
  if (!path) {
    ctx.send({ type: 'RESULT', id: msg.id, ok: false, error: 'cancelled' });
    return;
  }
  ctx.loadPath(path);
  ctx.send({ type: 'RESULT', id: msg.id, ok: true });
};

/** Login: keep the ids and hand the push token to the web again so it registers for this member. */
export const authSessionSave: Handler<'AUTH_SESSION_SAVE'> = async (msg, ctx) => {
  await saveSession(msg.session);
  await sendPushTokenIfGranted(ctx);
};

/** Logout: drop the ids and hand the web the token so the server deletes it (DELETE /push-tokens/{token}). */
export const authSessionClear: Handler<'AUTH_SESSION_CLEAR'> = async (_msg, ctx) => {
  await clearSession();
  await sendPushTokenIfGranted(ctx);
};
