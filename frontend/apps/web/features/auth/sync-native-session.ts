import type { BridgeSession } from '@linker/bridge';

import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, postToNative } from '@/lib/bridge/native';
import { unregisterPushToken } from '@/features/notifications/push-tokens';

let sessionRevision = 0;

/** All web-side session writers share the same ordering, including Provider updates. */
export function syncNativeSession(session: BridgeSession | null) {
  sessionRevision += 1;
  postToNative(
    session
      ? {
          type: 'AUTH_SESSION_SAVE',
          session: { userId: session.userId, userType: session.userType },
        }
      : { type: 'AUTH_SESSION_CLEAR' },
  );
}

/** After login: store userId/userType on the app and let it resend PUSH_TOKEN if granted. */
export async function saveNativeSession() {
  if (!isInApp()) return;
  const revision = ++sessionRevision;
  const me = await apiFetch<BridgeSession>('/api/v1/user/me');
  // A logout, account switch or newer lookup takes precedence over this older response.
  if (revision === sessionRevision) syncNativeSession(me);
}

/** Call while the session cookie is still valid so DELETE /push-tokens succeeds. */
export async function unregisterNativePushToken() {
  await unregisterPushToken();
}

/** After a successful logout/withdrawal API call. */
export function clearNativeSession() {
  syncNativeSession(null);
}
