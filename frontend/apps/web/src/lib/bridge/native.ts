import {
  decodeNativeToWeb,
  encodeEnvelope,
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
  window.ReactNativeWebView!.postMessage(encodeEnvelope(msg));
  return true;
}

type RequestMessage = Extract<WebToNative, { id: string }>;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type NativeResult = Extract<NativeToWeb, { type: 'RESULT' }>;

/** App messages arrive as `window` message events (`injectJavaScript` + `dispatchEvent`). */
export function onNativeMessage(handler: (msg: NativeToWeb) => void): () => void {
  const listener = (event: MessageEvent) => {
    const msg = decodeNativeToWeb(event.data);
    if (msg) handler(msg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/** Sends a message that expects a `RESULT` with the same id; rejects after 5 s or outside the app. */
export function requestNative(msg: DistributiveOmit<RequestMessage, 'id'>): Promise<NativeResult> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('timeout'));
    }, REQUEST_TIMEOUT_MS);
    const unsubscribe = onNativeMessage((reply) => {
      if (reply.type !== 'RESULT' || reply.id !== id) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(reply);
    });
    if (!postToNative({ ...msg, id } as RequestMessage)) {
      clearTimeout(timer);
      unsubscribe();
      reject(new Error('not-in-app'));
    }
  });
}
