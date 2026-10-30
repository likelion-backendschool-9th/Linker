import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { BridgeContext, Handler } from '../context';

/** Sends the device token to the web if permission was already granted (Android only in the MVP). */
export async function sendPushTokenIfGranted(ctx: BridgeContext) {
  if (Platform.OS !== 'android') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  const token = await Notifications.getDevicePushTokenAsync();
  ctx.send({ type: 'PUSH_TOKEN', token: String(token.data), platform: 'android' });
}

/** Push is Android-only in the MVP (04 ch. 8 "Push devices"); iOS answers `unsupported`. */
export const pushPermissionRequest: Handler<'PUSH_PERMISSION_REQUEST'> = async (msg, ctx) => {
  if (Platform.OS !== 'android') {
    ctx.send({ type: 'RESULT', id: msg.id, ok: true, payload: { status: 'unsupported' } });
    return;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  ctx.send({ type: 'RESULT', id: msg.id, ok: true, payload: { status } });
  await sendPushTokenIfGranted(ctx);
};
