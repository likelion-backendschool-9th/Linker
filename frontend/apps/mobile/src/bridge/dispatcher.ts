import { decodeWebToNative, type WebToNative } from '@linker/bridge';
import type { WebViewMessageEvent } from 'react-native-webview';

import { isWebOrigin } from '@/lib/config';

import type { BridgeContext, Handler, HandlerMap } from './context';
import { authGithubStart, authSessionClear, authSessionSave } from './handlers/auth';
import { openExternal } from './handlers/external';
import { haptic } from './handlers/haptic';
import { backResult, exitApp, ready } from './handlers/navigation';
import { pushPermissionRequest } from './handlers/push';
import { share } from './handlers/share';

const handlers: HandlerMap = {
  READY: ready,
  BACK_RESULT: backResult,
  EXIT_APP: exitApp,
  AUTH_GITHUB_START: authGithubStart,
  AUTH_SESSION_SAVE: authSessionSave,
  AUTH_SESSION_CLEAR: authSessionClear,
  SHARE: share,
  PUSH_PERMISSION_REQUEST: pushPermissionRequest,
  OPEN_EXTERNAL: openExternal,
  HAPTIC: haptic,
};

/**
 * Web → app entry (blueprint §12-2): allowed origin → envelope schema → typed handler.
 * Unknown or invalid messages are ignored; a failing handler answers `RESULT ok: false` when the message has an id.
 */
export function createDispatcher(ctx: BridgeContext) {
  return async (event: WebViewMessageEvent) => {
    if (!isWebOrigin(event.nativeEvent.url)) return;
    const msg = decodeWebToNative(event.nativeEvent.data);
    if (!msg) return;
    const handler = handlers[msg.type] as Handler<WebToNative['type']>;
    try {
      await handler(msg, ctx);
    } catch (error) {
      if ('id' in msg) {
        ctx.send({ type: 'RESULT', id: msg.id, ok: false, error: String(error) });
      }
    }
  };
}
