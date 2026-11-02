import { encodeEnvelope, type NativeToWeb } from '@linker/bridge';
import type { RefObject } from 'react';
import type { WebView } from 'react-native-webview';

/** App → web: a `window` message event carrying one JSON envelope string (blueprint §11-3). */
// react-native-webview types default P to `undefined`, which turns the props into `never` once a ref is attached
export type WebViewHandle = WebView<object>;

export function sendToWeb(webView: RefObject<WebViewHandle | null>, msg: NativeToWeb) {
  // JSON.stringify twice: the envelope string becomes a JS string literal inside the injected script
  const data = JSON.stringify(encodeEnvelope(msg));
  webView.current?.injectJavaScript(
    `window.dispatchEvent(new MessageEvent('message', { data: ${data} })); true;`,
  );
}
