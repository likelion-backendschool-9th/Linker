import { requestNative } from '@/lib/bridge/native';

/** The existing bridge request waits for the OS dialog; permission has no transport deadline. */
export function requestPushPermission() {
  return requestNative({ type: 'PUSH_PERMISSION_REQUEST' }, { timeoutMs: 0 });
}
