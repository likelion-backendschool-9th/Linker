import { BackHandler } from 'react-native';

import type { Handler } from '../context';

export const ready: Handler<'READY'> = (_msg, ctx) => ctx.onReady();

export const backResult: Handler<'BACK_RESULT'> = (msg, ctx) =>
  ctx.onBackResult(msg.id, msg.handled);

/** Android only; iOS apps can't exit themselves (blueprint §12-3). */
export const exitApp: Handler<'EXIT_APP'> = () => {
  BackHandler.exitApp();
};
