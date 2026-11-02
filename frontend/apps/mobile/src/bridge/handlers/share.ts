import { Share } from 'react-native';

import type { Handler } from '../context';

/** Native share sheet (team invites; blueprint §11-3). */
export const share: Handler<'SHARE'> = async (msg, ctx) => {
  const message = msg.text ? `${msg.text}\n${msg.url}` : msg.url;
  const result = await Share.share({ title: msg.title, message, url: msg.url });
  ctx.send({ type: 'RESULT', id: msg.id, ok: true, payload: { action: result.action } });
};
