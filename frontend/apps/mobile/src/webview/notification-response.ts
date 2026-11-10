import { internalPath } from '@linker/bridge';
import type { NotificationResponse } from 'expo-notifications';

/** Expo may deliver the same tap through both the initial response and the running listener. */
export function createNotificationReceiver(
  openPath: (path: string) => void,
  clearLast: () => void,
) {
  const handled = new Set<string>();
  return (response: NotificationResponse | null) => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.has(key)) return;
    handled.add(key);
    const path = internalPath(response.notification.request.content.data?.path);
    if (path) openPath(path);
    // Consume the native launch response so reopening the app doesn't repeat an old navigation.
    clearLast();
  };
}
