import type { BridgeSession, NativeToWeb } from '@linker/bridge';

import { apiFetch } from '@/lib/api/api-fetch';

import { isInApp, postToNative } from './native';

// In-memory device state only. JWTs and push tokens are never persisted in browser storage.
let session: BridgeSession | null = null;
let pushToken: string | null = null;
let pendingRegistration: Promise<void> = Promise.resolve();

export function syncNativeSession(next: BridgeSession | null) {
  session = next;
  if (!next) pushToken = null;
  postToNative(
    next ? { type: 'AUTH_SESSION_SAVE', session: next } : { type: 'AUTH_SESSION_CLEAR' },
  );
}

/** WBS 18: the server owns device/account binding; iOS and guests cannot register. */
export async function registerNativePushToken(msg: Extract<NativeToWeb, { type: 'PUSH_TOKEN' }>) {
  if (msg.platform !== 'android' || !session) return;
  const owner = session;
  pushToken = msg.token;
  // Serialize writes: cancelling fetch alone cannot prevent an older server write arriving last.
  pendingRegistration = pendingRegistration
    .catch(() => {})
    .then(async () => {
      if (session?.userId !== owner.userId || session?.userType !== owner.userType) return;
      await apiFetch<void>('/api/v1/user/push-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: msg.token, platform: msg.platform }),
      });
    });
  await pendingRegistration;
}

/** Unbind while the cookie is still valid; clearing it first would make DELETE unauthorized. */
export async function endNativeSession<T>(endSession: () => Promise<T>): Promise<T> {
  if (!isInApp()) return endSession();
  const previous = session;
  session = null; // Ignore late token messages while logout/withdrawal is in flight.
  try {
    // A completed POST must precede DELETE; aborting fetch does not roll back a server write.
    await pendingRegistration.catch(() => {});
    if (pushToken) {
      await apiFetch<void>(`/api/v1/user/push-tokens/${encodeURIComponent(pushToken)}`, {
        method: 'DELETE',
      });
    }
    const result = await endSession();
    pushToken = null;
    postToNative({ type: 'AUTH_SESSION_CLEAR' });
    return result;
  } catch (error) {
    syncNativeSession(previous);
    throw error;
  }
}
