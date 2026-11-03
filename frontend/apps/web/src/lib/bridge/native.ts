import {
  decodeNativeToWeb,
  encodeEnvelope,
  webToNativeSchema,
  type NativeToWeb,
  type WebToNative,
} from '@linker/bridge';

/** Web side of the bridge (blueprint §11-3). Browser-only helpers; call from handlers or effects. */

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

const REQUEST_TIMEOUT_MS = 5000;

export function isInApp(): boolean {
  return typeof window !== 'undefined' && window.ReactNativeWebView !== undefined;
}

/** Sends one message to the app; `false` in a plain browser. */
export function postToNative(msg: WebToNative): boolean {
  if (!isInApp()) return false;
  window.ReactNativeWebView!.postMessage(encodeEnvelope(webToNativeSchema.parse(msg)));
  return true;
}

type RequestMessage = Extract<WebToNative, { id: string }>;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type NativeResult = Extract<NativeToWeb, { type: 'RESULT' }>;

/** App messages arrive as `window` message events (`injectJavaScript` + `dispatchEvent`). */
export function onNativeMessage(handler: (msg: NativeToWeb) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: MessageEvent) => {
    if (event.source && event.source !== window) return;
    const msg = decodeNativeToWeb(event.data);
    if (msg) handler(msg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/** Waits for the matching RESULT. Default: 5 s; timeoutMs: 0 lets system UI wait for the user. */
export function requestNative(
  msg: DistributiveOmit<RequestMessage, 'id'>,
  { timeoutMs = REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<NativeResult> {
  if (!isInApp()) return Promise.reject(new Error('not-in-app'));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    // Login, sharing and permission UI complete when the user responds, not on a transport timer.
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            unsubscribe();
            reject(new Error('timeout'));
          }, timeoutMs)
        : undefined;
    const unsubscribe = onNativeMessage((reply) => {
      if (reply.type !== 'RESULT' || reply.id !== id) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(reply);
    });
    try {
      postToNative({ ...msg, id } as RequestMessage);
    } catch (error) {
      clearTimeout(timer);
      unsubscribe();
      reject(error);
    }
  });
}
