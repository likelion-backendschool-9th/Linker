import { apiFetch } from '@/lib/api/api-fetch';

/** Last Expo token seen in this tab; used to DELETE on logout (WBS 18). */
let currentToken: string | null = null;

export function getRegisteredPushToken(): string | null {
  return currentToken;
}

/** Android-only MVP. Remembers the token so logout can delete it. */
export async function registerPushToken(token: string, platform: 'ios' | 'android') {
  if (platform !== 'android' || !token) return;
  await apiFetch('/api/v1/user/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
  currentToken = token;
}

/** Best-effort delete; clears the remembered token even if the request fails. */
export async function unregisterPushToken() {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await apiFetch(`/api/v1/user/push-tokens/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
  } catch {
    // Logout continues even if the server already dropped the token.
  }
}

/** Test helper: wipe the in-memory token between cases. */
export function resetRegisteredPushToken() {
  currentToken = null;
}
