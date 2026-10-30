import type { NativeToWeb, WebToNative } from '@linker/bridge';

/** What handlers may do to the shell. Built by `LinkerWebView`. */
export type BridgeContext = {
  send: (msg: NativeToWeb) => void;
  /** Load a same-origin path in the WebView (login callback) */
  loadPath: (path: string) => void;
  /** Web finished booting: flush held deep links */
  onReady: () => void;
  /** Answer to the last BACK_PRESSED */
  onBackResult: (id: string, handled: boolean) => void;
};

export type Handler<T extends WebToNative['type']> = (
  msg: Extract<WebToNative, { type: T }>,
  ctx: BridgeContext,
) => void | Promise<void>;

export type HandlerMap = { [T in WebToNative['type']]: Handler<T> };
