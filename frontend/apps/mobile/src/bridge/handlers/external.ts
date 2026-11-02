import { Linking } from 'react-native';

import type { Handler } from '../context';

/** External links open in the system browser, https only (04 ch. 2 "Links"). The schema already rejects others. */
export const openExternal: Handler<'OPEN_EXTERNAL'> = async (msg) => {
  if (msg.url.startsWith('https://')) await Linking.openURL(msg.url);
};
