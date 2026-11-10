import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { BridgeContext, Handler } from '../context';

/** Sends the device token to the web if permission was already granted (Android only in the MVP). */
export async function sendPushTokenIfGranted(ctx: BridgeContext) {
  if (Platform.OS !== 'android') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return; // Push remains unavailable until this development build is configured.
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  ctx.send({ type: 'PUSH_TOKEN', token: token.data, platform: 'android' });
}

/** Push is Android-only in the MVP (04 ch. 8 "Push devices"); iOS answers `unsupported`. */
export const pushPermissionRequest: Handler<'PUSH_PERMISSION_REQUEST'> = async (msg, ctx) => {
  if (Platform.OS !== 'android') {
    ctx.send({ type: 'RESULT', id: msg.id, ok: true, payload: { status: 'unsupported' } });
    return;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    ctx.send({ type: 'RESULT', id: msg.id, ok: false, error: 'push-not-configured' });
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Linker',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const { status } = await Notifications.requestPermissionsAsync();
  await sendPushTokenIfGranted(ctx);
  ctx.send({ type: 'RESULT', id: msg.id, ok: true, payload: { status } });
};
