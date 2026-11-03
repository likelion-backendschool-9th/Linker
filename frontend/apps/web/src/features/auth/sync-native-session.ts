import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, postToNative } from '@/lib/bridge/native';
import { unregisterPushToken } from '@/features/notifications/push-tokens';

/** After login: store userId/userType on the app and let it resend PUSH_TOKEN if granted. */
export async function saveNativeSession() {
  if (!isInApp()) return;
  const me = await apiFetch<{ userId: number; userType: 'DEVELOPER' | 'RECRUITER' }>(
    '/api/v1/user/me',
  );
  postToNative({
    type: 'AUTH_SESSION_SAVE',
    session: { userId: me.userId, userType: me.userType },
  });
}

/** Call while the session cookie is still valid so DELETE /push-tokens succeeds. */
export async function unregisterNativePushToken() {
  await unregisterPushToken();
}

/** After a successful logout/withdrawal API call. */
export function clearNativeSession() {
  postToNative({ type: 'AUTH_SESSION_CLEAR' });
}
