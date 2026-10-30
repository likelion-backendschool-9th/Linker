import * as Haptics from 'expo-haptics';

import type { Handler } from '../context';

export const haptic: Handler<'HAPTIC'> = async (msg) => {
  if (msg.style === 'light') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else if (msg.style === 'success')
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
